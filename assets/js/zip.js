const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = (year - 1980) << 9 | (date.getMonth() + 1) << 5 | date.getDate();
  return { time, date: day };
}

function writeU16(view, offset, value) { view.setUint16(offset, value, true); }
function writeU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

export async function createZip(entries) {
  const encoder = new TextEncoder();
  const prepared = [];
  let localSize = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name.replace(/^\/+/, ''));
    const data = entry.blob instanceof Blob ? new Uint8Array(await entry.blob.arrayBuffer()) : encoder.encode(String(entry.blob));
    const item = { nameBytes, data, crc: crc32(data), offset: localSize, ...dosDateTime(entry.date) };
    localSize += 30 + nameBytes.length + data.length;
    prepared.push(item);
  }

  const centralSize = prepared.reduce((sum, item) => sum + 46 + item.nameBytes.length, 0);
  const total = localSize + centralSize + 22;
  const output = new Uint8Array(total);
  const view = new DataView(output.buffer);
  let offset = 0;

  for (const item of prepared) {
    writeU32(view, offset, 0x04034b50); writeU16(view, offset + 4, 20); writeU16(view, offset + 6, 0x0800);
    writeU16(view, offset + 8, 0); writeU16(view, offset + 10, item.time); writeU16(view, offset + 12, item.date);
    writeU32(view, offset + 14, item.crc); writeU32(view, offset + 18, item.data.length); writeU32(view, offset + 22, item.data.length);
    writeU16(view, offset + 26, item.nameBytes.length); writeU16(view, offset + 28, 0);
    output.set(item.nameBytes, offset + 30); output.set(item.data, offset + 30 + item.nameBytes.length);
    offset += 30 + item.nameBytes.length + item.data.length;
  }

  const centralOffset = offset;
  for (const item of prepared) {
    writeU32(view, offset, 0x02014b50); writeU16(view, offset + 4, 20); writeU16(view, offset + 6, 20);
    writeU16(view, offset + 8, 0x0800); writeU16(view, offset + 10, 0); writeU16(view, offset + 12, item.time); writeU16(view, offset + 14, item.date);
    writeU32(view, offset + 16, item.crc); writeU32(view, offset + 20, item.data.length); writeU32(view, offset + 24, item.data.length);
    writeU16(view, offset + 28, item.nameBytes.length); writeU16(view, offset + 30, 0); writeU16(view, offset + 32, 0);
    writeU16(view, offset + 34, 0); writeU16(view, offset + 36, 0); writeU32(view, offset + 38, 0); writeU32(view, offset + 42, item.offset);
    output.set(item.nameBytes, offset + 46); offset += 46 + item.nameBytes.length;
  }

  writeU32(view, offset, 0x06054b50); writeU16(view, offset + 4, 0); writeU16(view, offset + 6, 0);
  writeU16(view, offset + 8, prepared.length); writeU16(view, offset + 10, prepared.length);
  writeU32(view, offset + 12, centralSize); writeU32(view, offset + 16, centralOffset); writeU16(view, offset + 20, 0);

  return new Blob([output], { type: 'application/zip' });
}
