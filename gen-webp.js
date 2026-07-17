#!/usr/bin/env node
'use strict';

/*
 * gen-webp.js — generate modern WebP siblings for raster photos.
 *
 * For every assets/*.{jpg,jpeg,png} it writes a same-name .webp beside the
 * original, but only keeps it when it is meaningfully smaller (< KEEP_RATIO of
 * the source). build.js wraps <img> tags whose source has a kept .webp in a
 * <picture> so modern browsers get WebP and everyone else falls back to the
 * original file — no browser is left with a broken image.
 *
 * Idempotent: a .webp that is already up to date (newer than its source) is
 * skipped, so re-running only touches new/changed photos.
 *
 * Usage:  node gen-webp.js            (build.js calls this automatically)
 *         node gen-webp.js --dry
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ASSET_DIR = path.join(ROOT, 'assets');
const QUALITY = 82;
const KEEP_RATIO = 0.92; // keep webp only if <=92% of the original's size
const DRY = process.argv.includes('--dry');

let sharp;
try { sharp = require('sharp'); }
catch (e) { console.error('gen-webp: `sharp` not installed — skipping.'); process.exit(0); }

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
const kb = (n) => (n / 1024).toFixed(0) + 'KB';

(async () => {
  const files = walk(ASSET_DIR);
  let made = 0, kept = 0, skipped = 0, removed = 0, saved = 0;

  for (const file of files) {
    const webp = file.replace(/\.(jpe?g|png)$/i, '.webp');
    const srcSize = fs.statSync(file).size;

    // up to date? skip.
    if (fs.existsSync(webp) && fs.statSync(webp).mtimeMs >= fs.statSync(file).mtimeMs) {
      kept++; continue;
    }
    if (DRY) { made++; continue; }

    let buf;
    try { buf = await sharp(file).rotate().webp({ quality: QUALITY, effort: 6 }).toBuffer(); }
    catch (e) { console.warn(`  ! ${path.relative(ROOT, file)} (${e.message})`); continue; }

    if (buf.length <= srcSize * KEEP_RATIO) {
      fs.writeFileSync(webp, buf);
      saved += srcSize - buf.length;
      made++;
      console.log(`  ✓ ${path.relative(ROOT, webp)}  ${kb(srcSize)} -> ${kb(buf.length)}`);
    } else {
      // not worth it — make sure no stale webp lingers
      if (fs.existsSync(webp)) { fs.unlinkSync(webp); removed++; }
      skipped++;
    }
  }
  console.log(`gen-webp: ${made} written, ${skipped} not-worth-it, ${kept} up-to-date, ${removed} stale-removed, ${kb(saved)} saved.${DRY ? ' (dry)' : ''}`);
})();
