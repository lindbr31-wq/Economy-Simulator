// Roblox XML place/model format (RBXLX / RBXMX), version 4.
// Implemented per https://github.com/RobloxAPI/spec/blob/master/formats/rbxlx.md
// and https://github.com/rojo-rbx/rbx-dom/blob/master/docs/xml.md
//
// Produces the same generic instance tree as binary.js:
//   { class, name, props: {...}, children: [node, ...] }

function textOf(el) {
  return el.textContent == null ? '' : el.textContent.trim();
}

function num(el, name, fallback) {
  const child = el.querySelector ? el.querySelector(':scope > ' + name) : null;
  if (!child) return fallback;
  const v = parseFloat(textOf(child));
  return isNaN(v) ? fallback : v;
}

function numInt(el, name, fallback) {
  const child = el.querySelector ? el.querySelector(':scope > ' + name) : null;
  if (!child) return fallback;
  const v = parseInt(textOf(child), 10);
  return isNaN(v) ? fallback : v;
}

function childText(el, name) {
  const c = el.querySelector(':scope > ' + name);
  return c ? textOf(c) : '';
}

export function parseXML(text, { filename = '' } = {}) {
  const isBinary = text.startsWith('<roblox!');
  if (isBinary) {
    throw new Error('File is binary RBXL; use the binary parser (binary.js).');
  }
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const errEl = doc.querySelector('parsererror');
  if (errEl) throw new Error('XML parse error: ' + errEl.textContent.slice(0, 300));

  const root = doc.querySelector('roblox');
  if (!root) throw new Error('Missing <roblox> root element.');
  const version = root.getAttribute('version');
  if (version && version !== '4') {
    throw new Error('Unsupported RBXLX version ' + version);
  }

  // Shared strings
  const shared = new Map();
  const ss = root.querySelector(':scope > SharedStrings');
  if (ss) {
    for (const child of Array.from(ss.children)) {
      if (child.tagName !== 'SharedString') continue;
      const key = child.getAttribute('md5') || '';
      shared.set(key, base64Decode(child.textContent.replace(/\s+/g, '')));
    }
  }

  const meta = {};
  for (const m of root.querySelectorAll(':scope > Meta')) {
    meta[m.getAttribute('name') || ''] = textOf(m);
  }

  const referentToNode = new Map();
  let counter = 0;

  const parseItem = (el) => {
    const cls = el.getAttribute('class') || 'Unknown';
    const referent = el.getAttribute('referent') || 'RBXGEN' + (counter++).toString(36).toUpperCase();
    const node = {
      _id: referent,
      _className: cls,
      class: cls,
      name: '',
      props: {},
      children: [],
    };
    const propsEl = el.querySelector(':scope > Properties');
    if (propsEl) {
      for (const p of Array.from(propsEl.children)) {
        const pname = p.getAttribute('name');
        if (!pname) continue;
        node.props[pname] = parseValueEl(p, shared);
      }
    }
    if (typeof node.props.Name === 'string') node.name = node.props.Name;
    for (const childEl of Array.from(el.children)) {
      if (childEl.tagName === 'Item') {
        node.children.push(parseItem(childEl));
      }
    }
    referentToNode.set(referent, node);
    return node;
  };

  const roots = [];
  for (const childEl of Array.from(root.children)) {
    if (childEl.tagName === 'Item') roots.push(parseItem(childEl));
  }

  // If the file uses explicit Parent references (Ref) instead of nesting, build the tree from them.
  let hasParentRefs = false;
  const all = [];
  (function collect(n) { all.push(n); for (const c of n.children) collect(c); })(roots.length === 1 ? { children: roots, _tmp: true } : { children: roots, _tmp: true });

  const parentOf = new Map();
  for (const n of all) {
    if (n._tmp) continue;
    const pr = n.props.Parent;
    if (pr && typeof pr === 'object' && pr.ref) {
      hasParentRefs = true;
      parentOf.set(n, pr.ref);
    }
  }

  if (hasParentRefs) {
    // Rebuild hierarchy using Parent refs; drop implicit nesting.
    for (const n of all) {
      if (!n._tmp) n.children = [];
    }
    const newRoots = [];
    for (const n of all) {
      if (n._tmp) continue;
      const pid = parentOf.get(n);
      const parent = pid ? referentToNode.get(pid) : null;
      if (parent && parent !== n) {
        parent.children.push(n);
      } else {
        newRoots.push(n);
      }
    }
    return { roots: newRoots, byId: referentToNode, meta };
  }

  return { roots, byId: referentToNode, meta };
}

