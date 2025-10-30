const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors({ origin: true })); // allow requests from any origin (adjust to your domain in production)
app.use(bodyParser.json({ limit: '20mb' }));

// Basic rate limiting to prevent abuse
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }); // 30 requests per 15 minutes per IP
app.use(limiter);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) console.warn('Warning: GITHUB_TOKEN not set. /submit will fail without it.');

app.post('/submit', async (req, res) => {
    if (!GITHUB_TOKEN) return res.status(500).json({ error: 'Server not configured with GITHUB_TOKEN' });

    const { owner, repo, slug, files, family, style, preview_text } = req.body;
    if (!owner || !repo || !slug || !files) return res.status(400).json({ error: 'Missing fields' });

    // Basic validation and size limits
    const MAX_PREVIEW_BYTES = parseInt(process.env.MAX_PREVIEW_BYTES || '512000', 10); // ~500KB
    const MAX_BIN_BYTES = parseInt(process.env.MAX_BIN_BYTES || '4194304', 10); // ~4MB

    try {
        // validate expected files keys
        const metadataKey = Object.keys(files).find(k => k.endsWith('metadata.json'));
        const previewKey = Object.keys(files).find(k => k.endsWith('preview.png'));
        const binKey = Object.keys(files).find(k => k.endsWith('.bin'));
        if (!metadataKey || !previewKey || !binKey) return res.status(400).json({ error: 'Missing required files (metadata.json, preview.png, .bin)' });

        // validate sizes (base64 string lengths roughly correlate to bytes)
        const previewB64 = files[previewKey];
        const binB64 = files[binKey];
        const previewBytes = Math.floor(previewB64.length * 3 / 4);
        const binBytes = Math.floor(binB64.length * 3 / 4);
        if (previewBytes > MAX_PREVIEW_BYTES) return res.status(400).json({ error: 'Preview too large' });
        if (binBytes > MAX_BIN_BYTES) return res.status(400).json({ error: 'Bin file too large' });

        // optional: validate bin size vs metadata width/height
        const metadata = JSON.parse(Buffer.from(files[metadataKey], 'base64').toString('utf8'));
        if (metadata.width && metadata.height) {
            const width = parseInt(metadata.width, 10);
            const height = parseInt(metadata.height, 10);
            if (Number.isFinite(width) && Number.isFinite(height)) {
                const widthByte = Math.ceil(width / 8);
                const expectedCharByte = widthByte * height;
                // we can't know number of characters encoded precisely, but reject impossibly small/large files
                if (binBytes < expectedCharByte) return res.status(400).json({ error: 'Bin file appears too small for declared dimensions' });
            }
        }
        // get default branch
        const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'xteink-gallery-server' } });
        if (!repoResp.ok) throw new Error('Failed to read repo');
        const repoJson = await repoResp.json();
        const defaultBranch = repoJson.default_branch || 'main';

        const refResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`, { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'xteink-gallery-server' } });
        if (!refResp.ok) throw new Error('Failed to read ref');
        const refJson = await refResp.json();
        const baseSha = refJson.object.sha;

        const branchName = `submissions/${slug}`;
        const createRefResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
            method: 'POST', headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'xteink-gallery-server' }, body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha })
        });
        if (!createRefResp.ok) throw new Error('Failed to create branch: ' + (await createRefResp.text()));

        for (const path of Object.keys(files)) {
            const payload = { message: `Add ${path}`, content: files[path], branch: branchName };
            const putResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, { method: 'PUT', headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'xteink-gallery-server' }, body: JSON.stringify(payload) });
            if (!putResp.ok) throw new Error('Failed to create file ' + path + ' - ' + (await putResp.text()));
        }

        const prPayload = { title: `Gallery submission: ${family} ${style} (${slug})`, head: branchName, base: defaultBranch, body: `Automatic submission by web UI. Preview text:\n\n${preview_text}` };
        const prResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, { method: 'POST', headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'xteink-gallery-server' }, body: JSON.stringify(prPayload) });
        if (!prResp.ok) throw new Error('Failed to create PR: ' + (await prResp.text()));
        const prJson = await prResp.json();
        res.json({ ok: true, pr: prJson.html_url });
    } catch (err) {
        console.error(err);
        // best-effort: try to delete branch if it exists
        try { await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/submissions/${slug}`, { method: 'DELETE', headers: { Authorization: `token ${GITHUB_TOKEN}` } }); } catch (e) {}
        res.status(500).json({ error: err.message || String(err) });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server listening on', port));
