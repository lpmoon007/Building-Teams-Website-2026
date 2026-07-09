/*
 * add-img-dimensions.js — inject width/height on <img> tags that reference
 * local assets, so the browser can reserve space and avoid layout shift (CLS).
 *
 * - Only touches <img> whose src points at a local asset (assets/... or /assets/...).
 * - Skips tags that already have a width= attribute (idempotent).
 * - Reads intrinsic pixel dimensions with sharp; CSS (max-width:100%;height:auto,
 *   plus object-fit rules) still controls actual rendering, so no distortion.
 *
 * Usage: node add-img-dimensions.js [--dry]
 * Requires sharp (same optional dep as optimize-images.js).
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DRY = process.argv.includes('--dry');

let sharp;
try { sharp = require('sharp'); }
catch (e) { console.error('add-img-dimensions: `sharp` not installed — run `npm install`. Skipping.'); process.exit(0); }

// collect source HTML files (exclude build output + deps)
function htmlFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'dist' || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const dimCache = new Map();
async function dims(assetRel) {
  if (dimCache.has(assetRel)) return dimCache.get(assetRel);
  const abs = path.join(ROOT, assetRel.replace(/^\//, ''));
  let d = null;
  if (fs.existsSync(abs)) {
    try { const m = await sharp(abs).metadata(); if (m.width && m.height) d = { w: m.width, h: m.height }; }
    catch (_) {}
  }
  dimCache.set(assetRel, d);
  return d;
}

(async () => {
  const files = htmlFiles(ROOT);
  let tagsUpdated = 0, filesChanged = 0, missing = new Set();

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    const imgRe = /<img\b[^>]*>/g;
    let changed = false;
    const replacements = [];

    let m;
    while ((m = imgRe.exec(html))) {
      const tag = m[0];
      if (/\swidth=/.test(tag)) continue;                 // already dimensioned
      const srcM = tag.match(/\ssrc="([^"]+)"/);
      if (!srcM) continue;
      const src = srcM[1];
      if (!/^\/?assets\//.test(src)) continue;            // local assets only
      replacements.push({ tag, src, index: m.index });
    }

    // resolve dims (async) then apply from end to start to keep indices valid
    for (let i = replacements.length - 1; i >= 0; i--) {
      const r = replacements[i];
      const d = await dims(r.src);
      if (!d) { missing.add(r.src); continue; }
      // insert width/height right after <img
      const newTag = r.tag.replace(/^<img\b/, `<img width="${d.w}" height="${d.h}"`);
      html = html.slice(0, r.index) + newTag + html.slice(r.index + r.tag.length);
      tagsUpdated++;
      changed = true;
    }

    if (changed) {
      filesChanged++;
      if (!DRY) fs.writeFileSync(file, html);
    }
  }

  console.log(`add-img-dimensions: ${tagsUpdated} <img> updated across ${filesChanged} files.${DRY ? ' (dry run)' : ''}`);
  if (missing.size) console.log(`  (skipped ${missing.size} srcs with no readable file: ${[...missing].slice(0, 8).join(', ')}${missing.size > 8 ? ' …' : ''})`);
})();
