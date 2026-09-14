// Node test: format parsers (rbxlx XML + rbxl binary + LZ4)
import { DOMParser } from 'linkedom';
globalThis.DOMParser = DOMParser;

const { parseXML, toXML } = await import('../src/format/rbxlx.js');
const { parseBinary, binaryToTree, encodeBinary } = await import('../src/format/binary.js');
const { lz4DecompressBlock } = await import('../src/format/lz4.js');

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log('  ok  ' + name);
  else { failures++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

// ------------------------------------------------------------------ LZ4 ----
{
  // "ABAB" + match(offset=2, len=4) => "ABABABAB"
  const block = new Uint8Array([0x40, 0x41, 0x42, 0x41, 0x42, 0x02, 0x00]);
  const out = lz4DecompressBlock(block, 8);
  check('lz4 basic match', String.fromCharCode(...out) === 'ABABABAB', JSON.stringify(Array.from(out)));

  // literals only (token = literalLen<<4 | matchNibble)
  const block2 = new Uint8Array([0x50, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
  const out2 = lz4DecompressBlock(block2, 5);
  check('lz4 literals', String.fromCharCode(...out2) === 'hello');

  // literal length 20 = 15 + 5 (one extension byte 0x05)
  const block3 = new Uint8Array([0xf0, 0x05, ...Array.from('01234567890123456789'.split('').map((c) => c.charCodeAt(0)))]);
  const out3 = lz4DecompressBlock(block3, 20);
  check('lz4 extended literals', String.fromCharCode(...out3) === '01234567890123456789');

  // match len 19 = base(15+4) + one terminating extension byte 0x00
  const block4 = new Uint8Array([0x2f, 0x41, 0x42, 0x02, 0x00, 0x00]);
  const out4 = lz4DecompressBlock(block4, 21);
  check('lz4 extended match', String.fromCharCode(...out4) === 'AB' + 'AB'.repeat(9) + 'A', JSON.stringify(String.fromCharCode(...out4)));
}

// ---------------------------------------------------------- sample tree ----
function sampleTree() {
  return {
    class: 'DataModel', name: 'DataModel', _id: 'RBXROOT', props: {}, children: [
      {
        class: 'Workspace', name: 'Workspace', _id: 'RBXWORKSPACE', props: {
          CFrame: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], position: [0, 0, 0] },
        }, children: [
          {
            class: 'Part', name: 'Baseplate', _id: 'RBXBASE', props: {
              Name: 'Baseplate',
              CFrame: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], position: [0, -0.5, 0] },
              Size: { x: 48, y: 1, z: 48 },
              BrickColor: 10,
              Color: { r: 0.2, g: 0.5, b: 0.9 },
              Anchored: true,
              CanCollide: true,
              CastShadow: false,
              Material: 17,
              Transparency: 0.0,
              Shape: 0,
              CanTouch: true,
              TouchTransparency: 0.0,
              Reflectance: 0.1,
              custom: 'no',
            }, children: [
              {
                class: 'Decal', name: 'Decal', _id: 'RBXDECAL', props: {
                  Texture: { content: 'rbxasset://12345' },
                  Face: 5,
                }, children: [],
              },
            ],
          },
          {
            class: 'Part', name: 'Mover', _id: 'RBXMOVER', props: {
              CFrame: { rotation: [0, 1, 0, -1, 0, 0, 0, 0, 1], position: [10, 3, -4.5] },
              Size: { x: 2, y: 2, z: 2 },
              Anchored: false,
              Color: { r: 1, g: 0, b: 0 },
              Material: 3,
              Shape: 1,
              Transparency: 0.25,
              CustomPhysicalProperties: { custom: true, density: 0.5, friction: 0.2, elasticity: 0.9, frictionWeight: 1, elasticityWeight: 1 },
              MassOffset: { x: 0.5, y: 0, z: -0.25 },
              linearVelocity: { x: 0, y: 0, z: 0 },
              angularVelocity: { x: 0, y: 0, z: 0 },
              velocity: { x: 0, y: 0, z: 0 },
            }, children: [
              {
                class: 'Weld', name: 'Weld', _id: 'RBXWELD', props: {
                  Part0: { ref: 'RBXBASE' },
                  Part1: { ref: 'RBXMOVER' },
                }, children: [],
              },
              { class: 'Script', name: 'Main', _id: 'RBXSCRIPT', props: { Source: 'print("hello from rbxl")' }, children: [] },
            ],
          },
          {
            class: 'SpawnLocation', name: 'Spawn', _id: 'RBXSPAWN', props: {
              CFrame: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], position: [0, 1, 0] },
              Size: { x: 8, y: 1, z: 8 },
              SpawnRange: 20,
              Duration: 0,
            }, children: [],
          },
          {
            class: 'Lighting', name: 'Lighting', _id: 'RBXLIGHT', props: {
              Ambient: { r: 0.2, g: 0.2, b: 0.2 },
              BackgroundColor1: { r: 0.47, g: 0.73, b: 0.98 },
              Brightness: 2,
              ClockTime: 14,
              FogEnd: 1000,
              FogStart: 60,
            }, children: [
              { class: 'SunFace' /* not a real class, but parser should not care */, name: 'SunFace', _id: 'RBXSUN', props: {}, children: [] },
            ],
          },
        ],
      },
      {
        class: 'Players', name: 'Players', _id: 'RBXPLAYERS', props: {}, children: [
          { class: 'Player', name: 'Tester', _id: 'RBXPLAYER', props: { DisplayName: 'Tester' }, children: [] },
        ],
      },
    ],
  };
}

