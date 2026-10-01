const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8");

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function encodeUtf8(text) {
  return textEncoder.encode(text);
}

function decodeUtf8(bytes) {
  return textDecoder.decode(bytes);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toBytes(input) {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new Error("readZip 需要 ArrayBuffer 或 Uint8Array");
}

function contentToBytes(content) {
  if (typeof content === "string") {
    return encodeUtf8(content);
  }
  if (content instanceof Uint8Array) {
    return content;
  }
  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  if (ArrayBuffer.isView(content)) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  }
  throw new Error("writeZip 的 content 必须是 string 或 Uint8Array");
}

async function throughStream(stream, input) {
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const writePromise = (async () => {
    await writer.write(input);
    await writer.close();
  })();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    total += value.length;
  }
  await writePromise;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function deflateRaw(bytes) {
  if (typeof CompressionStream !== "function") {
    return null;
  }
  try {
    return await throughStream(new CompressionStream("deflate-raw"), bytes);
  } catch {
    return null;
  }
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("当前环境不支持 DecompressionStream，无法解压 deflate 数据");
  }
  return throughStream(new DecompressionStream("deflate-raw"), bytes);
}

function findEocd(bytes) {
  const minEocd = 22;
  const maxComment = 0xffff;
  const start = Math.max(0, bytes.length - minEocd - maxComment);
  for (let i = bytes.length - minEocd; i >= start; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}

export async function readZip(arrayBuffer) {
  const bytes = toBytes(arrayBuffer);
  if (bytes.length < 22) {
    throw new Error("不是有效的 ZIP 文件：长度不足");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(bytes);
  if (eocd < 0) {
    throw new Error("不是有效的 ZIP 文件：找不到中央目录结尾记录");
  }
  const totalEntries = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new Error("暂不支持 ZIP64 格式的压缩包");
  }
  if (cdOffset + cdSize > bytes.length) {
    throw new Error("ZIP 中央目录越界，文件可能已损坏");
  }

  const files = new Map();
  let cursor = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (cursor + 46 > bytes.length) {
      throw new Error("ZIP 中央目录项越界，文件可能已损坏");
    }
    if (view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("ZIP 中央目录项签名无效，文件可能已损坏");
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compSize = view.getUint32(cursor + 20, true);
    const uncompSize = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + nameLen + extraLen + commentLen;
    if (next > bytes.length) {
      throw new Error("ZIP 中央目录项长度越界，文件可能已损坏");
    }
    if ((flags & 0x0001) !== 0) {
      throw new Error("暂不支持加密的 ZIP 压缩包");
    }
    if (compSize === 0xffffffff || uncompSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error("暂不支持 ZIP64 格式的压缩包");
    }
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLen);
    const path = decodeUtf8(nameBytes);
    cursor = next;

    if (path.endsWith("/")) {
      continue;
    }
    if (localOffset + 30 > bytes.length) {
      throw new Error("ZIP 本地文件头越界，文件可能已损坏");
    }
    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error("ZIP 本地文件头签名无效，文件可能已损坏");
    }
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > bytes.length) {
      throw new Error("ZIP 数据区越界，文件可能已损坏");
    }
    const raw = bytes.subarray(dataStart, dataEnd);
    let content;
    if (method === 0) {
      content = raw.slice();
    } else if (method === 8) {
      content = await inflateRaw(raw);
    } else {
      throw new Error("不支持的 ZIP 压缩方法：" + method);
    }
    if (content.length !== uncompSize) {
      throw new Error("ZIP 解压后长度与记录不符，文件可能已损坏");
    }
    files.set(path, content);
  }
  return files;
}

export async function writeZip(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("writeZip 需要 entries 数组");
  }
  const parts = [];
  const centralParts = [];
  let offset = 0;
  let count = 0;

  for (const entry of entries) {
    if (!entry || typeof entry.path !== "string" || entry.path.length === 0) {
      throw new Error("writeZip 的每个条目都必须有非空的 path");
    }
    const nameBytes = encodeUtf8(entry.path);
    const contentBytes = contentToBytes(entry.content);
    const checksum = crc32(contentBytes);
    const compressed = await deflateRaw(contentBytes);
    const useDeflate = compressed !== null;
    const method = useDeflate ? 8 : 0;
    const data = useDeflate ? compressed : contentBytes;

    if (count >= 0xffff) {
      throw new Error("ZIP 条目数超过 65535，暂不支持 ZIP64");
    }
    if (nameBytes.length > 0xffff) {
      throw new Error("ZIP 路径过长：" + entry.path);
    }
    if (contentBytes.length > 0xffffffff || data.length > 0xffffffff || offset > 0xffffffff) {
      throw new Error("ZIP 包体积超过 4 GiB，暂不支持 ZIP64");
    }

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, contentBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, contentBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    parts.push(local, data);
    centralParts.push(central);
    offset += local.length + data.length;
    count++;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  if (offset + centralSize > 0xffffffff) {
    throw new Error("ZIP 包体积超过 4 GiB，暂不支持 ZIP64");
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, count, true);
  ev.setUint16(10, count, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const all = parts.concat(centralParts, [eocd]);
  const total = all.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let writeOffset = 0;
  for (const part of all) {
    out.set(part, writeOffset);
    writeOffset += part.length;
  }
  return out;
}
