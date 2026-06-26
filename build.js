#!/usr/bin/env node
'use strict';

/*
 * build.js — turns the editable, pretty-named source HTML in the repo root into
 * a clean-URL `dist/` tree ready to drop on the server.
 *
 * What it does
 *   1. Reads each page's <link rel="canonical"> to decide its production path
 *      (e.g. About.html -> /about/  ->  dist/about/index.html).
 *   2. Rewrites every internal link (Foo.html) to its clean URL and every
 *      relative asset path (assets/...) to root-absolute (/assets/...), so
 *      links resolve from any folder depth.
 *   3. Copies assets/ and the top-level config files (.htaccess, sitemap.xml,
 *      robots.txt, llms.txt, site.webmanifest, 404.html) into dist/.
 *   4. Excludes the alternate homepages and internal working docs.
 *
 * No dependencies — Node's built-in fs/path only.  Run:  node build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const ORIGIN = 'https://www.buildingteams.com';

// Pages that must never appear in the build: the two alternate homepage
// concepts (only Homepage C ships, as "/") and the internal working docs.
// These mirror the entries in .gitignore so source and build agree.
const EXCLUDE = new Set([
  'Homepage A - Bold Editorial.html',
  'Homepage B - Energetic Photo-forward.html',
  'Strategy Brief.html',
  'Deployment Guide.html',
  'Directions.html',
  'Lost-Link Outreach Templates.html',
  'Spam Cleanup Checklist.html',
  'Launch & Growth Plan.html',
  'State of Team Building 2026-print.html',
]);

// Non-page top-level files copied verbatim into dist/ root.
const COPY_FILES = [
  '.htaccess',
  'sitemap.xml',
  'robots.txt',
  'llms.txt',
  'site.webmanifest',
  '404.html',
];

// Directories copied verbatim (recursively) into dist/.
const COPY_DIRS = ['assets'];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function canonicalOf(html) {
  const tag = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i);
  if (!tag) return null;
  const href = tag[0].match(/\bhref=["']([^"']+)["']/i);
  return href ? href[1] : null;
}

// canonical URL/path -> root-absolute path ("/about/")
function toAbsPath(u) {
  if (u.startsWith(ORIGIN)) u = u.slice(ORIGIN.length);
  if (!u.startsWith('/')) u = '/' + u;
  return u;
}

// root-absolute path ("/about/") -> dist file path ("about/index.html")
function distFileFor(absPath) {
  let rel = absPath.replace(/^\/+/, '');
  if (rel === '') return 'index.html';
  if (rel.endsWith('/')) return rel + 'index.html';
  if (!path.extname(rel)) return rel + '/index.html';
  return rel;
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ---------------------------------------------------------------------------
// 1. discover pages + build the source-filename -> clean-URL map
// ---------------------------------------------------------------------------

const htmlFiles = fs
  .readdirSync(ROOT)
  .filter((f) => f.toLowerCase().endsWith('.html'))
  .filter((f) => !EXCLUDE.has(f) && f !== '404.html');

// Map every linkable source filename to its root-absolute clean URL.
const linkMap = new Map(); // "About.html" -> "/about/"
const pages = []; // { file, absPath, distFile }

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const canonical = canonicalOf(html);
  if (!canonical) {
    console.warn(`  ! skipping (no canonical): ${file}`);
    continue;
  }
  const absPath = toAbsPath(canonical);
  linkMap.set(file, absPath);
  pages.push({ file, absPath, distFile: distFileFor(absPath) });
}

// ---------------------------------------------------------------------------
// 2. rewrite + emit each page
// ---------------------------------------------------------------------------

// Decode minimal HTML entities so values like "Foo &amp; Bar.html" match files.
function decode(v) {
  return v.replace(/&amp;/g, '&');
}

function rewriteValue(value) {
  const v = decode(value);
  // Internal page link -> clean URL, preserving any #fragment / ?query suffix.
  const suffix = v.match(/[#?].*$/);
  const base = suffix ? v.slice(0, suffix.index) : v;
  if (linkMap.has(base)) return linkMap.get(base) + (suffix ? suffix[0] : '');
  // Relative asset path -> root-absolute. Leave already-absolute / external /
  // anchor / tel / mailto values untouched.
  if (/^\.?\/?assets\//.test(v) && !v.startsWith('/')) {
    return '/' + v.replace(/^\.\//, '');
  }
  return value; // unchanged (preserve original entity encoding)
}

function rewriteHtml(html) {
  return html.replace(
    /\b(href|src)=("|')([^"']*)\2/gi,
    (m, attr, q, value) => `${attr}=${q}${rewriteValue(value)}${q}`
  );
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

console.log(`Building dist/ (${pages.length} pages)…`);
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page.file), 'utf8');
  const out = rewriteHtml(html);
  const dest = path.join(DIST, page.distFile);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  console.log(`  ${page.file}  ->  ${page.absPath}`);
}

// 404.html: rewrite links but keep it at dist/404.html (referenced by ErrorDocument).
{
  const p = path.join(ROOT, '404.html');
  if (fs.existsSync(p)) {
    fs.writeFileSync(path.join(DIST, '404.html'), rewriteHtml(fs.readFileSync(p, 'utf8')));
  }
}

// Copy config files + asset dirs verbatim.
for (const f of COPY_FILES) {
  if (f === '404.html') continue; // already written above
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, f));
  else console.warn(`  ! missing config file: ${f}`);
}
for (const d of COPY_DIRS) {
  const src = path.join(ROOT, d);
  if (fs.existsSync(src)) copyDir(src, path.join(DIST, d));
  else console.warn(`  ! missing asset dir: ${d}`);
}

console.log(`Done. ${pages.length} pages + 404 + assets written to dist/.`);
