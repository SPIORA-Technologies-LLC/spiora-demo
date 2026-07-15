import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "public", "icon1.jpg");
const outDir = path.join(root, "public", "icons");
const appDir = path.join(root, "src", "app");

const ICON_BG = "#000000";

async function loadSource() {
  return sharp(src).rotate().png().toBuffer();
}

function roundedRectMask(size) {
  const radius = Math.round(size * 0.18);
  return Buffer.from(
    `<svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`,
  );
}

async function buildAppIcon(size) {
  const source = await loadSource();

  const resized = await sharp(source)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  return sharp(resized)
    .composite([{ input: roundedRectMask(size), blend: "dest-in" }])
    .flatten({ background: ICON_BG })
    .png()
    .toBuffer();
}

async function buildMaskableIcon(size) {
  const source = await loadSource();
  const logoSize = Math.round(size * 0.82);

  const logo = await sharp(source)
    .resize(logoSize, logoSize, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: ICON_BG,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

async function buildSquareIcon(size) {
  const source = await loadSource();
  return sharp(source)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

async function writeIcon(buffer, filename) {
  await sharp(buffer).toFile(path.join(outDir, filename));
  console.log(`created ${filename}`);
}

fs.mkdirSync(outDir, { recursive: true });

const pwaTasks = [
  [192, "icon-192x192.png", buildAppIcon],
  [512, "icon-512x512.png", buildAppIcon],
  [192, "icon-maskable-192x192.png", buildMaskableIcon],
  [512, "icon-maskable-512x512.png", buildMaskableIcon],
];

for (const [size, filename, builder] of pwaTasks) {
  await writeIcon(await builder(size), filename);
}

await writeIcon(await buildSquareIcon(16), "favicon-16x16.png");
await writeIcon(await buildSquareIcon(32), "favicon-32x32.png");
await writeIcon(await buildSquareIcon(48), "favicon-48x48.png");
await writeIcon(await buildAppIcon(180), "apple-touch-icon.png");

const appIcon = await buildSquareIcon(512);
await sharp(appIcon).toFile(path.join(appDir, "icon.png"));
console.log("created src/app/icon.png");

const appleIcon = await buildAppIcon(180);
await sharp(appleIcon).toFile(path.join(appDir, "apple-icon.png"));
console.log("created src/app/apple-icon.png");

console.log("PWA icons generated from public/icon1.jpg");
