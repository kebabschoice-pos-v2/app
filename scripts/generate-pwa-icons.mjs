import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// CRC32 calculation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);
  const toCrc = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(toCrc), 8 + len);
  return chunk;
}

function generatePng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk("IHDR", ihdrData);

  // Raw image data with scanline filter byte 0
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  const cx = width / 2;
  const cy = height / 2;
  const rCard = width * 0.46;
  const cornerRadius = width * 0.22;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // filter type None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Check rounded squircle boundary
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const maxDist = Math.max(dx, dy);

      // Default dark theme background (#09090b -> #18181b)
      const gradRatio = (x + y) / (width + height);
      let r = Math.round(9 + gradRatio * 15);
      let g = Math.round(9 + gradRatio * 15);
      let b = Math.round(11 + gradRatio * 16);
      let a = 255;

      // Outer border effect
      const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      // Center glowing circle
      const distGlow = Math.sqrt((x - cx) ** 2 + (y - (cy - height * 0.05)) ** 2);
      if (distGlow < width * 0.35) {
        const glowFactor = Math.max(0, 1 - distGlow / (width * 0.35));
        // Add orange warmth
        r = Math.min(255, r + Math.round(249 * 0.35 * glowFactor));
        g = Math.min(255, g + Math.round(115 * 0.25 * glowFactor));
        b = Math.min(255, b + Math.round(22 * 0.15 * glowFactor));
      }

      // Kebab emblem drawing (stylized wrap in center)
      const nx = (x - cx) / (width * 0.32);
      const ny = (y - (cy - height * 0.05)) / (height * 0.32);

      // Skewer diagonal line: y - x approx 0
      const skewerDist = Math.abs(nx - ny * 0.8);
      if (skewerDist < 0.04 && Math.abs(nx) < 0.8 && Math.abs(ny) < 0.8) {
        // Skewer steel/gold
        r = 250;
        g = 204;
        b = 21;
      }

      // Kebab meat layers (3 layered rounds)
      for (const [layerY, lRadius, lr, lg, lb] of [
        [-0.45, 0.28, 249, 115, 22], // Orange top
        [-0.05, 0.35, 234, 88, 12],  // Amber middle
        [0.35, 0.30, 249, 115, 22],  // Orange bottom
      ]) {
        const dLayer = Math.sqrt(nx ** 2 + ((ny - layerY) * 1.5) ** 2);
        if (dLayer < lRadius) {
          // Inner core highlight
          const hl = 1 - dLayer / lRadius;
          r = Math.round(lr * (0.8 + 0.4 * hl));
          g = Math.round(lg * (0.8 + 0.4 * hl));
          b = Math.round(lb * (0.8 + 0.4 * hl));
        }
      }

      // Bottom badge for POS tag
      const badgeY = cy + height * 0.32;
      const badgeH = height * 0.08;
      const badgeW = width * 0.36;
      if (Math.abs(y - badgeY) < badgeH / 2 && Math.abs(x - cx) < badgeW / 2) {
        r = 249;
        g = 115;
        b = 22;
      }

      rawData[pxOffset] = Math.min(255, Math.max(0, r));
      rawData[pxOffset + 1] = Math.min(255, Math.max(0, g));
      rawData[pxOffset + 2] = Math.min(255, Math.max(0, b));
      rawData[pxOffset + 3] = a;
    }
  }

  // Compress with zlib
  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk("IDAT", compressedData);

  // IEND
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate files
const iconsDir = path.resolve(process.cwd(), "public/icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Generate SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="50%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <rect x="8" y="8" width="496" height="496" rx="104" fill="none" stroke="#27272a" stroke-width="4"/>
  <circle cx="256" cy="225" r="130" fill="#f97316" opacity="0.18" filter="url(#glow)" />

  <g transform="translate(256, 215) scale(1.1)">
    <!-- Skewer / Base -->
    <path d="M-80,-80 L80,80" stroke="url(#goldGrad)" stroke-width="12" stroke-linecap="round"/>
    
    <!-- Outer Kebab Wrap Outline -->
    <path d="M-80,-20 C-80,-80 0,-110 0,-110 C0,-110 80,-80 80,-20 C80,60 10,105 0,105 C-10,105 -80,60 -80,-20 Z" 
          fill="none" stroke="url(#goldGrad)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Meat Layers & Grill Marks -->
    <path d="M-55,-40 C-15,-55 35,-35 55,-40" fill="none" stroke="url(#accentGrad)" stroke-width="14" stroke-linecap="round"/>
    <path d="M-60,5 C-20,20 30,0 60,5" fill="none" stroke="url(#accentGrad)" stroke-width="14" stroke-linecap="round"/>
    <path d="M-50,48 C-15,35 20,52 50,48" fill="none" stroke="url(#accentGrad)" stroke-width="14" stroke-linecap="round"/>

    <!-- Central Flame Core -->
    <path d="M0,-80 C-22,-40 -18,-10 0,20 C18,-10 22,-40 0,-80 Z" fill="url(#accentGrad)" filter="url(#glow)"/>
    <path d="M0,-50 C-8,-25 -6,-5 0,10 C6,-5 8,-25 0,-50 Z" fill="#ffffff" opacity="0.9"/>
  </g>

  <text x="256" y="392" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', Inter, sans-serif" font-size="34" font-weight="900" fill="#ffffff" letter-spacing="4">KEBABS CHOICE</text>
  <rect x="186" y="415" width="140" height="28" rx="14" fill="url(#accentGrad)"/>
  <text x="256" y="435" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', Inter, sans-serif" font-size="16" font-weight="800" fill="#ffffff" letter-spacing="2">POS V2.0</text>
</svg>`;

fs.writeFileSync(path.join(iconsDir, "icon.svg"), svgContent);
console.log("Created public/icons/icon.svg");

// 2. Generate 192x192 PNG
const png192 = generatePng(192, 192);
fs.writeFileSync(path.join(iconsDir, "icon-192x192.png"), png192);
console.log("Created public/icons/icon-192x192.png (" + png192.length + " bytes)");

// 3. Generate 512x512 PNG
const png512 = generatePng(512, 512);
fs.writeFileSync(path.join(iconsDir, "icon-512x512.png"), png512);
console.log("Created public/icons/icon-512x512.png (" + png512.length + " bytes)");
