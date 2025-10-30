const OWNER = 'lakafior';
const REPO = 'XTEink-Web-Font-Maker';
const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPO}/contents/gallery`;

const root = document.getElementById('galleryRoot');

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const k of Object.keys(attrs)) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'text') e.textContent = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => { if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else if (c) e.appendChild(c); });
  return e;
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${r.statusText}`);
  return r.json();
}

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${r.statusText}`);
  return r.text();
}

async function loadGallery() {
  root.innerHTML = '';
  const grid = el('div', { class: 'gallery-grid' });
  root.appendChild(grid);

  let list;
  try {
    list = await fetchJson(API_ROOT);
  } catch (err) {
    root.innerHTML = '';
    root.appendChild(el('div', { class: 'loading', text: 'Failed to load gallery index. ' + err.message }));
    console.error(err);
    return;
  }

  // Filter for directories only (each submission is a directory)
  const dirs = Array.isArray(list) ? list.filter(i => i.type === 'dir') : [];
  if (dirs.length === 0) {
    root.innerHTML = '';
    root.appendChild(el('div', { class: 'loading', text: 'No gallery entries found.' }));
    return;
  }

  // Load each directory's contents in parallel (but keep simple)
  await Promise.all(dirs.map(async (dir) => {
    try {
      const files = await fetchJson(dir.url); // API url for the directory
      // find metadata.json / preview.png / .bin
      const metaFile = files.find(f => f.name.toLowerCase() === 'metadata.json');
      const previewFile = files.find(f => /preview\.(png|jpg|jpeg|gif)$/i.test(f.name));
      const binFile = files.find(f => f.name.toLowerCase().endsWith('.bin'));

      let metadata = { family: dir.name, style: '', submitter: {}, timestamp: '' };
      if (metaFile && metaFile.download_url) {
        try {
          const metaText = await fetchText(metaFile.download_url);
          metadata = JSON.parse(metaText);
        } catch (e) {
          console.warn('Failed to parse metadata for', dir.name, e);
        }
      }

      const previewUrl = previewFile ? previewFile.download_url : null;
      const binUrl = binFile ? binFile.download_url : null;

      const card = createCard(metadata, previewUrl, binUrl, dir.name);
      grid.appendChild(card);
    } catch (err) {
      console.error('Failed to load gallery entry', dir.name, err);
    }
  }));
}

function createCard(metadata, previewUrl, binUrl, slug) {
  const card = el('div', { class: 'card' });
  const img = el('img', { class: 'preview-img', alt: metadata.family || slug });
  if (previewUrl) img.src = previewUrl;
  else img.src = 'icons/favicon-32x32.png';
  card.appendChild(img);

  const meta = el('div', { class: 'meta' });
  meta.appendChild(el('b', { text: `${metadata.family || slug} — ${metadata.style || ''}` }));
  if (metadata.preview_text) meta.appendChild(el('div', { text: `Preview: "${metadata.preview_text}"` }));
  if (metadata.submitter && metadata.submitter.name) meta.appendChild(el('div', { text: `Submitted by: ${metadata.submitter.name}` }));
  if (metadata.timestamp) meta.appendChild(el('div', { text: `Date: ${new Date(metadata.timestamp).toLocaleString()}` }));
  card.appendChild(meta);

  const controls = el('div', { class: 'controls' });
  if (binUrl) {
    controls.appendChild(el('a', { href: binUrl, text: 'Download .bin' }));
  } else {
    const disabled = el('a', { href: '#', text: 'No .bin', class: 'secondary' });
    disabled.addEventListener('click', (e) => e.preventDefault());
    controls.appendChild(disabled);
  }

  controls.appendChild(el('a', { href: `https://github.com/${OWNER}/${REPO}/tree/main/gallery/${slug}`, text: 'View on GitHub', class: 'secondary' }));
  card.appendChild(controls);

  return card;
}

// initialize
loadGallery().catch(err => {
  root.innerHTML = '';
  root.appendChild(el('div', { class: 'loading', text: 'Unexpected error: ' + err.message }));
  console.error(err);
});
