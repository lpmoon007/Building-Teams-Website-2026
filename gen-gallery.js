/**
 * gen-gallery.js — build the filterable /gallery/ grid from assets/gallery/<category>/.
 *
 * For every image under assets/gallery/<category>/:
 *   - bakes in EXIF orientation, resizes to <= MAX_WIDTH, re-encodes (in place)
 *     with the SAME settings as optimize-images.js, so the main build skips them
 *     (no re-compression churn), and writes a .webp sibling.
 * Then rewrites the tabs + grid inside Gallery.html between the marker comments.
 *
 * Filenames are emitted verbatim (spaces and all): build.js's wrapPictures matches
 * spaced paths and finds the same-name .webp by exact path, so <picture> still works.
 * Re-run this whenever new photos are added to a gallery folder.
 *
 *   NODE_PATH="$(npm root -g)" node gen-gallery.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const GAL = path.join(ROOT, 'assets', 'gallery');
const PAGE = path.join(ROOT, 'Gallery.html');
const MAX_WIDTH = 1280, JPEG_QUALITY = 82, WEBP_QUALITY = 82;

let sharp;
try { sharp = require('sharp'); }
catch (e) { console.error('gen-gallery: `sharp` not found. Run with NODE_PATH="$(npm root -g)".'); process.exit(1); }

// Human labels + display order. Categories with no images are skipped automatically.
const LABELS = {
  'bike-build': 'Bike Builds',
  'housewarming': 'Housewarming',
  'skateboard-build': 'Skateboard Builds',
  'shoe-build': 'Shoe Builds',
  'care-cart': 'Care Cart',
  'scale': 'Large-Scale',
  'reveals': 'The Reveals',
  'conference': 'Conference',
  'executive': 'Executive',
  'operation-you-matter': 'Operation You Matter',
  '60-seconds-to-give': '60 Seconds to Give',
  'children': 'Kids We Serve',
};
const ORDER = ['bike-build', 'housewarming', 'skateboard-build', 'shoe-build', 'scale', 'reveals', 'conference', 'executive', 'care-cart', 'operation-you-matter'];

const IMG_RE = /\.(jpe?g|png)$/i;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Turn a filename into readable alt text. Non-descriptive camera names fall back
// to the category label so we never ship "IMG_5911" as alt text.
function altFor(file, catLabel) {
  const base = path.basename(file, path.extname(file));
  const junk = /^(img|dsc|dscn|dscf|pict|picture|photo|image|p\d|100_|n\d|screenshot)/i;
  if (junk.test(base) || /^[\d_\-\s]+$/.test(base)) return `${catLabel} — a Building Teams give-back team building event`;
  const words = base.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const titled = words.replace(/\b\w/g, (c) => c.toUpperCase());
  return `${titled} — ${catLabel} team building with Building Teams`;
}

async function processImage(abs) {
  const ext = path.extname(abs).toLowerCase();
  let pipe = sharp(abs).rotate(); // bake EXIF orientation
  const meta = await sharp(abs).metadata();
  if ((meta.width || 0) > MAX_WIDTH) pipe = pipe.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  pipe = ext === '.png'
    ? pipe.png({ compressionLevel: 9, palette: true, effort: 8 })
    : pipe.jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true });
  const buf = await pipe.toBuffer();
  fs.writeFileSync(abs, buf);
  const dim = await sharp(buf).metadata();           // dims AFTER rotate/resize
  const webp = abs.replace(IMG_RE, '.webp');
  const wbuf = await sharp(buf).webp({ quality: WEBP_QUALITY, effort: 6 }).toBuffer();
  fs.writeFileSync(webp, wbuf);
  return { w: dim.width, h: dim.height };
}

(async () => {
  const cats = fs.readdirSync(GAL, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));

  const tabs = ['<button class="gtab is-on" data-cat="all" type="button">All</button>'];
  const items = [];
  let total = 0;

  // Collect image paths relative to a category dir, recursing one+ levels into
  // any mission/sub-folders (e.g. operation-you-matter/<mission>/photo.png).
  function collect(dir, rel = '') {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) out.push(...collect(path.join(dir, e.name), r));
      else if (IMG_RE.test(e.name)) out.push(r);
    }
    return out;
  }

  for (const cat of cats) {
    const dir = path.join(GAL, cat);
    const files = collect(dir);
    if (!files.length) continue;
    const label = LABELS[cat] || cat.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    tabs.push(`<button class="gtab" data-cat="${cat}" type="button">${esc(label)} <span>${files.length}</span></button>`);
    for (const f of files) {
      const abs = path.join(dir, f);
      const { w, h } = await processImage(abs);
      const src = `assets/gallery/${cat}/${f}`;        // literal spaces OK; build wraps <picture>
      const alt = altFor(path.basename(f), label);
      items.push(
        `      <button type="button" class="gcell" data-cat="${cat}" data-full="${esc(src)}">` +
        `<img width="${w}" height="${h}" loading="lazy" src="${esc(src)}" alt="${esc(alt)}" /></button>`
      );
      total++;
    }
    console.log(`  ${cat}: ${files.length} photos`);
  }

  let html = fs.readFileSync(PAGE, 'utf8');
  html = html.replace(
    /<!--GALLERY-TABS-START-->[\s\S]*?<!--GALLERY-TABS-END-->/,
    `<!--GALLERY-TABS-START-->\n      ${tabs.join('\n      ')}\n      <!--GALLERY-TABS-END-->`
  );
  html = html.replace(
    /<!--GALLERY-GRID-START-->[\s\S]*?<!--GALLERY-GRID-END-->/,
    `<!--GALLERY-GRID-START-->\n${items.join('\n')}\n      <!--GALLERY-GRID-END-->`
  );
  fs.writeFileSync(PAGE, html);
  console.log(`Gallery: ${total} photos across ${tabs.length - 1} categories -> Gallery.html`);
})();
