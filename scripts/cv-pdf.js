#!/usr/bin/env node
/**
 * Prints CV HTML files to PDF with headless Chrome.
 *
 *   node scripts/cv-pdf.js                 cv/index.html → cv/Adrian-Gora-CV-EN.pdf, cv/pl.html → cv/Adrian-Gora-CV-PL.pdf
 *   node scripts/cv-pdf.js path/to/x.html  → path/to/x.pdf
 *
 * Chrome is found at CHROME_PATH, then the usual macOS and Linux locations.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const chrome = CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('Chrome not found; set CHROME_PATH');
  process.exit(1);
}

const jobs = process.argv.slice(2).length
  ? process.argv.slice(2).map((f) => [path.resolve(f), path.resolve(f).replace(/\.html$/, '.pdf')])
  : [['cv/index.html', 'cv/Adrian-Gora-CV-EN.pdf'], ['cv/pl.html', 'cv/Adrian-Gora-CV-PL.pdf']].map(([h, p]) => [path.join(ROOT, h), path.join(ROOT, p)]);

for (const [html, pdf] of jobs) {
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-pdf-header-footer',
    '--virtual-time-budget=8000',
    `--print-to-pdf=${pdf}`,
    `file://${html}`,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  console.log(`${path.relative(ROOT, pdf)} (${Math.round(fs.statSync(pdf).size / 1024)} KB)`);
}
