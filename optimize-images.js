/*
 * optimize-images.js — shrink oversized photos so they don't slow the site.
 *
 * What it does (in place, in the repo):
 *   - Walks assets/ for .jpg/.jpeg/.png files.
 *   - Any image wider than MAX_WIDTH or heavier than SIZE_THRESHOLD is
 *     resized to at most MAX_WIDTH px wide and re-encoded with sensible
 *     compression (mozjpeg for JPEG, palette/effort for PNG), metadata stripped.
 *   - Idempotent: already-small images are skipped, so re-running is safe and
 *     re-running after adding new photos only touches the new ones.
 *
 * Usage:
 *   node optimize-images.js            # optimize assets/ in place
 *   node optimize-images.js --dry      # report what would change, touch nothing
 *
 * Requires the optional dependency `sharp` (npm install). build.js calls this
 * automatically when sharp is present, and silently skips it when it isn't —
 * so committing already-optimized files is what guarantees fast delivery on the
 * production build host.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ASSET_DIR = path.join(ROOT, 'assets');
const MAX_WIDTH = 1280;          // px — ample for retina at our layout widths (max content ~1000px; hero column ~600px @2x)
const SIZE_THRESHOLD = 150 * 1024; // 150 KB — above this (even within width) recompress; below, leave it alone
const JPEG_QUALITY = 82;
const DRY = process.argv.includes('--dry');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('optimize-images: `sharp` is not installed — run `npm install`. Skipping.');
  process.exit(0); // non-fatal: build.js treats a missing optimizer as "copy as-is"
}

const exts = new Set(['.jpg', '.jpeg', '.png']);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (exts.has(path.extname(entry.name).toLowerCase())) acc.push(p);
  }
  return acc;
}

function fmtKB(n) { return (n / 1024).toFixed(0) + 'KB'; }

(async () => {
  const files = walk(ASSET_DIR);
  let optimized = 0, skipped = 0, savedBytes = 0;

  for (const file of files) {
    const before = fs.statSync(file).size;
    let meta;
    try { meta = await sharp(file).metadata(); } catch (e) {
      console.warn(`  ! could not read ${path.relative(ROOT, file)} (${e.message})`);
      continue;
    }
    const tooWide = (meta.width || 0) > MAX_WIDTH;
    const tooHeavy = before > SIZE_THRESHOLD;
    if (!tooWide && !tooHeavy) { skipped++; continue; }

    const ext = path.extname(file).toLowerCase();
    let pipeline = sharp(file).rotate(); // respect EXIF orientation, then strip metadata by default
    if (tooWide) pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: 9, palette: true, effort: 8 });
    } else {
      pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true });
    }

    const rel = path.relative(ROOT, file);
    if (DRY) {
      console.log(`  would optimize ${rel}  (${meta.width}px, ${fmtKB(before)})`);
      optimized++;
      continue;
    }

    try {
      const buf = await pipeline.toBuffer();
      // only rewrite if we actually made it smaller
      if (buf.length < before) {
        fs.writeFileSync(file, buf);
        savedBytes += before - buf.length;
        optimized++;
        console.log(`  ✓ ${rel}  ${meta.width}px ${fmtKB(before)} -> ${fmtKB(buf.length)}`);
      } else {
        skipped++;
      }
    } catch (e) {
      console.warn(`  ! failed ${rel} (${e.message})`);
    }
  }

  console.log(`optimize-images: ${optimized} optimized, ${skipped} left as-is, ${fmtKB(savedBytes)} saved.${DRY ? ' (dry run)' : ''}`);
})();
