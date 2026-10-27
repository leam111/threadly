// What kind of image is this, really?
// We look at the first bytes of the file (the "magic bytes"), never at the file name or at the
// type the client says: both are easy to fake. A file that is not JPEG, PNG or WebP gives null.
// The width and height are read from the image header when we can; if not, they are left out.

export type DetectedImage = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  // the file extension we use in the storage path
  ext: "jpg" | "png" | "webp";
  width?: number;
  height?: number;
};

export function detectImage(buffer: Buffer): DetectedImage | null {
  if (isPng(buffer)) {
    return { mimeType: "image/png", ext: "png", ...pngSize(buffer) };
  }
  if (isJpeg(buffer)) {
    return { mimeType: "image/jpeg", ext: "jpg", ...jpegSize(buffer) };
  }
  if (isWebp(buffer)) {
    return { mimeType: "image/webp", ext: "webp", ...webpSize(buffer) };
  }
  return null;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(buffer: Buffer, bytes: number[], offset = 0) {
  return buffer.length >= offset + bytes.length && bytes.every((b, i) => buffer[offset + i] === b);
}

function isPng(buffer: Buffer) {
  return startsWith(buffer, PNG_SIGNATURE);
}

function isJpeg(buffer: Buffer) {
  return startsWith(buffer, [0xff, 0xd8, 0xff]);
}

// "RIFF", 4 bytes of size, then "WEBP"
function isWebp(buffer: Buffer) {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

// a size only when both numbers are real (more than 0)
function size(width: number, height: number) {
  return width > 0 && height > 0 ? { width, height } : {};
}

// PNG: the first chunk (IHDR) holds the width and height at bytes 16 and 20
function pngSize(buffer: Buffer) {
  if (buffer.length < 24) {
    return {};
  }
  return size(buffer.readUInt32BE(16), buffer.readUInt32BE(20));
}

// JPEG: walk through the blocks ("segments") until the one that holds the size (a SOF block)
function jpegSize(buffer: Buffer) {
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) {
      return {};
    }
    const marker = buffer[i + 1];
    // SOF0 to SOF15 hold the size, except C4, C8 and CC (other kinds of blocks)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return size(buffer.readUInt16BE(i + 7), buffer.readUInt16BE(i + 5));
    }
    // skip this block: its length is in the 2 bytes after the marker
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  return {};
}

// WebP: three ways to store an image, each keeps the size in another place
function webpSize(buffer: Buffer) {
  if (buffer.length < 30) {
    return {};
  }
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    return size(buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff);
  }
  if (chunk === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return size((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8X") {
    return size(buffer.readUIntLE(24, 3) + 1, buffer.readUIntLE(27, 3) + 1);
  }
  return {};
}