// ------------------------------------------------------- XML roundtrip -----
{
  console.log('XML roundtrip');
  const tree = sampleTree();
  const xml = toXML([tree]);
  const parsed = parseXML(xml);
  check('xml roots count', parsed.roots.length === 1, String(parsed.roots.length));
  const ws = parsed.roots[0].children.find((c) => c.class === 'Workspace');
  check('xml workspace found', !!ws);
  const baseplate = ws.children.find((c) => c.class === 'Part' && c.name === 'Baseplate');
  check('xml baseplate found', !!baseplate);
  check('xml baseplate size', baseplate.props.Size.x === 48 && baseplate.props.Size.z === 48);
  check('xml baseplate anchored', baseplate.props.Anchored === true);
  check('xml brickcolor', baseplate.props.BrickColor === 10);
  check('xml color', Math.abs(baseplate.props.Color.g - 0.5) < 1e-6);
  check('xml float', baseplate.props.Transparency === 0.0);
  check('xml material int', baseplate.props.Material === 17);
  const mover = ws.children.find((c) => c.name === 'Mover');
  check('xml mover cframe pos', Math.abs(mover.props.CFrame.position[2] - -4.5) < 1e-6);
  check('xml mover cframe rot', mover.props.CFrame.rotation[0] === 0 && mover.props.CFrame.rotation[3] === -1);
  check('xml phys props', mover.props.CustomPhysicalProperties.custom === true && mover.props.CustomPhysicalProperties.elasticity === 0.9);
  check('xml parent ref rebuilt', mover._parentId === undefined);
  // Mover has Parent ref -> tree should have it under workspace (it is, since we nested AND set ref)
  const script = mover.children.find((c) => c.class === 'Script');
  check('xml nested script', !!script && script.props.Source.includes('hello'));
  const decal = baseplate.children.find((c) => c.class === 'Decal');
  check('xml decal texture', decal.props.Texture.content === 'rbxasset://12345');
}

