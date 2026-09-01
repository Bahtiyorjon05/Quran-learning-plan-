/**
 * Turns the master logo into the assets the app actually ships.
 *
 * The source is a wide artboard with the seal centred on cream paper. Shipping
 * that directly would be wrong twice over: six megabytes for a 28px header, and
 * a cream rectangle sitting on a near-black page. So we find the seal, crop to
 * it, mask it to a circle so the corners go transparent, and emit only the
 * sizes that are used.
 *
 *   npm run brand:build
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "brand/ahd-source.png");
const OUT = path.join(ROOT, "public/brand");
const APP = path.join(ROOT, "src/app");

/** Ink, matching --surface-base, for assets that need an opaque ground. */
const INK = { r: 6, g: 9, b: 8, alpha: 1 };

/**
 * Find the seal by colour, not by brightness.
 *
 * The first attempt compared each pixel to the corner colour, and the paper's
 * subtle texture and vignette tripped the threshold at the very edge of the
 * artboard — so the "seal" came out as the whole canvas and the mask sliced
 * through it. Saturation is the honest signal here: the paper is neutral cream
 * (r ≈ g ≈ b) while every part of the seal is teal or gold.
 *
 * Rows and columns are then accepted only if enough saturated pixels land in
 * them, which ignores stray specks like the small sparkle in the corner.
 */
async function findSeal(file: string) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const colHits = new Uint32Array(width);
  const rowHits = new Uint32Array(height);

  const SATURATION = 26;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      if (saturation > SATURATION) {
        colHits[x]++;
        rowHits[y]++;
      }
    }
  }

  /* A row or column counts only if at least this share of it is coloured, so a
     handful of stray pixels cannot stretch the box. */
  const colFloor = Math.max(4, height * 0.01);
  const rowFloor = Math.max(4, width * 0.01);

  const firstAbove = (counts: Uint32Array, floor: number) =>
    counts.findIndex((n) => n >= floor);
  const lastAbove = (counts: Uint32Array, floor: number) => {
    for (let i = counts.length - 1; i >= 0; i--) if (counts[i] >= floor) return i;
    return -1;
  };

  const minX = firstAbove(colHits, colFloor);
  const maxX = lastAbove(colHits, colFloor);
  const minY = firstAbove(rowHits, rowFloor);
  const maxY = lastAbove(rowHits, rowFloor);

  if (minX < 0 || minY < 0 || maxX <= minX || maxY <= minY) {
    throw new Error("could not locate the seal");
  }

  /* Square it around the centre, with a little breathing room so the outer ring
     is not shaved by the circular mask. */
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const side = Math.max(maxX - minX, maxY - minY) * 1.02;

  const left = Math.round(Math.max(0, Math.min(cx - side / 2, width - side)));
  const top = Math.round(Math.max(0, Math.min(cy - side / 2, height - side)));
  const size = Math.round(Math.min(side, width - left, height - top));

  console.log(
    `  colour bounds x ${minX}..${maxX}, y ${minY}..${maxY} (canvas ${width}x${height})`,
  );

  return { left, top, width: size, height: size };
}

/** A circle mask, so the paper corners become transparent. */
function circleMask(size: number, inset = 0) {
  const r = size / 2 - inset;
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="#fff"/></svg>`,
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const box = await findSeal(SOURCE);
  console.log(`seal found at ${box.left},${box.top} — ${box.width}px square`);

  /* A 1024 master, circular, transparent outside. The 2px inset trims the
     anti-aliased cream fringe that would otherwise ring the edge on dark. */
  const MASTER = 1024;
  const master = await sharp(SOURCE)
    .extract(box)
    .resize(MASTER, MASTER, { fit: "cover" })
    .composite([{ input: circleMask(MASTER, 2), blend: "dest-in" }])
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  const emit = async (file: string, buffer: Buffer) => {
    await writeFile(file, buffer);
    console.log(`  ${path.relative(ROOT, file)}  ${(buffer.length / 1024).toFixed(1)} KB`);
  };

  await emit(path.join(OUT, "mark-1024.png"), master);

  for (const size of [512, 256, 128, 64]) {
    await emit(
      path.join(OUT, `mark-${size}.png`),
      await sharp(master).resize(size, size).png({ compressionLevel: 9 }).toBuffer(),
    );
  }

  /* Next serves these conventionally from src/app — no <link> tags needed. */
  await emit(
    path.join(APP, "icon.png"),
    await sharp(master).resize(512, 512).png({ compressionLevel: 9 }).toBuffer(),
  );

  /* Apple refuses transparency on home-screen icons and composites black behind
     it, so this one gets the ink ground baked in. */
  await emit(
    path.join(APP, "apple-icon.png"),
    await sharp({
      create: { width: 180, height: 180, channels: 4, background: INK },
    })
      .composite([
        { input: await sharp(master).resize(156, 156).toBuffer(), gravity: "centre" },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer(),
  );

  /* Maskable icons, for the home screen.
     Android crops an installed icon to whatever shape the launcher uses — a
     circle, a squircle, a rounded square — and anything outside the middle 80%
     can be cut. A transparent circular seal survives none of that, so these get
     the ink ground and 20% padding the spec asks for. */
  for (const size of [192, 512]) {
    const inner = Math.round(size * 0.62);
    await emit(
      path.join(OUT, `maskable-${size}.png`),
      await sharp({
        create: { width: size, height: size, channels: 4, background: INK },
      })
        .composite([
          { input: await sharp(master).resize(inner, inner).toBuffer(), gravity: "centre" },
        ])
        .png({ compressionLevel: 9 })
        .toBuffer(),
    );
  }

  /* And a plain 192, the one size every manifest is expected to carry. */
  await emit(
    path.join(OUT, "mark-192.png"),
    await sharp(master).resize(192, 192).png({ compressionLevel: 9 }).toBuffer(),
  );

  /* Open Graph card: the seal on ink, at the size every social platform wants. */
  await emit(
    path.join(OUT, "og.png"),
    await sharp({
      create: { width: 1200, height: 630, channels: 4, background: INK },
    })
      .composite([
        { input: await sharp(master).resize(420, 420).toBuffer(), gravity: "centre" },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer(),
  );

  console.log("\ndone");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
