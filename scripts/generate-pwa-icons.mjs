import sharp from 'sharp';
import { mkdirSync } from 'fs';

mkdirSync('public/icons', { recursive: true });

const scalePath = `
  <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
  <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
  <path d="M7 21h10" />
  <path d="M12 3v18" />
  <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
`;

// "any" purpose icon: rounded square, icon fills most of the canvas.
function anySvg(size) {
  const iconSize = size * (40 / 64);
  const offset = (size - iconSize) / 2;
  const scale = iconSize / 24;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF500F"/>
      <stop offset="100%" stop-color="#FF8700"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)"/>
  <g transform="translate(${offset},${offset}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${scalePath}
  </g>
</svg>`;
}

// Maskable icon: edge-to-edge fill (no rounding — the OS applies its own
// mask), icon kept within the ~80% safe zone so it survives circular crops.
function maskableSvg(size) {
  const iconSize = size * 0.5;
  const offset = (size - iconSize) / 2;
  const scale = iconSize / 24;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF500F"/>
      <stop offset="100%" stop-color="#FF8700"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <g transform="translate(${offset},${offset}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${scalePath}
  </g>
</svg>`;
}

const jobs = [
  ['public/icons/icon-192.png', anySvg(192), 192],
  ['public/icons/icon-512.png', anySvg(512), 512],
  ['public/icons/maskable-192.png', maskableSvg(192), 192],
  ['public/icons/maskable-512.png', maskableSvg(512), 512],
  ['public/apple-touch-icon.png', anySvg(180), 180],
];

for (const [path, svg, size] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path);
  console.log('wrote', path);
}
