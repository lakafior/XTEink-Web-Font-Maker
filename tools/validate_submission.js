#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(msg) { console.error('VALIDATION FAILED:', msg); process.exit(1); }

function main() {
  // Optional path argument (useful for local testing); default to ./gallery
  const galleryDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(process.cwd(), 'gallery');

  if (!fs.existsSync(galleryDir)) {
    console.log('No gallery directory found — skipping');
    process.exit(0);
  }

  const entries = fs.readdirSync(galleryDir).filter(e => !e.startsWith('.'));
  if (entries.length === 0) fail('gallery directory is empty');

  for (const entry of entries) {
    const dir = path.join(galleryDir, entry);
    if (!fs.statSync(dir).isDirectory()) continue;
    const metaPath = path.join(dir, 'metadata.json');
    if (!fs.existsSync(metaPath)) fail(`${entry} missing metadata.json`);
    let meta;
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); }
    catch (err) { fail(`${entry} metadata.json is not valid JSON: ${err.message}`); }
    if (!meta.family || !meta.style) fail(`${entry} metadata must include family and style`);
  }

  console.log('Validation passed');
  process.exit(0);
}

main();