function parseValueEl(el, shared) {
  const tag = el.tagName;
  const raw = el.textContent.replace(/\s+/g, ' ').trim();
  switch (tag) {
    case 'int':
    case 'Int':
    case 'bool': {
      if (tag === 'bool') return raw === '1' || raw === 'true';
      const v = parseInt(raw, 10);
      return isNaN(v) ? 0 : v;
    }
    case 'int64':
      return raw;
    case 'double':
    case 'float':
    case 'double_':
      return parseFloat(raw) || 0;
    case 'string':
    case 'String':
      return raw;
    case 'BinaryString':
      return { binary: base64Decode(raw) };
    case 'ProtectedString':
      return { protectedString: el.textContent || '' };
    case 'Content':
    case 'ContentId': {
      for (const c of Array.from(el.children)) {
        if (c.tagName === 'url') return { content: textOf(c) };
        if (c.tagName === 'null') return null;
        if (c.tagName === 'binary' || c.tagName === 'hash') return null;
      }
      return raw ? { content: raw } : null;
    }
    case 'CoordinateFrame':
    case 'CFrame':
    case 'CFrameQuat': {
      return {
        rotation: [
          num(el, 'R00', 1), num(el, 'R01', 0), num(el, 'R02', 0),
          num(el, 'R10', 0), num(el, 'R11', 1), num(el, 'R12', 0),
          num(el, 'R20', 0), num(el, 'R21', 0), num(el, 'R22', 1),
        ],
        position: [num(el, 'X', 0), num(el, 'Y', 0), num(el, 'Z', 0)],
      };
    }
    case 'Vector3':
      return { x: num(el, 'X', 0), y: num(el, 'Y', 0), z: num(el, 'Z', 0) };
    case 'Vector2':
      return { x: num(el, 'X', 0), y: num(el, 'Y', 0) };
    case 'Vector2int16':
      return { x: numInt(el, 'X', 0), y: numInt(el, 'Y', 0), _int16: true };
    case 'Vector3int16':
      return { x: numInt(el, 'X', 0), y: numInt(el, 'Y', 0), z: numInt(el, 'Z', 0), _int16: true };
    case 'Color3':
    case 'Color3uint8': {
      const max = tag === 'Color3uint8' ? 255 : 1;
      return {
        r: num(el, 'R', 0) / max,
        g: num(el, 'G', 0) / max,
        b: num(el, 'B', 0) / max,
      };
    }
    case 'BrickColor':
      return parseInt(raw, 10) || 0;
    case 'UDim':
      return { scale: num(el, 'Scale', 0), offset: numInt(el, 'Offset', 0) };
    case 'UDim2': {
      const xEl = el.querySelector(':scope > X');
      const yEl = el.querySelector(':scope > Y');
      const dim = (d) => ({
        scale: d ? num(d, 'Scale', 0) : 0,
        offset: d ? numInt(d, 'Offset', 0) : 0,
      });
      const x = dim(xEl), y = dim(yEl);
      return { xScale: x.scale, yScale: y.scale, xOffset: x.offset, yOffset: y.offset };
    }
    case 'Faces': {
      const f = el.querySelector(':scope > faces');
      const v = f ? parseInt(textOf(f).replace('0x', ''), 16) : parseInt(raw, 16);
      return isNaN(v) ? 0 : v;
    }
    case 'Axes': {
      const f = el.querySelector(':scope > axes');
      const v = f ? parseInt(textOf(f).replace('0x', ''), 16) : parseInt(raw, 16);
      return isNaN(v) ? 0 : v;
    }
    case 'Reference':
    case 'Ref':
    case 'Instance':
      return { ref: raw };
    case 'Token':
    case 'token': {
      const t = el.querySelector(':scope > token, :scope > item');
      const v = t ? parseInt(textOf(t), 10) : parseInt(raw, 10);
      return isNaN(v) ? 0 : v;
    }
    case 'EnumItem': {
      const t = el.querySelector(':scope > item, :scope > token');
      const v = t ? parseInt(textOf(t), 10) : parseInt(raw, 10);
      return isNaN(v) ? 0 : v;
    }
    case 'NumberSequence': {
      const nums = raw.split(/\s+/).filter(Boolean).map(Number);
      const kp = [];
      for (let i = 0; i + 2 < nums.length; i += 3) {
        kp.push({ time: nums[i], value: nums[i + 1], envelope: nums[i + 2] });
      }
      return kp;
    }
    case 'ColorSequence': {
      const nums = raw.split(/\s+/).filter(Boolean).map(Number);
      const kp = [];
      for (let i = 0; i + 4 < nums.length; i += 5) {
        kp.push({ time: nums[i], r: nums[i + 1], g: nums[i + 2], b: nums[i + 3], envelope: nums[i + 4] });
      }
      return kp;
    }
    case 'NumberRange': {
      const nums = raw.split(/\s+/).filter(Boolean).map(Number);
      return { min: nums[0] || 0, max: nums[1] || 0 };
    }
    case 'Ray': {
      const o = el.querySelector(':scope > Origin');
      const d = el.querySelector(':scope > Direction');
      return {
        origin: o ? [num(o, 'X', 0), num(o, 'Y', 0), num(o, 'Z', 0)] : [0, 0, 0],
        direction: d ? [num(d, 'X', 0), num(d, 'Y', 0), num(d, 'Z', 0)] : [0, 0, 1],
      };
    }
    case 'PhysicalProperties': {
      const custom = el.querySelector(':scope > CustomPhysics');
      if (!custom || textOf(custom) === '0') return null;
      return {
        custom: true,
        density: num(el, 'Density', 1),
        friction: num(el, 'Friction', 0.3),
        elasticity: num(el, 'Elasticity', 0),
        frictionWeight: num(el, 'FrictionWeight', 1),
        elasticityWeight: num(el, 'ElasticityWeight', 1),
      };
    }
    case 'SharedString': {
      const key = el.getAttribute('md5') || raw;
      return typeof shared.get(key) === 'string' ? shared.get(key) : '';
    }
    case 'Optional': {
      for (const c of Array.from(el.children)) {
        return parseValueEl(c, shared);
      }
      return null;
    }
    case 'UniqueId': {
      return {
        index: numInt(el, 'Index', 0),
        time: numInt(el, 'Time', 0),
        random: BigInt(numInt(el, 'Random', 0)),
      };
    }
    case 'Font': {
      const fam = el.querySelector(':scope > Family');
      let family = '';
      if (fam) {
        const u = fam.querySelector('url');
        family = u ? textOf(u) : textOf(fam);
      }
      return {
        family,
        weight: numInt(el, 'Weight', 400),
        style: numInt(el, 'Style', 0),
        cachedFaceId: childText(el, 'CachedFaceId'),
      };
    }
    default: {
      // Fallback: guess from content
      if (raw === '0' || raw === '1') {
        // could be bool or int; prefer int for safety except known bool-ish
        const n = parseInt(raw, 10);
        return isNaN(n) ? raw : n;
      }
      const n = Number(raw);
      if (raw !== '' && !isNaN(n) && /^-?\d+(\.\d+)?$/.test(raw)) return n;
      return raw;
    }
  }
}

