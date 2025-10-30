# XTEink Web Font Toolkit — Gallery server & deployment

This repository contains a static frontend (served on GitHub Pages or any static host) and a small Node server (in `server/`) which accepts gallery submissions from the frontend and creates a pull request in a target GitHub repository. The server is intentionally minimal and designed to keep file storage off your VPS (uploads are streamed to GitHub).

Summary
- Frontend: `index.html` + `app.js` — converts fonts to `.bin`, generates a preview PNG, and POSTs a submission package to the server at `/submit`.
- Server: `server/index.js` — accepts POST `/submit` (JSON payload with base64 files and metadata), validates sizes, creates a `submissions/<slug>` branch, writes files, and opens a PR using a server-side `GITHUB_TOKEN`.

Security & resource notes
- The server requires a GitHub token (PAT) with repo write permissions. Store it in the environment as `GITHUB_TOKEN` and keep it secret.
- The server validates file sizes and rate-limits requests. You should further harden it with:
	- Cloudflare in front (proxy) or Cloudflare Tunnel to hide the origin IP.
	- Firewall rules restricting direct access to the origin to Cloudflare IPs.
	- Optional CAPTCHA (hCaptcha/reCAPTCHA) on the frontend for extra anti-abuse.

Environment variables
- `GITHUB_TOKEN` (required) — a personal access token or bot token with permission to create branches/files and open PRs in the target repo.
- `PORT` (optional) — port to listen on (default: 3000).
- `MAX_PREVIEW_BYTES` (optional) — max preview PNG size in bytes (default: 512000 ~ 500 KB).
- `MAX_BIN_BYTES` (optional) — max bin size in bytes (default: 4194304 ~ 4 MB).

Quick local test (dev)
1. Start the server locally:

```bash
cd server
npm install
GITHUB_TOKEN=ghp_YOURTOKEN PORT=3000 node index.js
```

2. Serve the static frontend locally (for example with a simple HTTP server) and open it in your browser. The frontend will POST to `/submit` relative to its origin. If the frontend is on a different origin (e.g., GitHub Pages), the server must be reachable at that domain and CORS must be allowed.

Example using `serve` (optional):

```bash
# from repo root
npm install -g serve
serve -s .
# open the static site address printed by serve
```

Deploy to a VPS (systemd + pm2 example)
1. SSH to VPS, clone repo and install dependencies in `server/`:

```bash
ssh user@your-vps
cd /var/www
git clone <repo-url>
cd XTEink-Web-Font-Toolkit/server
npm ci
```

2. Create a systemd service (example) or use `pm2` to keep the process running. Using `pm2`:

```bash
# on VPS
sudo npm install -g pm2
export GITHUB_TOKEN=ghp_YOURTOKEN
pm2 start index.js --name xteink-gallery --watch
pm2 save
pm2 startup
```

3. Configure DNS and (recommended) Cloudflare to proxy traffic for your API hostname (e.g. `api.yoursite.org`) so your origin IP is not exposed.

Production considerations
- Restrict CORS to your frontend domain by editing `server/index.js`'s `cors()` config.
- Restrict access to only Cloudflare IPs using firewall or Nginx `allow` rules if you're behind Cloudflare.
- Rotate `GITHUB_TOKEN` periodically. Prefer a GitHub App for finer-grained permissions if you scale.
- Add a GitHub Action in the repo to validate incoming submissions on PRs (size checks, JSON schema for metadata).

What I implemented for you
- Frontend: a "Save to gallery (server)" button that packages metadata, preview PNG, and `.bin` (base64) and POSTs to `/submit`.
- Server: `/submit` endpoint that validates and creates a PR using `GITHUB_TOKEN`.

Next steps I recommend
1. Configure and deploy the server on your VPS or a managed host.
2. Put Cloudflare or similar in front of your server to hide the origin IP and protect against abuse.
3. Optionally add CAPTCHA on the frontend and a GitHub Action to validate PRs automatically.

If you want, I can add a `systemd` unit file, a `pm2` startup script snippet, and a sample GitHub Action for PR validation.

# XTEink Web Font Maker

A web-based tool to convert standard font files (`.ttf`, `.otf`) into the 1-bit, fixed-grid `.bin` format used by XTEink e-reader devices.

This tool provides a live WYSIWYG preview that accurately reflects how the font will look on the device, allowing for fine-tuning of all parameters.

## How to Use

1.  **Select Font File:** Click "Choose File" to upload a `.ttf` or `.otf` font from your computer.
2.  **Adjust Settings:** Use the sliders and checkboxes to configure the font to your liking. The previews will update in real-time.
3.  **Generate `.bin` File:** Once you are happy with the preview, click the "Convert to .BIN" button to generate and download the final font file.

## Settings Explained

### Main Settings
*   **Font Size:** The base pixel size for rendering each character.
*   **Char Spacing:** Adds or removes pixels from the **width** of each character's box. Use negative numbers to make the text tighter.
*   **Line Spacing:** Adds or removes pixels from the **height** of each character's box.
*   **Lightness Threshold (Boldness):** Controls how thick the characters appear. A lower value makes the font thinner; a higher value makes it bolder. (Only works when Anti-Aliasing is enabled).

### Rendering Options
*   **Vertical Font:** Stores the font data rotated by 90 degrees for vertical text displays. The Glyph Box Preview will show this rotation.
*   **Render Border in .bin File:** Draws a 1-pixel border around the edge of each character's box in the final `.bin` file.
*   **Enable Anti-Aliasing:** Renders the font with smooth, grayscale edges before converting to black and white. Disabling this creates a sharper, more pixelated look. The Threshold slider is disabled when this is off.
*   **Enable Grid Fitting (Hinting):** Aligns the font to the pixel grid. Disabling this can sometimes produce more "natural" character shapes at the cost of some sharpness.
*   **Enable Optical Alignment:** Activates smart horizontal positioning for characters. This reduces the empty space around narrow letters (like 'i', 'l') to create more visually balanced and readable text.
