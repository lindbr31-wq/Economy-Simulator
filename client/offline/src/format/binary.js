// Roblox binary place/model format (RBXL / RBXM), version 0.
// Implemented per https://github.com/RobloxAPI/spec/blob/master/formats/rbxl.md
// (based on the reverse-engineering work in rbx-dom / RobloxFileSpec).
//
// Produces / consumes a generic instance tree:
//   { class, name, props: {PropertyName: value, ...}, children: [node, ...] }
// where values are plain JS objects (v3 => {x,y,z}, cframe => 12 numbers, etc.).

import { lz4DecompressBlock } from './lz4.js';

const SIGNATURE = new Uint8Array([0x3c, 0x72, 0x6f, 0x62, 0x6c, 0x6f, 0x78, 0x21, 0x89, 0xff, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---------------------------------------------------------------- reader ---

export class Reader {
  constructor(bytes) {
    this.data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.pos = 0;
    this.view = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  }
  get done() { return this.pos >= this.data.length; }
  remaining() { return this.data.length - this.pos; }
  u8v() { const v = this.data[this.pos]; this.pos += 1; return v; }
  u16() { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  u32() { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  i32() { const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  i16() { const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
  f32() { const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  u32be() { const v = this.view.getUint32(this.pos, false); this.pos += 4; return v; }
  i64be() {
    const v = (BigInt(this.view.getUint32(this.pos, false)) << 32n) | BigInt(this.view.getUint32(this.pos + 4, false));
    this.pos += 8;
    return v;
  }
  take(n) { const v = this.data.subarray(this.pos, this.pos + n); this.pos += n; return v; }
  string() {
    const len = this.u32();
    const s = new TextDecoder('utf-8').decode(this.take(len));
    return s;
  }
  zigzag32be() {
    const n = this.u32be();
    // decode: (n >> 1) ^ -(n & 1)
    return (n >> 1) ^ -(n & 1);
  }
  zigzag64be() {
    let n = this.i64be(); // raw 64-bit (may be negative as BigInt)
    const neg = n < 0n;
    const u = neg ? n + (1n << 64n) : n;
    const v = (u >> 1n) ^ (neg ? -(1n << 63n) : 0n);
    return v;
  }
  // "Roblox float": float32 bits circularly shifted left 1, stored big-endian.
  rfloat32be() {
    const u = this.u32be();
    const f = ((u >>> 1) | (u << 31)) >>> 0;
    const dv = new DataView(new ArrayBuffer(4));
    dv.setUint32(0, f, true);
    return dv.getFloat32(0, true);
  }
}

// Decode a byte blob of M values interleaved with element byte size N,
// i.e. out[i*N + j] = in[j*M + i]. Returns the deinterleaved bytes.
function deinterleave(inBytes, N, M) {
  const out = new Uint8Array(N * M);
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < N; j++) out[i * N + j] = inBytes[j * M + i];
  }
  return out;
}

// ---------------------------------------------------------------- types ----

// Value type IDs
const T = {
  String: 0x01, Bool: 0x02, Int: 0x03, Float: 0x04, Double: 0x05,
  UDim: 0x06, UDim2: 0x07, Ray: 0x08, Faces: 0x09, Axes: 0x0a,
  BrickColor: 0x0b, Color3: 0x0c, Vector2: 0x0d, Vector3: 0x0e,
  Vector2int16: 0x0f, CFrame: 0x10, CFrameQuat: 0x11, Token: 0x12,
  Reference: 0x13, Vector3int16: 0x14, NumberSequence: 0x15,
  ColorSequence: 0x16, NumberRange: 0x17, Rect: 0x18,
  PhysicalProperties: 0x19, Color3uint8: 0x1a, Int64: 0x1b,
  SharedString: 0x1c, Optional: 0x1e, UniqueId: 0x1f, Font: 0x20,
};

function decodeReferences(r, count) {
  const raw = deinterleave(r.take(4 * count), 4, count);
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const out = new Array(count);
  let prev = 0;
  for (let i = 0; i < count; i++) {
    let n = dv.getUint32(i * 4, false);
    let v = (n >> 1) ^ -(n & 1); // zigzag
    v += prev;
    prev = v;
    out[i] = v;
  }
  return out;
}

function readRfloats(r, count, N) {
  const raw = deinterleave(r.take(N * count), N, count);
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const u = dv.getUint32(i * N, false);
    const f = ((u >>> 1) | (u << 31)) >>> 0;
    dv.setUint32(0, f, true);
    out[i] = dv.getFloat32(0);
  }
  return out;
}

// CFrame predefined rotation matrices (ID -> [9] flat row-major per spec table)
// [rotationId, matrix] pairs (spec "Rotation IDs" table)
const CF_ROT_PAIRS = [
  [0x02, [1, 0, 0, 0, 1, 0, 0, 0, 1]],
  [0x03, [1, 0, 0, 0, 0, -1, 0, 1, 0]],
  [0x05, [1, 0, 0, 0, -1, 0, 0, 0, -1]],
  [0x06, [1, 0, -0, 0, 0, 1, 0, -1, 0]],
  [0x07, [0, 1, 0, 1, 0, 0, 0, 0, -1]],
  [0x09, [0, 0, 1, 1, 0, 0, 0, 1, 0]],
  [0x0a, [0, -1, 0, 1, 0, -0, 0, 0, 1]],
  [0x0c, [0, 0, -1, 1, 0, 0, 0, -1, 0]],
  [0x0d, [0, 1, 0, 0, 0, 1, 1, 0, 0]],
  [0x0e, [0, 0, -1, 0, 1, 0, 1, 0, 0]],
  [0x10, [0, -1, 0, 0, 0, -1, 1, 0, 0]],
  [0x11, [0, 0, 1, 0, -1, 0, 1, 0, -0]],
  [0x14, [-1, 0, 0, 0, 1, 0, 0, 0, -1]],
  [0x15, [-1, 0, 0, 0, 0, 1, 0, 1, -0]],
  [0x17, [-1, 0, 0, 0, -1, 0, 0, 0, 1]],
  [0x18, [-1, 0, -0, 0, 0, -1, 0, -1, -0]],
  [0x19, [0, 1, -0, -1, 0, 0, 0, 0, 1]],
  [0x1b, [0, 0, -1, -1, 0, 0, 0, 1, 0]],
  [0x1c, [0, -1, -0, -1, 0, -0, 0, 0, -1]],
  [0x1e, [0, 0, 1, -1, 0, 0, 0, -1, 0]],
  [0x1f, [0, 1, 0, 0, 0, -1, -1, 0, 0]],
  [0x20, [0, 0, 1, 0, 1, -0, -1, 0, 0]],
  [0x22, [0, -1, 0, 0, 0, 1, -1, 0, 0]],
  [0x23, [0, 0, -1, 0, -1, -0, -1, 0, -0]],
];
const CF_ROT = Object.fromEntries(CF_ROT_PAIRS.map(([id, m]) => [id, m]));

function decodeValueArray(r, typeId, count, sharedStrings) {
  switch (typeId) {
    case T.String: {
      const out = new Array(count);
      for (let i = 0; i < count; i++) out[i] = r.string();
      return out;
    }
    case T.Bool: {
      const out = new Array(count);
      for (let i = 0; i < count; i++) out[i] = r.u8v() !== 0;
      return out;
    }
    case T.Int: {
      const raw = deinterleave(r.take(4 * count), 4, count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const n = dv.getUint32(i * 4, false);
        out[i] = (n >> 1) ^ -(n & 1);
      }
      return out;
    }
    case T.Float:
      return readRfloats(r, count, 4);
    case T.Double: {
      // []float64 (little-endian, no interleaving per spec)
      const raw = r.take(8 * count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) out[i] = dv.getFloat64(i * 8, true);
      return out;
    }
    case T.UDim: {
      const raw = deinterleave(r.take(8 * count), 8, count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const u = dv.getUint32(i * 8, false);
        const f = ((u >>> 1) | (u << 31)) >>> 0;
        dv.setUint32(0, f, true);
        const scale = dv.getFloat32(0);
        const n = dv.getUint32(i * 8 + 4, true);
        const offset = (n >> 1) ^ -(n & 1);
        out[i] = { scale, offset };
      }
      return out;
    }
    case T.UDim2: {
      const raw = deinterleave(r.take(16 * count), 16, count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const base = i * 16;
        const cf = (off) => {
          const u = dv.getUint32(base + off, false);
          const f = ((u >>> 1) | (u << 31)) >>> 0;
          dv.setUint32(0, f, true);
          return dv.getFloat32(0, true);
        };
        const zi = (off) => {
          const n = dv.getUint32(base + off, true);
          return (n >> 1) ^ -(n & 1);
        };
        out[i] = { xScale: cf(0), yScale: cf(4), xOffset: zi(8), yOffset: zi(12) };
      }
      return out;
    }
    case T.Ray: {
      const raw = r.take(24 * count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const b = i * 24;
        out[i] = {
          origin: [dv.getFloat32(b, true), dv.getFloat32(b + 4, true), dv.getFloat32(b + 8, true)],
          direction: [dv.getFloat32(b + 12, true), dv.getFloat32(b + 16, true), dv.getFloat32(b + 20, true)],
        };
      }
      return out;
    }
    case T.Faces:
      return Array.from(r.take(count));
    case T.Axes:
      return Array.from(r.take(count));
    case T.BrickColor: {
      const raw = deinterleave(r.take(4 * count), 4, count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) out[i] = dv.getUint32(i * 4, false);
      return out;
    }
    case T.Color3: {
      const raw = deinterleave(r.take(12 * count), 12, count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const cf = (off) => {
          const u = dv.getUint32(i * 12 + off, false);
          const f = ((u >>> 1) | (u << 31)) >>> 0;
          dv.setUint32(0, f, true);
          return dv.getFloat32(0, true);
        };
        out[i] = { r: cf(0), g: cf(4), b: cf(8) };
      }
      return out;
    }
    case T.Vector2: {
      const raw = deinterleave(r.take(8 * count), 8, count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const cf = (off) => {
          const u = dv.getUint32(i * 8 + off, false);
          const f = ((u >>> 1) | (u << 31)) >>> 0;
          dv.setUint32(0, f, true);
          return dv.getFloat32(0, true);
        };
        out[i] = { x: cf(0), y: cf(4) };
      }
      return out;
    }
    case T.Vector3: {
      const raw = deinterleave(r.take(12 * count), 12, count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const cf = (off) => {
          const u = dv.getUint32(i * 12 + off, false);
          const f = ((u >>> 1) | (u << 31)) >>> 0;
          dv.setUint32(0, f, true);
          return dv.getFloat32(0, true);
        };
        out[i] = { x: cf(0), y: cf(4), z: cf(8) };
      }
      return out;
    }
    case T.Vector2int16: {
      const raw = r.take(4 * count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) out[i] = { x: dv.getInt16(i * 4, true), y: dv.getInt16(i * 4 + 2, true) };
      return out;
    }
    case T.CFrame: {
      const rots = new Array(count);
      for (let i = 0; i < count; i++) {
        const id = r.u8v();
        if (id === 0) {
          rots[i] = [r.f32(), r.f32(), r.f32(), r.f32(), r.f32(), r.f32(), r.f32(), r.f32(), r.f32()];
        } else {
          const m = CF_ROT[id];
          if (!m) throw new Error('Unknown CFrame rotation ID 0x' + id.toString(16));
          rots[i] = m.slice();
        }
      }
      const posRaw = deinterleave(r.take(12 * count), 12, count);
      const dv = new DataView(posRaw.buffer, posRaw.byteOffset, posRaw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const cf = (off) => {
          const u = dv.getUint32(i * 12 + off, false);
          const f = ((u >>> 1) | (u << 31)) >>> 0;
          dv.setUint32(0, f, true);
          return dv.getFloat32(0, true);
        };
        out[i] = { rotation: rots[i], position: [cf(0), cf(4), cf(8)] };
      }
      return out;
    }
    case T.CFrameQuat: {
      // Rarely used; decode per spec.
      const rots = new Array(count);
      for (let i = 0; i < count; i++) {
        const id = r.u8v();
        if (id === 0) {
          rots[i] = [r.f32(), r.f32(), r.f32(), r.f32()];
        } else {
          rots[i] = CF_ROT[id] || [1, 0, 0, 0, 1, 0, 0, 0, 1];
        }
      }
      const posRaw = deinterleave(r.take(12 * count), 12, count);
      const dv = new DataView(posRaw.buffer, posRaw.byteOffset, posRaw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const cf = (off) => {
          const u = dv.getUint32(i * 12 + off, false);
          const f = ((u >>> 1) | (u << 31)) >>> 0;
          dv.setUint32(0, f, true);
          return dv.getFloat32(0, true);
        };
        out[i] = { rotation: rots[i], position: [cf(0), cf(4), cf(8)] };
      }
      return out;
    }
    case T.Token: {
      const raw = deinterleave(r.take(4 * count), 4, count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) out[i] = dv.getUint32(i * 4, false);
      return out;
    }
    case T.Reference:
      return decodeReferences(r, count);
    case T.Vector3int16: {
      const raw = r.take(6 * count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) out[i] = { x: dv.getInt16(i * 6, true), y: dv.getInt16(i * 6 + 2, true), z: dv.getInt16(i * 6 + 4, true) };
      return out;
    }
    case T.NumberSequence: {
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const len = r.u32();
        const kp = [];
        for (let k = 0; k < len; k++) kp.push({ time: r.f32(), value: r.f32(), envelope: r.f32() });
        out[i] = kp;
      }
      return out;
    }
    case T.ColorSequence: {
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const len = r.u32();
        const kp = [];
        for (let k = 0; k < len; k++) kp.push({ time: r.f32(), r: r.f32(), g: r.f32(), b: r.f32(), envelope: r.f32() });
        out[i] = kp;
      }
      return out;
    }
    case T.NumberRange: {
      const out = new Array(count);
      for (let i = 0; i < count; i++) out[i] = { min: r.f32(), max: r.f32() };
      return out;
    }
    case T.Rect: {
      const raw = deinterleave(r.take(16 * count), 16, count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const cf = (off) => {
          const u = dv.getUint32(i * 16 + off, false);
          const f = ((u >>> 1) | (u << 31)) >>> 0;
          dv.setUint32(0, f, true);
          return dv.getFloat32(0, true);
        };
        out[i] = { min: { x: cf(0), y: cf(4) }, max: { x: cf(8), y: cf(12) } };
      }
      return out;
    }
    case T.PhysicalProperties: {
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const custom = r.u8v() !== 0;
        if (custom) {
          out[i] = {
            custom,
            density: r.f32(), friction: r.f32(), elasticity: r.f32(),
            frictionWeight: r.f32(), elasticityWeight: r.f32(),
          };
        } else {
          out[i] = null;
        }
      }
      return out;
    }
    case T.Color3uint8: {
      const raw = deinterleave(r.take(3 * count), 3, count);
      const out = new Array(count);
      for (let i = 0; i < count; i++) out[i] = { r: raw[i * 3], g: raw[i * 3 + 1], b: raw[i * 3 + 2] };
      return out;
    }
    case T.Int64: {
      const raw = deinterleave(r.take(8 * count), 8, count);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const hi = (new DataView(raw.buffer, raw.byteOffset).getUint32(i * 8, false));
        const lo = (new DataView(raw.buffer, raw.byteOffset).getUint32(i * 8 + 4, false));
        let n = (BigInt(hi) << 32n) | BigInt(lo);
        out[i] = (n >> 1n) ^ (n & 1n ? -(1n << 63n) : 0n);
      }
      return out;
    }
    case T.SharedString: {
      const raw = deinterleave(r.take(4 * count), 4, count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const idx = dv.getUint32(i * 4, false);
        out[i] = sharedStrings ? sharedStrings[idx] : String(idx);
      }
      return out;
    }
    case T.Optional: {
      const innerType = r.u8v();
      const values = decodeValueArray(r, innerType, count, sharedStrings);
      const presenceRaw = r.take(count);
      const out = new Array(count);
      for (let i = 0; i < count; i++) out[i] = presenceRaw[i] !== 0 ? values[i] : null;
      return out;
    }
    case T.UniqueId: {
      const raw = deinterleave(r.take(16 * count), 16, count);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        const b = i * 16;
        out[i] = {
          index: dv.getUint32(b, false),
          time: dv.getUint32(b + 4, false),
          random: BigInt(dv.getUint32(b + 8, false) << 32) | BigInt(dv.getUint32(b + 12, false)),
        };
      }
      return out;
    }
    case T.Font: {
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        out[i] = { family: r.string(), weight: r.u16(), style: r.u8v(), cachedFaceId: r.string() };
      }
      return out;
    }
    default:
      throw new Error('Unknown/unsupported binary value type ID 0x' + typeId.toString(16));
  }
}