function base64Decode(b64) {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(out);
  }
  // Node fallback
  const bin = Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(out);
}

// Serialize a generic tree back to RBXLX text.
export function toXML(roots, { meta = {} } = {}) {
  const ref = (n) => n._id || (n._id = 'RBX' + Math.random().toString(16).slice(2, 18).toUpperCase());
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const fmtValue = (v) => {
    if (typeof v === 'boolean') return { tag: 'bool', text: v ? '1' : '0' };
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return { tag: 'int', text: String(v) };
      return { tag: 'double', text: String(v) };
    }
    if (typeof v === 'bigint') return { tag: 'int64', text: v.toString() };
    if (typeof v === 'string') return { tag: 'string', text: esc(v) };
    if (v && typeof v === 'object') {
      if (v.ref !== undefined) return { tag: 'Ref', text: esc(v.ref) };
      if (v.content !== undefined) return { tag: 'Content', inner: v.content ? `<url>${esc(v.content)}</url>` : '<null/>' };
      if (v.binary !== undefined) return { tag: 'BinaryString', text: base64EncodeBytes(v.binary) };
      if (Array.isArray(v.rotation) && v.position) {
        const r = v.rotation, p = v.position;
        return {
          tag: 'CoordinateFrame',
          inner: `<X>${p[0]}</X><Y>${p[1]}</Y><Z>${p[2]}</Z><R00>${r[0]}</R00><R01>${r[1]}</R01><R02>${r[2]}</R02><R10>${r[3]}</R10><R11>${r[4]}</R11><R12>${r[5]}</R12><R20>${r[6]}</R20><R21>${r[7]}</R21><R22>${r[8]}</R22>`,
        };
      }
      if (v.x !== undefined && v.y !== undefined && v.z !== undefined) {
        return { tag: 'Vector3', inner: `<X>${v.x}</X><Y>${v.y}</Y><Z>${v.z}</Z>` };
      }
      if (v.x !== undefined && v.y !== undefined) {
        return { tag: 'Vector2', inner: `<X>${v.x}</X><Y>${v.y}</Y>` };
      }
      if (v.r !== undefined && v.g !== undefined && v.b !== undefined) {
        return { tag: 'Color3', inner: `<R>${v.r}</R><G>${v.g}</G><B>${v.b}</B>` };
      }
      if (v.scale !== undefined && v.offset !== undefined) {
        return { tag: 'UDim', inner: `<Scale>${v.scale}</Scale><Offset>${v.offset}</Offset>` };
      }
      if (v.xScale !== undefined) {
        return { tag: 'UDim2', inner: `<X><Scale>${v.xScale}</Scale><Offset>${v.xOffset}</Offset></X><Y><Scale>${v.yScale}</Scale><Offset>${v.yOffset}</Offset></Y>` };
      }
      if (v.min !== undefined && v.max !== undefined && !Array.isArray(v.min)) {
        return { tag: 'NumberRange', text: `${v.min} ${v.max}` };
      }
      if (typeof v.custom === 'boolean') {
        const inner = `<CustomPhysics>${v.custom ? 1 : 0}</CustomPhysics>` + (v.custom
          ? `<Density>${v.density}</Density><Friction>${v.friction}</Friction><Elasticity>${v.elasticity}</Elasticity><FrictionWeight>${v.frictionWeight}</FrictionWeight><ElasticityWeight>${v.elasticityWeight}</ElasticityWeight>`
          : '');
        return { tag: 'PhysicalProperties', inner };
      }
      if (v.ref !== undefined && typeof v.ref === 'number') return { tag: 'Ref', text: String(v.ref) };
      if (Array.isArray(v)) {
        const flat = [];
        for (const k of v) flat.push(k.time, k.value !== undefined ? k.value : k.r, k.value !== undefined ? k.envelope : k.g, k.value === undefined ? k.b : undefined, k.value === undefined ? k.envelope : undefined).filter((x) => x !== undefined);
        return { tag: 'NumberSequence', text: flat.join(' ') };
      }
    }
    return { tag: 'string', text: esc(JSON.stringify(v)) };
  };

  const fmtItem = (node, depth) => {
    const ind = '\t'.repeat(depth);
    const cls = node.class || node._className || 'Unknown';
    const props = { ...(node.props || {}) };
    if (node.name !== undefined && node.name !== '') props.Name = node.name;
    const lines = [`${ind}<Item class="${esc(cls)}" referent="${ref(node)}">`];
    const propNames = Object.keys(props).filter((k) => k !== 'Parent');
    if (propNames.length) {
      lines.push(`${ind}\t<Properties>`);
      for (const k of propNames.sort()) {
        const f = fmtValue(props[k]);
        if (f.inner !== undefined) {
          lines.push(`${ind}\t\t<${f.tag} name="${esc(k)}">${f.inner}</${f.tag}>`);
        } else if (f.text !== undefined) {
          lines.push(`${ind}\t\t<${f.tag} name="${esc(k)}">${f.text}</${f.tag}>`);
        } else {
          lines.push(`${ind}\t\t<${f.tag} name="${esc(k)}"/>`);
        }
      }
      lines.push(`${ind}\t</Properties>`);
    } else {
      lines.push(`${ind}\t<Properties/>`);
    }
    for (const c of node.children || []) lines.push(fmtItem(c, depth + 1));
    lines.push(`${ind}</Item>`);
    return lines.join('\n');
  };

  const head = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">',
    '\t<External>null</External>',
    '\t<External>nil</External>',
  ];
  const body = (Array.isArray(roots) ? roots : [roots]).map((r) => fmtItem(r, 1)).join('\n');
  const tail = ['</roblox>'];
  return head.concat(body ? [body] : []).concat(tail).join('\n') + '\n';
}

function base64EncodeBytes(s) {
  const bytes = new TextEncoder().encode(s);
  if (typeof btoa === 'function') return btoa(String.fromCharCode(...bytes));
  return Buffer.from(bytes).toString('base64');
}
