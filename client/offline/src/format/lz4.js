// LZ4 block format decoder (pure JS, no dependencies).
// Used to decompress RBXL chunk payloads. See: https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md

export function lz4DecompressBlock(src, dstSize) {
  if (!dstSize) dstSize = 0;
  const dst = new Uint8Array(dstSize || src.length);
  let sPos = 0;
  let dPos = 0;

  while (sPos < src.length) {
    // Token
    let token = src[sPos++];
    let litLen = token >> 4;
    let matchLen = (token & 0x0F) + 4;

    // Literal length extension
    if (litLen === 15) {
      while (true) {
        const b = src[sPos++];
        litLen += b;
        if (b !== 255) break;
      }
    }
    // Copy literals
    if (litLen > 0) {
      if (litLen === 15 && sPos >= src.length) {
        // Degenerate trailing 15 with no following byte
        litLen = 0;
      } else {
        dst.set(src.subarray(sPos, sPos + litLen), dPos);
        sPos += litLen;
        dPos += litLen;
      }
    }

    // If at the end of the source, this was the final sequence (no match).
    if (sPos >= src.length) break;

    // Match offset (2 bytes LE)
    const offset = src[sPos] | (src[sPos + 1] << 8);
    sPos += 2;

    // Match length extension
    if (matchLen === 15 + 4) {
      while (true) {
        const b = src[sPos++];
        matchLen += b;
        if (b !== 255) break;
      }
    }

    if (offset === 0) {
      // Some encoders emit a zero offset as a trailing marker; stop.
      break;
    }
    if (offset > dPos) {
      throw new Error('LZ4: invalid match offset ' + offset);
    }

    // Copy match (may overlap -> byte-by-byte)
    let mPos = dPos - offset;
    for (let i = 0; i < matchLen; i++) {
      dst[dPos++] = dst[mPos++];
    }
  }

  if (dstSize && dPos !== dstSize) {
    throw new Error('LZ4: decompressed ' + dPos + ' bytes, expected ' + dstSize);
  }
  return dPos === dst.length ? dst : dst.subarray(0, dPos);
}
