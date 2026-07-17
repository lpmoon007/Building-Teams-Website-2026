#!/usr/bin/env node
'use strict';
/*
 * render-kits.js — render the downloadable lead-magnet kits in kits/*.html to
 * print-quality PDFs in assets/downloads/. Uses the globally-installed
 * Playwright + Chromium. Run:  NODE_PATH="$(npm root -g)" node render-kits.js
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'assets', 'downloads');
const KITS = [
  ['kits/event-planning-kit.html',          'event-planning-kit.pdf'],
  ['kits/corporate-retreat-kit.html',       'corporate-retreat-kit.pdf'],
  ['kits/leadership-team-health-check.html','leadership-team-health-check.pdf'],
  ['kits/make-it-stick-plan.html',          'make-it-stick-plan.pdf'],
];

const footer = `<div style="width:100%;font-family:sans-serif;font-size:7pt;color:#9aa0a8;padding:0 14mm;display:flex;justify-content:space-between;">
  <span>Building Teams · Be Legendary · buildingteams.com · 800-513-8759</span>
  <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const [src, out] of KITS) {
    const page = await browser.newPage();
    await page.goto('file://' + encodeURI(path.resolve(ROOT, src)), { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: path.join(OUT, out),
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footer,
      margin: { top: '13mm', bottom: '16mm', left: '13mm', right: '13mm' },
    });
    await page.close();
    console.log('  ✓', out, (fs.statSync(path.join(OUT, out)).size / 1024).toFixed(0) + 'KB');
  }
  await browser.close();
  console.log('render-kits: done →', path.relative(ROOT, OUT));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
