const fs = require('fs');
const { execSync } = require('child_process');

// Create a simple 256x256 PNG using PowerShell, then convert to ICO
// Actually, let's just download a simple icon or create a valid ICO

// Create a minimal valid ICO with multiple sizes
const sizes = [16, 32, 48, 256];

function createPngData(size, r, g, b) {
  // Raw BGRA pixel data for a solid color
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = b;      // B
    pixels[i * 4 + 1] = g;  // G
    pixels[i * 4 + 2] = r;  // R
    pixels[i * 4 + 3] = 255; // A
  }
  
  // We need BMP format inside ICO (not PNG) for compatibility
  const bmpHeader = Buffer.alloc(40);
  bmpHeader.writeUInt32LE(40, 0);        // Header size
  bmpHeader.writeInt32LE(size, 4);       // Width
  bmpHeader.writeInt32LE(size * 2, 8);   // Height (XOR + AND mask)
  bmpHeader.writeUInt16LE(1, 12);        // Planes
  bmpHeader.writeUInt16LE(32, 14);       // Bits per pixel
  bmpHeader.writeUInt32LE(0, 16);        // Compression
  
  // Row size must be multiple of 4
  const rowSize = ((size * 32 + 31) / 32) * 4;
  const andMaskRowBytes = ((size + 31) / 32) * 4;
  const andMask = Buffer.alloc(andMaskRowBytes * size, 0x00);
  
  // BMP rows are bottom-up for ICO
  const xorMask = Buffer.alloc(rowSize * size);
  for (let y = 0; y < size; y++) {
    const srcRow = (size - 1 - y) * size * 4;
    const dstRow = y * rowSize;
    for (let x = 0; x < size; x++) {
      xorMask[dstRow + x * 4] = pixels[srcRow + x * 4];
      xorMask[dstRow + x * 4 + 1] = pixels[srcRow + x * 4 + 1];
      xorMask[dstRow + x * 4 + 2] = pixels[srcRow + x * 4 + 2];
      xorMask[dstRow + x * 4 + 3] = pixels[srcRow + x * 4 + 3];
    }
  }
  
  return Buffer.concat([bmpHeader, xorMask, andMask]);
}

// Build ICO
const iconColor = { r: 99, g: 102, b: 241 };  // #6366f1
const images = sizes.map(s => createPngData(s, iconColor.r, iconColor.g, iconColor.b));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);      // Reserved
header.writeUInt16LE(1, 2);      // Type: ICO
header.writeUInt16LE(sizes.length, 4);  // Count

let offset = 6 + sizes.length * 16;
const dirEntries = [];
const dataBuffers = [];

for (let i = 0; i < sizes.length; i++) {
  const size = sizes[i];
  const data = images[i];
  
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);   // Width
  entry.writeUInt8(size >= 256 ? 0 : size, 1);   // Height
  entry.writeUInt8(0, 2);   // Colors
  entry.writeUInt8(0, 3);   // Reserved
  entry.writeUInt16LE(1, 4);  // Color planes
  entry.writeUInt16LE(32, 6); // Bits per pixel
  entry.writeUInt32LE(data.length, 8);  // Data size
  entry.writeUInt32LE(offset, 12);      // Offset
  
  dirEntries.push(entry);
  dataBuffers.push(data);
  offset += data.length;
}

const parts = [header, ...dirEntries, ...dataBuffers];
const ico = Buffer.concat(parts);

fs.writeFileSync('public/icon.ico', ico);
console.log('Icon created:', ico.length, 'bytes');
