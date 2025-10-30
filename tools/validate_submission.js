const fs = require('fs');
const path = require('path');

function fail(msg) { console.error('VALIDATION FAILED:', msg); process.exit(1); }

function main() {
  const galleryDir = path.join(process.cwd(), 'gallery');
  if (!fs.existsSync(galleryDir)) {
    console.log('No gallery directory changed — skipping');
    return;
  }

  const entries = fs.readdirSync(galleryDir);
  if (entries.length === 0) fail('gallery directory is empty');

  for (const entry of entries) {
    const dir = path.join(galleryDir, entry);
    if (!fs.statSync(dir).isDirectory()) continue;
    const metaPath = path.join(dir, 'metadata.json');
    if (!fs.existsSync(metaPath)) fail(`${entry} missing metadata.json`);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (!meta.family || !meta.style) fail(`${entry} metadata must include family and style`);
  }

  console.log('Validation passed');
}

main();