// Hand-written real-world-ish XML snippet
{
  console.log('XML real-ish snippet');
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
	<External>null</External>
	<External>nil</External>
	<Item class="DataModel" referent="RBXAAAAAAAA">
		<Properties>
			<string name="Name">DataModel</string>
		</Properties>
		<Item class="Workspace" referent="RBXWORKSPACE">
			<Properties>
				<BrickColor name="Color">191</BrickColor>
				<bool name="FilterEnabled">1</bool>
				<int name="Gravity">196.2</int>
				<CoordinateFrame name="CFrame">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
					<R00>1</R00>
					<R01>0</R01>
					<R02>0</R02>
					<R10>0</R10>
					<R11>1</R11>
					<R12>0</R12>
					<R20>0</R20>
					<R21>0</R21>
					<R22>1</R22>
				</CoordinateFrame>
				<Ref name="Parent">RBXAAAAAAAA</Ref>
			</Properties>
			<Item class="Part" referent="RBXPART1">
				<Properties>
					<int name="Material">17</int>
					<bool name="Anchored">0</bool>
					<Vector3 name="Size">
						<X>4</X>
						<Y>1</Y>
						<Z>2</Z>
					</Vector3>
					<UDim2 name="TouchInputSensitivity"><X><Scale>0</Scale><Offset>0</Offset></X><Y><Scale>0</Scale><Offset>0</Offset></Y></UDim2>
					<Ref name="Parent">RBXWORKSPACE</Ref>
					<Content name="Texture">
						<url>rbxassetid://123456</url>
					</Content>
					<Faces name="TopSurface"><faces>4</faces></Faces>
					<Axes name="LockedAxis"><axes>2</axes></Axes>
					<NumberSequence name="MaterialVariation">0 0.5 0.25</NumberSequence>
					<Color3 name="Color3Prop"><R>1</R><G>0.5</G><B>0.25</B></Color3>
				</Properties>
				<Item class="Weld" referent="RBXWELD1">
					<Properties>
						<Ref name="Part0">RBXPART1</Ref>
						<Ref name="Part1">RBXPART2</Ref>
						<Ref name="Parent">RBXPART1</Ref>
					</Properties>
				</Item>
			</Item>
			<Item class="Part" referent="RBXPART2">
				<Properties>
					<CoordinateFrame name="CFrame">
						<X>5</X>
						<Y>1</Y>
						<Z>0</Z>
						<R00>1</R00>
						<R01>0</R01>
						<R02>0</R02>
						<R10>0</R10>
						<R11>1</R11>
						<R12>0</R12>
						<R20>0</R20>
						<R21>0</R21>
						<R22>1</R22>
					</CoordinateFrame>
					<Vector3 name="Size"><X>1</X><Y>2</Y><Z>3</Z></Vector3>
					<Ref name="Parent">RBXWORKSPACE</Ref>
				</Properties>
			</Item>
		</Item>
	</Item>
</roblox>`;
  const parsed = parseXML(xml);
  const root = parsed.roots[0];
  check('flat tree: roots=1 (DataModel)', parsed.roots.length === 1, String(parsed.roots.length));
  const ws = root.children.find((c) => c.class === 'Workspace');
  check('Parent ref tree: ws child of datamodel', !!ws);
  const parts = ws.children.filter((c) => c.class === 'Part');
  check('Parent ref tree: 2 parts under ws', parts.length === 2, String(parts.length));
  const p1 = parts.find((p) => p._id === 'RBXPART1');
  check('material', p1.props.Material === 17);
  check('anchored false', p1.props.Anchored === false);
  check('size', p1.props.Size.y === 1);
  check('content url', p1.props.Texture.content === 'rbxassetid://123456');
  check('faces bitmask', p1.props.TopSurface === 4);
  check('axes bitmask', p1.props.LockedAxis === 2);
  check('numbersequence', Array.isArray(p1.props.MaterialVariation) && p1.props.MaterialVariation[0].value === 0.5);
  check('udim2', p1.props.TouchInputSensitivity.xOffset === 0);
  const weld = p1.children.find((c) => c.class === 'Weld');
  check('weld part refs', weld.props.Part0.ref === 'RBXPART1' && weld.props.Part1.ref === 'RBXPART2');
}

// ------------------------------------------------------- BIN roundtrip -----
{
  console.log('Binary roundtrip');
  const tree = sampleTree();
  const bytes = encodeBinary(tree, { mode: 'place' });
  // signature check
  const sig = Array.from(bytes.subarray(0, 14));
  check('binary signature', sig.every((v, i) => v === [0x3c, 0x72, 0x6f, 0x62, 0x6c, 0x6f, 0x78, 0x21, 0x89, 0xff, 0x0d, 0x0a, 0x1a, 0x0a][i]));
  const parsed = parseBinary(bytes);
  const { roots, nodes } = binaryToTree(parsed);
  check('binary roots', roots.length === 1, String(roots.length));
  check('binary node count', nodes.length === 12, String(nodes.length));
  const ws = roots[0].children.find((c) => c._className === 'Workspace');
  check('binary ws', !!ws);
  const baseplate = ws.children.find((c) => c._className === 'Part' && c.name === 'Baseplate');
  check('binary baseplate', !!baseplate);
  check('binary size', baseplate.props.Size && baseplate.props.Size.x === 48 && Math.abs(baseplate.props.Size.y - 1) < 1e-6);
  check('binary anchored', baseplate.props.Anchored === true);
  check('binary brickcolor', baseplate.props.BrickColor === 10);
  check('binary color', Math.abs(baseplate.props.Color.g - 0.5) < 1e-5);
  check('binary material', baseplate.props.Material === 17);
  check('binary string', baseplate.props.Name === 'Baseplate');
  const decalTex = baseplate.children[0].props.Texture;
  check('binary content', decalTex === 'rbxasset://12345' || (decalTex && decalTex.content === 'rbxasset://12345'));
  check('binary float transp', baseplate.props.Transparency === 0);
  const mover = ws.children.find((c) => c.name === 'Mover');
  check('binary mover cf pos', Math.abs(mover.props.CFrame.position[1] - 3) < 1e-5 && Math.abs(mover.props.CFrame.position[2] - -4.5) < 1e-5);
  check('binary mover cf rot', mover.props.CFrame.rotation[3] === -1 && mover.props.CFrame.rotation[0] === 0);
  check('binary physprops', mover.props.CustomPhysicalProperties.custom === true && Math.abs(mover.props.CustomPhysicalProperties.density - 0.5) < 1e-6);
  check('binary faces', ws.children.find((c) => c.name === 'Baseplate').children[0].props.Face === 5);
  const script = mover.children.find((c) => c._className === 'Script');
  check('binary script source', !!script && script.props.Source.includes('hello from rbxl'));
  const spawn = ws.children.find((c) => c._className === 'SpawnLocation');
  check('binary spawn int', spawn.props.SpawnRange === 20);
}

// Cross-format: XML -> tree -> binary -> tree, and binary -> tree -> XML
{
  console.log('Cross-format');
  const tree = sampleTree();
  const xml = toXML([tree]);
  const xmlTree = parseXML(xml).roots[0];
  const bin = encodeBinary(xmlTree, { mode: 'place' });
  const binTree = binaryToTree(parseBinary(bin)).roots[0];
  const ws1 = xmlTree.children.find((c) => c.class === 'Workspace');
  const ws2 = binTree.children.find((c) => c._className === 'Workspace');
  check('cross: ws parts equal count', ws1.children.length === ws2.children.length);
  const bp1 = ws1.children.find((c) => c.name === 'Baseplate');
  const bp2 = ws2.children.find((c) => c.name === 'Baseplate');
  check('cross: baseplate size', bp2.props.Size.z === bp1.props.Size.z);
  const xmlAgain = toXML([binTree]);
  const reparsed = parseXML(xmlAgain);
  check('cross: xml reparse ok', reparsed.roots.length === 1);
}

console.log(failures === 0 ? '\nALL FORMAT TESTS PASSED' : `\n${failures} FORMAT TESTS FAILED`);
process.exit(failures === 0 ? 0 : 1);
