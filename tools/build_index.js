#!/usr/bin/env node
// Simple builder that creates gallery/index.json from repo gallery folder
// Usage: node tools/build_index.js [rootDir]

const fs = require('fs');
const path = require('path');

const repoOwner = 'lakafior';
const repoName = 'XTEink-Web-Font-Maker';
const rootArg = process.argv[2] || '.';
const galleryDir = path.resolve(rootArg, 'gallery');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

if (!fs.existsSync(galleryDir)) {
  console.error('gallery/ directory not found at', galleryDir);
  process.exit(1);
}

const entries = fs.readdirSync(galleryDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort();

const out = [];
for (const slug of entries) {
  const dir = path.join(galleryDir, slug);
  const metaPath = path.join(dir, 'metadata.json');
  const previewThumb = fs.existsSync(path.join(dir, 'preview_thumb.png')) ? `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/gallery/${slug}/preview_thumb.png` : null;
  const preview = fs.existsSync(path.join(dir, 'preview.png')) ? `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/gallery/${slug}/preview.png` : null;
  const binFile = fs.readdirSync(dir).find(f => f.toLowerCase().endsWith('.bin'));
  const bin = binFile ? `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/gallery/${slug}/${binFile}` : null;

  const meta = readJson(metaPath) || { id: slug, family: slug, style: '', submitter: {}, timestamp: null };

  out.push({
    id: slug,
    family: meta.family || slug,
    style: meta.style || '',
    preview_text: meta.preview_text || '',
    preview_thumb: previewThumb,
    preview: preview,
    bin: bin,
    submitter: meta.submitter || {},
    timestamp: meta.timestamp || null,
    width: meta.width || null,
    height: meta.height || null
  });
}

// Build a tree grouped by family -> style -> sizes
const familyMap = new Map();
for (const e of out) {
  const fam = e.family || 'Unknown';
  const style = e.style || 'Regular';
  if (!familyMap.has(fam)) familyMap.set(fam, new Map());
  const styleMap = familyMap.get(fam);
  if (!styleMap.has(style)) styleMap.set(style, []);
  styleMap.get(style).push({
    id: e.id,
    width: e.width,
    height: e.height,
    preview_thumb: e.preview_thumb,
    preview: e.preview,
    bin: e.bin,
    submitter: e.submitter,
    timestamp: e.timestamp
  });
}

const tree = Array.from(familyMap.entries()).map(([family, styleMap]) => ({
  family,
  types: Array.from(styleMap.entries()).map(([style, sizes]) => ({
    style,
    sizes
  }))
}));

const indexObj = { entries: out, tree };
const indexPath = path.join(galleryDir, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify(indexObj, null, 2), 'utf8');
console.log('Wrote', indexPath, 'with', out.length, 'entries and', tree.length, 'families');