// ---------------------------------------------------------------- parse ----

export function parseBinary(bytes) {
  const r = new Reader(bytes);

  // Legacy marker: <roblox without the "!" means XML.
  if (!(r.take(14)).every((v, i) => v === SIGNATURE[i])) {
    const head = new TextDecoder('ascii').decode(bytes.subarray(0, 8));
    if (head.startsWith('<roblox')) {
      throw new Error('File begins with <roblox (XML marker) - use the XML parser (rbxlx.js).');
    }
    throw new Error('Not a binary RBXL file (bad signature).');
  }
  const version = r.u16();
  if (version !== 0) throw new Error('Unsupported RBXL version ' + version);

  // Header
  r.u32(); // class count (advisory)
  r.u32(); // instance count (advisory)
  r.take(8); // reserved

  const sharedStrings = [];
  const classes = new Map(); // classId -> {name, instances: [{id, isService}]}
  const parents = new Map(); // childId -> parentId
  const meta = {};
  const instChunkOrder = [];

  return parseChunks(r, { sharedStrings, classes, parents, meta, instChunkOrder });
}

function parseChunks(r, ctx) {
  const { sharedStrings, classes, parents, meta, instChunkOrder } = ctx;
  for (;;) {
    if (r.done) throw new Error('Reached end of file before END chunk');
    const sigBytes = r.take(4);
    const sig = new TextDecoder('ascii').decode(sigBytes);
    const compLen = r.u32();
    const uncompLen = r.u32();
    r.take(4); // reserved
    let payload = r.take(compLen || uncompLen);
    if (compLen !== 0) {
      payload = lz4DecompressBlock(payload, uncompLen);
    }
    const pr = new Reader(payload);

    switch (sig) {
      case 'META': {
        const len = pr.u32();
        for (let i = 0; i < len; i++) {
          const k = pr.string();
          const v = pr.string();
          meta[k] = v;
        }
        break;
      }
      case 'SSTR': {
        const v = pr.i32();
        if (v !== 0) throw new Error('Unsupported SSTR version ' + v);
        const len = pr.u32();
        for (let i = 0; i < len; i++) {
          pr.take(16); // hash
          sharedStrings.push(pr.string());
        }
        break;
      }
      case 'INST': {
        const classId = pr.i32();
        const className = pr.string();
        const hasService = pr.u8v() !== 0;
        const len = pr.u32();
        const ids = decodeReferences(pr, len);
        let isService = null;
        if (hasService) isService = Array.from(pr.take(len));
        const cls = { name: className, classId, instances: [] };
        for (let i = 0; i < len; i++) {
          cls.instances.push({ id: ids[i], isService: isService ? isService[i] !== 0 : false });
        }
        classes.set(classId, cls);
        instChunkOrder.push(cls);
        break;
      }
      case 'PROP': {
        const classId = pr.i32();
        const name = pr.string();
        const typeId = pr.u8v();
        const cls = classes.get(classId);
        if (!cls) throw new Error('PROP chunk for unknown class ID ' + classId);
        const count = cls.instances.length;
        const values = decodeValueArray(pr, typeId, count, sharedStrings);
        for (let i = 0; i < count; i++) {
          const inst = cls.instances[i];
          inst.props = inst.props || {};
          inst.props[name] = { value: values[i], typeId };
        }
        break;
      }
      case 'PRNT': {
        pr.u8v(); // reserved
        const len = pr.u32();
        const children = decodeReferences(pr, len);
        const ps = decodeReferences(pr, len);
        for (let i = 0; i < len; i++) {
          if (ps[i] !== -1) parents.set(children[i], ps[i]);
        }
        break;
      }
      case 'END.':
        return { mode: 'binary', meta, sharedStrings, classes: instChunkOrder, parents };
      default:
        throw new Error('Unknown chunk signature ' + sig);
    }
  }
}

// Convert the parsed binary structure into a generic tree.
// Returns { roots: [node], byId: Map<id, node> }
export function binaryToTree(parsed) {
  const byId = new Map();
  const nodes = [];
  for (const cls of parsed.classes) {
    for (const inst of cls.instances) {
    const node = {
      _id: inst.id,
      _classId: cls.classId,
      _className: cls.name,
      class: cls.name,
      _isService: inst.isService || false,
      props: {},
      children: [],
    };
    if (inst.props) {
      for (const [k, v] of Object.entries(inst.props)) {
        if (v.typeId === T.Reference) {
          node.props[k] = { ref: v.value };
        } else {
          node.props[k] = unwrap(v.value, v.typeId);
        }
      }
    }
      node.name = typeof node.props.Name === 'string' ? node.props.Name : '';
      byId.set(inst.id, node);
      nodes.push(node);
    }
  }
  const roots = [];
  for (const node of nodes) {
    const pid = parsed.parents.get(node._id);
    if (pid !== undefined && byId.has(pid)) {
      byId.get(pid).children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Resolve Reference props to actual nodes (done by caller via byId).
  return { roots, byId, nodes };
}

function unwrap(value, typeId) {
  if (value === null || value === undefined) return value;
  return value; // keep plain JS objects; the API layer interprets them.
}

// ---------------------------------------------------------------- encode ---

// Minimal encoder (writes UNCOMPRESSED chunks, which the spec allows).
// Input: a generic tree: { class, name, props, children } (+ optional _id)
class Builder {
  constructor() { this.parts = []; }
  put(bytes) { this.parts.push(bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(bytes)); }
  put8(v) { this.put(new Uint8Array([v & 0xff])); }
  put16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v & 0xffff, true); this.put(b); }
  put32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); this.put(b); }
  putSig(s) { this.put(new TextEncoder().encode(s)); }
  putStr(s) { const e = new TextEncoder().encode(s); this.put32(e.length); this.put(e); }
  build() {
    const total = this.parts.reduce((a, b) => a + b.length, 0);
    const res = new Uint8Array(total);
    let o = 0;
    for (const b of this.parts) { res.set(b, o); o += b.length; }
    return res;
  }
}

export function encodeBinary(tree, { mode = 'place' } = {}) {
  // Flatten (nesting defines the parent/child relations -> PRNT chunk)
  const roots = Array.isArray(tree) ? tree : [tree];
  const flat = [];
  const oldIds = new Map(); // node -> original (possibly string) id
  const walk = (node, parentId) => {
    oldIds.set(node, node._id); // original id (string referent, number, or undefined)
    const id = flat.length;
    node._id = id;
    node._parentId = parentId;
    flat.push(node);
    for (const c of node.children || []) walk(c, id);
  };
  roots.forEach((n) => walk(n, -1));

  // Rewrite Reference-type properties ({ref: X}) to numeric instance ids.
  for (const node of flat) {
    for (const [k, v] of Object.entries(node.props || {})) {
      if (v && typeof v === 'object' && (typeof v.ref === 'string' || typeof v.ref === 'number')) {
        const target = byReferent(v.ref, oldIds, flat);
        node.props[k] = target !== null ? target._id : -1;
      }
    }
    // Parent is encoded by the PRNT chunk, not as a property.
    if (node.props && 'Parent' in node.props) delete node.props.Parent;
    // Ensure the Name property is encoded (it carries the instance name).
    if (node.name !== undefined && node.name !== '') {
      node.props = node.props || {};
      node.props.Name = node.name;
    }
  }

  // Group by class
  const byClass = new Map();
  for (const node of flat) {
    const c = node.class || node._className || 'Unknown';
    if (!byClass.has(c)) byClass.set(c, []);
    byClass.get(c).push(node);
  }

  const out = new Builder();
  const header = new Uint8Array([
    0x3c, 0x72, 0x6f, 0x62, 0x6c, 0x6f, 0x78, 0x21, 0x89, 0xff, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const version = new Uint8Array(2); // version 0
  const classCount = new Uint8Array(4);
  const instanceCount = new Uint8Array(4);
  const reserved = new Uint8Array(8);
  new DataView(classCount.buffer).setUint32(0, byClass.size >>> 0, true);
  new DataView(instanceCount.buffer).setUint32(0, flat.length >>> 0, true);

  out.put(header);
  out.put(version);
  out.put(classCount);
  out.put(instanceCount);
  out.put(reserved);

  const chunk = (sig, payload) => {
    out.putSig(sig);
    out.put32(0); // compressed length 0 => payload is uncompressed
    out.put32(payload.length);
    out.put(new Uint8Array(4)); // reserved
    out.put(payload);
  };

  // META
  {
    const p = new Builder();
    const entries = Object.entries((tree && tree.meta) ? tree.meta : {});
    p.put32(entries.length);
    for (const [k, v] of entries) { p.putStr(k); p.putStr(v); }
    chunk('META', p.build());
  }

  // SSTR: version 0, no shared strings
  {
    const p = new Builder();
    p.put32(0);
    p.put32(0);
    chunk('SSTR', p.build());
  }

  // INST chunks
  const classIds = new Map();
  for (const [name, instances] of byClass) {
    const classId = classIds.size;
    classIds.set(name, classId);
    const p = new Builder();
    p.put32(classId); // int32 class id
    p.putStr(name);
    const hasService = mode === 'place' && instances.some((n) => n._isService);
    p.put8(hasService ? 1 : 0);
    p.put32(instances.length);
    p.put(putRefs(instances.map((n) => n._id)));
    if (hasService) {
      for (const n of instances) p.put8(n._isService ? 1 : 0);
    }
    chunk('INST', p.build());
  }

  // PROP chunks: one per (class, propertyName)
  for (const [name, instances] of byClass) {
    const classId = classIds.get(name);
    const propNames = new Set();
    for (const n of instances) for (const prop of Object.keys(n.props || {})) propNames.add(prop);
    for (const pname of propNames) {
      const present = instances.filter((n) => n.props && pname in n.props);
      const sample = present[0] ? present[0].props[pname] : 0;
      const typeId = inferTypeId(sample);
      const values = instances.map((n) => (n.props && pname in n.props ? n.props[pname] : defaultValueFor(typeId)));
      const p = new Builder();
      p.put32(classId);
      p.putStr(pname);
      p.put8(typeId);
      encodeValueArray(p, typeId, values);
      chunk('PROP', p.build());
    }
  }

  // PRNT chunk
  {
    const p = new Builder();
    p.put8(0); // reserved
    const withParent = flat.filter((n) => n._parentId !== -1 && n._parentId !== undefined);
    p.put32(withParent.length);
    p.put(putRefs(withParent.map((n) => n._id)));
    p.put(putRefs(withParent.map((n) => n._parentId)));
    chunk('PRNT', p.build());
  }

  // END chunk
  chunk('END.', new TextEncoder().encode('</roblox>'));

  return out.build();
}

function byReferent(ref, oldIds, flat) {
  for (const n of flat) {
    if (oldIds.get(n) === ref) return n;
  }
  return null;
}

// zigzag32, big-endian, delta-encoded, interleaved by 4 (the "References" type)
function putRefs(ids) {
  const n = ids.length;
  const zz = new Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const d = ids[i] - prev;
    prev = ids[i];
    zz[i] = ((d << 1) ^ (d >> 31)) >>> 0;
  }
  // interleaved: byte j of every element first
  const out = new Uint8Array(4 * n);
  for (let i = 0; i < n; i++) {
    const v = zz[i];
    out[0 * n + i] = (v >>> 24) & 0xff;
    out[1 * n + i] = (v >>> 16) & 0xff;
    out[2 * n + i] = (v >>> 8) & 0xff;
    out[3 * n + i] = v & 0xff;
  }
  return out;
}

export function inferTypeId(v) {
  if (typeof v === 'boolean') return T.Bool;
  if (typeof v === 'string') return T.String;
  if (typeof v === 'number') return Number.isInteger(v) ? T.Int : T.Float;
  if (v && typeof v === 'object') {
    if (typeof v.ref === 'number') return T.Reference;
    if (typeof v.custom === 'boolean') return T.PhysicalProperties;
    if (Array.isArray(v.rotation) || (v.rotation && v.position)) return T.CFrame;
    if (v.x !== undefined && v.y !== undefined && v.z !== undefined) {
      if (Number.isInteger(v.x) && Number.isInteger(v.y) && Number.isInteger(v.z) && Math.abs(v.x) < 32768 && Math.abs(v.y) < 32768 && Math.abs(v.z) < 32768 && (v._int16 || false)) return T.Vector3int16;
      return T.Vector3;
    }
    if (v.x !== undefined && v.y !== undefined && v.z === undefined && v._int16) return T.Vector2int16;
    if (v.x !== undefined && v.y !== undefined && v.z === undefined) return T.Vector2;
    if (v.r !== undefined && v.g !== undefined && v.b !== undefined) return T.Color3;
    if (v.scale !== undefined && v.offset !== undefined) return T.UDim;
    if (v.xScale !== undefined) return T.UDim2;
    if (v.min !== undefined && v.max !== undefined) return T.NumberRange;
    if (Array.isArray(v)) return T.NumberSequence;
    if (v.origin && v.direction) return T.Ray;
    if (v.family !== undefined) return T.Font;
  }
  return T.String;
}

function defaultValueFor(typeId) {
  switch (typeId) {
    case T.Bool: return false;
    case T.Int: return 0;
    case T.Float: return 0;
    case T.Double: return 0;
    case T.String: return '';
    case T.BrickColor: return 0;
    case T.Token: return 0;
    case T.Reference: return -1;
    case T.Faces:
    case T.Axes: return 0;
    case T.Vector3: return { x: 0, y: 0, z: 0 };
    case T.Vector2: return { x: 0, y: 0 };
    case T.Color3: return { r: 0, g: 0, b: 0 };
    case T.UDim: return { scale: 0, offset: 0 };
    case T.UDim2: return { xScale: 0, yScale: 0, xOffset: 0, yOffset: 0 };
    case T.NumberRange: return { min: 0, max: 0 };
    case T.CFrame: return { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], position: [0, 0, 0] };
    case T.PhysicalProperties: return null;
    case T.NumberSequence: return [];
    case T.ColorSequence: return [];
    default: return 0;
  }
}

function interleaved(N, n, elemBytes) {
  // elemBytes(i) -> N-byte Uint8Array of element i (already in final layout)
  const res = new Uint8Array(N * n);
  for (let i = 0; i < n; i++) {
    const eb = elemBytes(i);
    for (let j = 0; j < N; j++) res[j * n + i] = eb[j];
  }
  return res;
}

function encodeValueArray(ctx, typeId, values) {
  const put = (b) => ctx.put(b);
  const put8 = (v) => ctx.put8(v);
  const put16 = (v) => ctx.put16(v);
  const put32 = (v) => ctx.put32(v);
  const putStr = (s) => ctx.putStr(s);
  const n = values.length;
  const rfloatBytes = (v) => {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setFloat32(0, v, true);
    const u = dv.getUint32(0, true);
    const f = ((u << 1) | (u >>> 31)) >>> 0;
    return new Uint8Array([(f >>> 24) & 0xff, (f >>> 16) & 0xff, (f >>> 8) & 0xff, f & 0xff]);
  };
  const zigzagBytes = (v) => {
    const u = ((v << 1) ^ (v >> 31)) >>> 0;
    return new Uint8Array([(u >>> 24) & 0xff, (u >>> 16) & 0xff, (u >>> 8) & 0xff, u & 0xff]);
  };
  const le32 = (v) => {
    const u = v >>> 0;
    return new Uint8Array([u & 0xff, (u >>> 8) & 0xff, (u >>> 16) & 0xff, (u >>> 24) & 0xff]);
  };
  const le32f = (v) => {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setFloat32(0, v, true);
    return new Uint8Array(dv.buffer);
  };

  const contentString = (v) => {
    if (v == null) return '';
    if (typeof v === 'object') {
      if (v.content !== undefined) return v.content;
      if (v.binary !== undefined) return v.binary;
      if (v.protectedString !== undefined) return v.protectedString;
    }
    return String(v);
  };

  switch (typeId) {
    case T.String:
      for (const v of values) putStr(contentString(v));
      break;
    case T.Bool:
      for (const v of values) put8(v ? 1 : 0);
      break;
    case T.Int:
      put(interleaved(4, n, (i) => zigzagBytes(values[i] | 0)));
      break;
    case T.Float:
      put(interleaved(4, n, (i) => rfloatBytes(+values[i] || 0)));
      break;
    case T.Double:
      for (const v of values) put(new Uint8Array(new Float64Array([+v || 0]).buffer));
      break;
    case T.UDim:
      put(interleaved(8, n, (i) => concatU8(rfloatBytes(values[i].scale || 0), le32(values[i].offset | 0))));
      break;
    case T.UDim2:
      put(interleaved(16, n, (i) => concatU8(
        rfloatBytes(values[i].xScale || 0), rfloatBytes(values[i].yScale || 0),
        le32(values[i].xOffset | 0), le32(values[i].yOffset | 0),
      )));
      break;
    case T.Faces:
    case T.Axes:
      for (const v of values) put8(v | 0);
      break;
    case T.BrickColor:
      put(interleaved(4, n, (i) => new Uint8Array([(values[i] >>> 24) & 0xff, (values[i] >>> 16) & 0xff, (values[i] >>> 8) & 0xff, values[i] & 0xff])));
      break;
    case T.Color3:
      put(interleaved(12, n, (i) => concatU8(rfloatBytes(values[i].r || 0), rfloatBytes(values[i].g || 0), rfloatBytes(values[i].b || 0))));
      break;
    case T.Vector2:
      put(interleaved(8, n, (i) => concatU8(rfloatBytes(values[i].x || 0), rfloatBytes(values[i].y || 0))));
      break;
    case T.Vector3:
      put(interleaved(12, n, (i) => concatU8(rfloatBytes(values[i].x || 0), rfloatBytes(values[i].y || 0), rfloatBytes(values[i].z || 0))));
      break;
    case T.Vector2int16: {
      const res = new Uint8Array(4 * n);
      for (let i = 0; i < n; i++) {
        const x = values[i].x | 0, y = values[i].y | 0;
        res[i * 4] = x & 0xff; res[i * 4 + 1] = (x >>> 8) & 0xff;
        res[i * 4 + 2] = y & 0xff; res[i * 4 + 3] = (y >>> 8) & 0xff;
      }
      put(res);
      break;
    }
    case T.CFrame: {
      for (const v of values) {
        const rot = (v.rotation || [1, 0, 0, 0, 1, 0, 0, 0, 1]).map((x) => (x === 0 ? 0 : x));
        const known = CF_ROT_INDEX.get(rot.join(','));
        if (known !== undefined) {
          put8(known);
        } else {
          put8(0);
          for (const f of rot) put(new Uint8Array(new Float32Array([f]).buffer));
        }
      }
      put(interleaved(12, n, (i) => {
        const p = values[i].position || [0, 0, 0];
        return concatU8(rfloatBytes(p[0] || 0), rfloatBytes(p[1] || 0), rfloatBytes(p[2] || 0));
      }));
      break;
    }
    case T.Token:
      put(interleaved(4, n, (i) => new Uint8Array([(values[i] >>> 24) & 0xff, (values[i] >>> 16) & 0xff, (values[i] >>> 8) & 0xff, values[i] & 0xff])));
      break;
    case T.Reference:
      put(putRefsBytes(values));
      break;
    case T.Vector3int16: {
      const res = new Uint8Array(6 * n);
      for (let i = 0; i < n; i++) {
        const v = values[i];
        const w = (o, val) => { res[i * 6 + o] = val & 0xff; res[i * 6 + o + 1] = (val >>> 8) & 0xff; };
        w(0, v.x | 0); w(2, v.y | 0); w(4, v.z | 0);
      }
      put(res);
      break;
    }
    case T.NumberRange:
      for (const v of values) { put(new Uint8Array(new Float32Array([v.min || 0]).buffer)); put(new Uint8Array(new Float32Array([v.max || 0]).buffer)); }
      break;
    case T.NumberSequence:
      for (const v of values) {
        const kp = v || [];
        put32(kp.length);
        for (const k of kp) {
          put(new Uint8Array(new Float32Array([k.time || 0, k.value || 0, k.envelope || 0]).buffer));
        }
      }
      break;
    case T.ColorSequence:
      for (const v of values) {
        const kp = v || [];
        put32(kp.length);
        for (const k of kp) {
          put(new Uint8Array(new Float32Array([k.time || 0, k.r || 0, k.g || 0, k.b || 0, k.envelope || 0]).buffer));
        }
      }
      break;
    case T.PhysicalProperties:
      for (const v of values) {
        if (v && v.custom) {
          put8(1);
          put(new Uint8Array(new Float32Array([v.density || 0, v.friction || 0, v.elasticity || 0, v.frictionWeight || 0, v.elasticityWeight || 0]).buffer));
        } else {
          put8(0);
        }
      }
      break;
    case T.Color3uint8:
      put(interleaved(3, n, (i) => new Uint8Array([(values[i].r * 255) | 0, (values[i].g * 255) | 0, (values[i].b * 255) | 0])));
      break;
    case T.Ray:
      for (const v of values) {
        put(new Uint8Array(new Float32Array([
          v.origin[0], v.origin[1], v.origin[2], v.direction[0], v.direction[1], v.direction[2],
        ]).buffer));
      }
      break;
    default:
      throw new Error('Cannot encode value type 0x' + typeId.toString(16));
  }
}

function concatU8(...arrs) {
  const total = arrs.reduce((a, b) => a + b.length, 0);
  const res = new Uint8Array(total);
  let o = 0;
  for (const b of arrs) { res.set(b, o); o += b.length; }
  return res;
}

function putRefsBytes(ids) {
  return putRefs(ids);
}

const CF_ROT_INDEX = new Map();
for (const [id, v] of CF_ROT_PAIRS) CF_ROT_INDEX.set(v.map((x) => (x === 0 ? 0 : x)).join(','), id);
