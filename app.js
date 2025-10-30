import FreeTypeInit from 'https://cdn.jsdelivr.net/npm/freetype-wasm@0/dist/freetype.js';

// Global state
let ft = null; // FreeType library instance
let activeFont = null; // The currently active font face

// --- FreeType Initialization ---
try {
    ft = await FreeTypeInit();
} catch (err) {
    console.error('Failed to initialize FreeType:', err);
    alert('Critical error: Could not load FreeType library. Check the browser console.');
    throw new Error("FreeType failed to initialize");
}

// --- Helper Functions ---

// API base URL for server submissions. Set this to your Cloudflare Tunnel hostname.
const API_BASE = 'https://apixtgallery.lakafior.com';


function getFreetypeLoadFlags() {
    const isAntiAlias = document.getElementById('chkRenderAntiAlias').checked;
    const isGridFit = document.getElementById('chkRenderGridFit').checked;

    let flags = ft.FT_LOAD_RENDER;

    if (!isGridFit) {
        flags |= ft.FT_LOAD_NO_HINTING;
    }

    if (isAntiAlias) {
        flags |= ft.FT_LOAD_TARGET_NORMAL; // Grayscale anti-aliasing
    } else {
        flags |= ft.FT_LOAD_TARGET_MONO; // 1-bit monochrome rendering
    }
    
    return flags;
}

const optical_offsets = {
// ============================================
// OKRĄGŁE ZNAKI - silne przesunięcie w lewo
// ============================================
// Okrągłe litery mają "optyczną masę" w środku, więc geometryczne
// wycentrowanie sprawia, że wydają się za daleko. Przesuwamy je w lewo.
"O": -0.10, "Q": -0.10, "C": -0.09, "G": -0.09,
"o": -0.10, "q": -0.10, "c": -0.09, "g": -0.09,
"0": -0.10, "6": -0.08, "8": -0.08, "9": -0.08,

// Półokrągłe - średnie przesunięcie w lewo
"D": -0.06, "d": -0.06,
"S": -0.05, "s": -0.05,
"3": -0.06, "5": -0.05, "2": -0.04,

// ============================================
// ZNAKI Z "DACHEM" - przesunięcie w prawo
// ============================================
// Litery z szerokim górem i wąskim dołem tworzą przestrzeń optyczną
// pod sobą. Przesunięcie w prawo pozwala następnej literze wypełnić tę lukę.
"T": 0.07, "Y": 0.06, "V": 0.06, "W": 0.05, "A": 0.04,
"y": 0.05, "v": 0.05, "w": 0.04,
"7": 0.06,

// ============================================
// WĄSKIE ZNAKI - neutralne lub minimalne
// ============================================
// Wąskie znaki wyglądają najlepiej gdy są wycentrowane.
// Problem z "ill" nie jest do rozwiązania przez offset - to kwestia
// szerokości boxa, której nie możemy zmienić.
"I": 0, "l": 0, "i": 0, "1": 0, "!": 0, "|": 0,
"t": 0, "f": 0, "j": 0,
"r": 0,  // 'r' jest wąskie z prawej strony, ale lepiej wycentrowane

// ============================================
// ZNAKI Z OTWARTĄ PRAWĄ STRONĄ
// ============================================
// Te znaki mają dużo "powietrza" z prawej, więc lekko w prawo
"J": 0.05,
"a": 0.02, "e": 0.02, "u": 0.02,

// ============================================
// NAWIASY I ZNAKI INTERPUNKCYJNE
// ============================================
// Otwierające - silnie w lewo (wtulają się)
"(": -0.12, "[": -0.12, "{": -0.12,

// Zamykające - silnie w prawo (wypychają)
")": 0.12, "]": 0.12, "}": 0.12,

// Cudzysłowy i apostrofy - asymetryczne
// Używamy unikalnych znaków typograficznych jako kluczy
'‘': -0.08, // Lewy pojedynczy cudzysłów
'’': 0.08,  // Prawy pojedynczy cudzysłów (i apostrof)
'‚': -0.08, // Pojedynczy cudzysłów dolny
'“': -0.08, // Lewy podwójny cudzysłów
'”': 0.08,  // Prawy podwójny cudzysłów
'„': -0.08, // Podwójny cudzysłów dolny
"'": 0,     // Neutralny (prosty) apostrof - często używany jako prawy, więc może być 0.08, ale 0 jest bezpieczniejsze
'"': 0,     // Neutralny (prosty) cudzysłów - wycentrowany

// Małe znaki interpunkcyjne - lekko w lewo dla lepszego rytmu
".": -0.02, ",": -0.02, ":": -0.02, ";": -0.02,

// ============================================
// ZNAKI SYMETRYCZNE - neutralne (0)
// ============================================
// Te litery mają podobną "masę optyczną" po obu stronach
"B": 0, "E": 0, "F": 0, "H": 0, "K": 0, "L": 0,
"M": 0, "N": 0, "P": 0, "R": 0, "U": 0, "X": 0, "Z": 0,
"b": 0, "h": 0, "k": 0, "m": 0, "n": 0, "p": 0,
"x": 0, "z": 0,
"4": 0,

// Znaki matematyczne i specjalne - wycentrowane
"-": 0, "+": 0, "=": 0, "*": 0, "/": 0, "\\": 0,
"#": 0, "&": 0, "%": 0, "$": 0, "@": 0,
"?": 0, "^": 0, "_": 0, "~": 0, "`": 0,
"<": 0, ">": 0,
};

// Funkcja pomocnicza do bezpiecznego pobierania offsetu
function getOpticalOffset(char) {
return optical_offsets[char] ?? 0;
}

const narrowVerticals = new Set(['l', 'i', 't', 'f', 'j', 'I', 'J', 'T', 'F', '1', '!', '|']);

function getOpticalDx(char, bitmapWidth, boxWidth, isFirstCharInLine) {
    const centeredDx = Math.floor((boxWidth - bitmapWidth) / 2);
    
    // Normalize character to handle accented letters by checking the base character
    const normalizedChar = char.normalize("NFD").replace(/[̀-͡]/g, "");
    
    // 1. Get base shift from the offset map
    const baseShiftFraction = optical_offsets[normalizedChar] || 0.0;
    let dx = centeredDx + Math.round(boxWidth * baseShiftFraction);

    // 2. Apply Pseudo-Kerning Rule (Specification Section 5)
    if (!isFirstCharInLine && narrowVerticals.has(normalizedChar)) {
        const kerningShift = Math.round(boxWidth * -0.03); // 3% shift left
        dx += kerningShift;
    }
    
    return dx;
}


/**
 * Renders a single character to the glyph preview canvas using FreeType.
 */
function renderGlyphToCanvas(char) {
    const onScreenCanvas = document.getElementById('glyphCanvas');
    const onScreenCtx = onScreenCanvas.getContext('2d');

    // 1. Get all settings
    const fontSize = parseInt(document.getElementById('fontSize').value, 10) || 28;
    const charSpacing = parseInt(document.getElementById('charSpacing').value, 10) || 0;
    const lineSpacing = parseInt(document.getElementById('lineSpacing').value, 10) || 0;
    const threshold = parseInt(document.getElementById('lightnessThreshold').value, 10) || 127;
    const isVerticalFont = document.getElementById('isVerticalFont').checked;
    const shouldRenderBorder = document.getElementById('chkRenderBorder').checked;
    const useOpticalAlign = document.getElementById('chkOpticalAlign').checked;

    const boxWidth = fontSize + charSpacing;
    const boxHeight = fontSize + lineSpacing;

    onScreenCtx.fillStyle = '#fff';
    onScreenCtx.fillRect(0, 0, onScreenCanvas.width, onScreenCanvas.height);

    if (boxWidth <= 0 || boxHeight <= 0) return;

    // 2. Create an offscreen canvas with the REAL box dimensions
    const offScreenCanvas = document.createElement('canvas');
    offScreenCanvas.width = boxWidth;
    offScreenCanvas.height = boxHeight;
    const ctx = offScreenCanvas.getContext('2d');

    // 3. Render the glyph to the offscreen canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (shouldRenderBorder) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, ctx.canvas.width - 1, ctx.canvas.height - 1);
    }
    
    if (ft && activeFont) {
        ft.SetFont(activeFont.family_name, activeFont.style_name);
        ft.SetPixelSize(0, fontSize);
        const loadFlags = getFreetypeLoadFlags();
        const glyphs = ft.LoadGlyphs([char.charCodeAt(0)], loadFlags);
        if (glyphs.has(char.charCodeAt(0))) {
            const glyph = glyphs.get(char.charCodeAt(0));
            const bitmap = glyph.bitmap;
            if (bitmap.width > 0 && bitmap.rows > 0 && bitmap.imagedata) {
                let dx = Math.floor((offScreenCanvas.width - bitmap.width) / 2);
                if(useOpticalAlign) {
                    // For single glyph preview, treat as first char in line (no kerning)
                    dx = getOpticalDx(char, bitmap.width, boxWidth, true);
                }
                const baseline = Math.round(offScreenCanvas.height * 0.75);
                const dy = baseline - glyph.bitmap_top;
                
                const sourceData = bitmap.imagedata.data;
                ctx.fillStyle = '#000';
                for (let y = 0; y < bitmap.rows; y++) {
                    for (let x = 0; x < bitmap.width; x++) {
                        const i = (y * bitmap.width + x) * 4;
                        if (sourceData[i + 3] > threshold) {
                            ctx.fillRect(dx + x, dy + y, 1, 1);
                        }
                    }
                }
            }
        }
    }

    // 4. Draw the offscreen canvas onto the onscreen canvas, scaled and rotated
    onScreenCtx.imageSmoothingEnabled = false;

    const scale = Math.min(onScreenCanvas.width / boxWidth, onScreenCanvas.height / boxHeight);
    const destWidth = boxWidth * scale;
    const destHeight = boxHeight * scale;
    const destX = (onScreenCanvas.width - destWidth) / 2;
    const destY = (onScreenCanvas.height - destHeight) / 2;

    if (isVerticalFont) {
        onScreenCtx.save();
        onScreenCtx.translate(onScreenCanvas.width / 2, onScreenCanvas.height / 2);
        onScreenCtx.rotate(-90 * Math.PI / 180);
        onScreenCtx.translate(-onScreenCanvas.width / 2, -onScreenCanvas.height / 2);
    }

    onScreenCtx.drawImage(offScreenCanvas, destX, destY, destWidth, destHeight);

    if (isVerticalFont) {
        onScreenCtx.restore();
    }
}

/**
 * Renders the preview text to the main preview canvas using FreeType.
 */
function renderPreviewText() {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');

    if (canvas.width !== canvas.clientWidth) {
        canvas.width = canvas.clientWidth;
    }

    const previewText = document.getElementById('previewText').value;
    const charSpacing = parseInt(document.getElementById('charSpacing').value, 10) || 0;
    const lineSpacing = parseInt(document.getElementById('lineSpacing').value, 10) || 0;
    const threshold = parseInt(document.getElementById('lightnessThreshold').value, 10) || 127;
    const shouldRenderBorder = document.getElementById('chkRenderBorder').checked;
    const useOpticalAlign = document.getElementById('chkOpticalAlign').checked;

    const boxWidth = fontSize + charSpacing;
    const boxHeight = fontSize + lineSpacing;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!ft || !activeFont || boxHeight <= 0) return;

    ft.SetFont(activeFont.family_name, activeFont.style_name);
    ft.SetPixelSize(0, fontSize);

    const loadFlags = getFreetypeLoadFlags();
    const charCodes = [...new Set(previewText.split('').map(c => c.charCodeAt(0)))];
    const glyphs = ft.LoadGlyphs(charCodes, loadFlags);

    const lines = previewText.split(/\r?\n/);
    let lineY = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        let charX = 0;
        lineY += boxHeight;

        if (lineY - boxHeight > canvas.height) break;

        for (let i = 0; i < line.length; i++) {
            const charCode = line.charCodeAt(i);
            const char = line[i];

            if (charX + boxWidth > canvas.width) break;

            if (glyphs.has(charCode)) {
                if (shouldRenderBorder) {
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(charX + 0.5, lineY - boxHeight + 0.5, boxWidth - 1, boxHeight - 1);
                }

                const glyph = glyphs.get(charCode);
                const bitmap = glyph.bitmap;

                if (bitmap.width > 0 && bitmap.rows > 0 && bitmap.imagedata) {
                    let dx = charX + Math.floor((boxWidth - bitmap.width) / 2);
                    if(useOpticalAlign) {
                        // For bin file compatibility, treat each glyph as first-in-line
                        // (no pseudo-kerning). This ensures the preview matches the .bin output.
                        dx = charX + getOpticalDx(char, bitmap.width, boxWidth, true);
                    }
                    const baseline = lineY - boxHeight + Math.round(boxHeight * 0.75);
                    const dy = baseline - glyph.bitmap_top;
                    
                    const sourceData = bitmap.imagedata.data;
                    ctx.fillStyle = '#000';
                    for (let y = 0; y < bitmap.rows; y++) {
                        for (let x = 0; x < bitmap.width; x++) {
                            const j = (y * bitmap.width + x) * 4;
                            if (sourceData[j + 3] > threshold) {
                                ctx.fillRect(dx + x, dy + y, 1, 1);
                            }
                        }
                    }
                }
                charX += boxWidth;
            }
        }
    }
}

/**
 * Handles the font file selection.
 */
async function handleFontFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fontBuffer = await file.arrayBuffer();
    try {
        const faces = ft.LoadFontFromBytes(new Uint8Array(fontBuffer));
        if (!faces || faces.length === 0) {
            throw new Error("FreeType could not find any faces in the font file.");
        }
        activeFont = faces[0];
        
        document.getElementById('fontInfo').innerText = `Loaded font: ${activeFont.family_name}, Style: ${activeFont.style_name}`;

        updateControlStates();
        renderGlyphToCanvas('A');
        renderPreviewText();
    } catch (err) {
        document.getElementById('fontInfo').innerText = 'Failed to parse font. ' + (err && err.message ? err.message : err);
        activeFont = null;
        console.error('Font parse error:', err);
    }
}

/**
 * Converts the loaded font to a binary file.
 */
async function convertFontToBin() {
    if (!activeFont) {
        alert('Please select a TTF or OTF font file.');
        return;
    }

    const fontSize = parseInt(document.getElementById('fontSize').value, 10) || 28;
    const charSpacing = parseInt(document.getElementById('charSpacing').value, 10) || 0;
    const lineSpacing = parseInt(document.getElementById('lineSpacing').value, 10) || 0;
    const threshold = parseInt(document.getElementById('lightnessThreshold').value, 10) || 127;
    const shouldRenderBorder = document.getElementById('chkRenderBorder').checked;
    const useOpticalAlign = document.getElementById('chkOpticalAlign').checked;

    const width = fontSize + charSpacing;
    const height = fontSize + lineSpacing;
    
    if (width <= 0 || height <= 0) {
        alert("Resulting width and height must be positive.");
        return;
    }

    const isVerticalFont = document.getElementById('isVerticalFont').checked;

    const totalChar = 0x10000;
    const widthByte = Math.ceil(width / 8);
    const charByte = widthByte * height;
    const binBuffer = new Uint8Array(charByte * totalChar);
    binBuffer.fill(0);

    ft.SetFont(activeFont.family_name, activeFont.style_name);
    ft.SetPixelSize(0, fontSize);
    
    const progressMsg = document.getElementById('progressMsg');
    progressMsg.textContent = 'Converting...';

    const batchSize = 256;
    for (let i = 0; i < totalChar; i += batchSize) {
        progressMsg.textContent = `Converting... ${i}/${totalChar}`;
        await new Promise(r => setTimeout(r, 1));

        const loadFlags = getFreetypeLoadFlags();
        const charCodes = Array.from({length: batchSize}, (_, j) => i + j);
        const glyphs = ft.LoadGlyphs(charCodes, loadFlags);

        for (const [charCode, glyph] of glyphs.entries()) {
            const char = String.fromCharCode(charCode);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, width, height);
            if (shouldRenderBorder) {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
            }

            if (glyph.bitmap && glyph.bitmap.width > 0 && glyph.bitmap.rows > 0) {
                let dx = Math.floor((width - glyph.bitmap.width) / 2);
                if(useOpticalAlign) {
                    // No kerning context in bin file, treat every char as first
                    dx = getOpticalDx(char, glyph.bitmap.width, width, true);
                }
                const baseline = Math.round(height * 0.75);
                const dy = baseline - glyph.bitmap_top;
                
                const sourceData = glyph.bitmap.imagedata.data;
                ctx.fillStyle = '#000';
                for (let y = 0; y < glyph.bitmap.rows; y++) {
                    for (let x = 0; x < glyph.bitmap.width; x++) {
                        const pixelIndex = (y * glyph.bitmap.width + x) * 4;
                        if (sourceData[pixelIndex + 3] > threshold) {
                            ctx.fillRect(dx + x, dy + y, 1, 1);
                        }
                    }
                }
            }

            const finalImageData = ctx.getImageData(0, 0, width, height).data;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelIndex = (y * width + x) * 4;
                    const bit = (finalImageData[pixelIndex] < 128) ? 1 : 0;

                    if (bit) {
                        let finalByteIdx, finalBitIdx;
                        if (isVerticalFont) {
                            finalByteIdx = charCode * charByte + x * widthByte + (y >> 3);
                            finalBitIdx = 7 - (y % 8);
                        } else {
                            finalByteIdx = charCode * charByte + y * widthByte + (x >> 3);
                            finalBitIdx = 7 - (x % 8);
                        }
                        if (finalByteIdx < binBuffer.length) {
                            binBuffer[finalByteIdx] |= (1 << finalBitIdx);
                        }
                    }
                }
            }
        }
    }

    progressMsg.textContent = 'Download ready.';
    const blob = new Blob([binBuffer], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `font_${width}x${height}.bin`;
    a.click();
    URL.revokeObjectURL(a.href);
    setTimeout(() => { progressMsg.textContent = ''; }, 3000);
    return { blob, width, height };
}

// Read blob to base64 (no data: prefix)
function readBlobAsBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const res = reader.result;
            const comma = res.indexOf(',');
            resolve(res.slice(comma + 1));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function slugify(str) {
    return (str || '')
        .toString()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// Properly base64-encode a UTF-8 string in browsers
function base64EncodeUnicode(str) {
    // encodeURIComponent -> percent-encodings -> convert to raw bytes
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}

async function saveToServer() {
    const status = document.getElementById('saveServerStatus');
    status.textContent = 'Generating .bin...';
    const res = await convertFontToBin();
    if (!res) { status.textContent = 'Conversion failed.'; return; }
    const { blob, width, height } = res;

    status.textContent = 'Preparing preview...';
    const previewCanvas = document.getElementById('previewCanvas');
    const previewBlob = await new Promise(r => previewCanvas.toBlob(r, 'image/png'));

    // Create a small thumbnail for gallery listing (max dimension 360px)
    function createThumbnail(canvas, maxDim = 360) {
        const w = canvas.width;
        const h = canvas.height;
        const ratio = Math.max(1, Math.max(w, h) / maxDim);
        const tw = Math.max(1, Math.round(w / ratio));
        const th = Math.max(1, Math.round(h / ratio));
        const tmp = document.createElement('canvas');
        tmp.width = tw;
        tmp.height = th;
        const tctx = tmp.getContext('2d');
        // White background
        tctx.fillStyle = '#fff';
        tctx.fillRect(0, 0, tw, th);
        tctx.drawImage(canvas, 0, 0, w, h, 0, 0, tw, th);
        return tmp;
    }

    const thumbCanvas = createThumbnail(previewCanvas, 360);
    const thumbBlob = await new Promise(r => thumbCanvas.toBlob(r, 'image/png'));

    status.textContent = 'Encoding...';
    const binBase64 = await readBlobAsBase64(blob);
    const previewBase64 = await readBlobAsBase64(previewBlob);
    const thumbBase64 = await readBlobAsBase64(thumbBlob);

    // Pre-upload check: inform user if bin is too large for server default
    const binBytes = blob.size || Math.floor(binBase64.length * 3 / 4);
    const SERVER_MAX_BIN = 12 * 1024 * 1024; // 12B client-side expectation (matches server default)
    if (binBytes > SERVER_MAX_BIN) {
        const mb = (binBytes / (1024*1024)).toFixed(2);
        alert(`Generated .bin file is ${mb} MB which exceeds the configured server limit (~${SERVER_MAX_BIN/(1024*1024)} MB). Please reduce font size/spacing or enable different settings. Alternatively increase server MAX_BIN_BYTES.`);
        status.textContent = 'Error: .bin file too large for server';
        return;
    }

    const family = activeFont ? activeFont.family_name : 'Unknown';
    const style = activeFont ? activeFont.style_name : 'Unknown';
    const previewText = document.getElementById('previewText').value;
    const submitter = document.getElementById('submitterName').value.trim() || 'Anonymous';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const slug = slugify(`${family}-${style}-${timestamp}`);
    const folder = `gallery/${slug}`;

    const metadata = {
        id: slug,
        family,
        style,
        preview_text: previewText,
        width,
        height,
        timestamp: new Date().toISOString(),
        submitter: { name: submitter }
    };

    const files = {};
    files[`${folder}/metadata.json`] = base64EncodeUnicode(JSON.stringify(metadata, null, 2));
    files[`${folder}/preview.png`] = previewBase64;
    files[`${folder}/preview_thumb.png`] = thumbBase64;
    files[`${folder}/font_${width}x${height}.bin`] = binBase64;

    status.textContent = 'Uploading to server...';
    try {
        // Prepare an AbortController so the request doesn't hang indefinitely
        const controller = new AbortController();
        const timeoutMs = 30000; // 30s
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Debug: log approximate payload sizes
        try {
            const metaSize = files[`${folder}/metadata.json`].length;
            const previewSize = files[`${folder}/preview.png`].length;
            const binSize = files[`${folder}/font_${width}x${height}.bin`].length;
            console.log('Upload payload sizes (base64 chars):', { metaSize, previewSize, binSize });
        } catch (e) { console.warn('Failed to compute payload sizes', e); }

        // Auto-target repo (no prompt)
        const repoFull = 'lakafior/XTEink-Web-Font-Maker';
        const [owner, repo] = repoFull.split('/');
        const resp = await fetch(`${API_BASE}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner, repo, slug, files, family, style, preview_text: previewText }), signal: controller.signal });
        clearTimeout(timeoutId);
        const j = await resp.json();
        if (!resp.ok) throw new Error(j.error || JSON.stringify(j));
        status.textContent = '';
        alert('PR created: ' + j.pr);
    } catch (err) {
        if (err.name === 'AbortError') {
            console.error('Upload timed out after 30s');
            status.textContent = 'Error: upload timed out (no response from server). Check tunnel / server.';
            return;
        }
        console.error(err);
        status.textContent = 'Error: ' + (err && err.message ? err.message : err);
    }
}

document.getElementById('saveServerBtn').addEventListener('click', saveToServer);

function updateControlStates() {
    const isAntiAlias = document.getElementById('chkRenderAntiAlias').checked;
    document.getElementById('lightnessThreshold').disabled = !isAntiAlias;
    document.getElementById('lightnessThresholdValue').style.opacity = isAntiAlias ? 1 : 0.5;
}

// --- Event Listeners ---
document.getElementById('fontFile').addEventListener('change', handleFontFileChange);
document.getElementById('convertBtn').addEventListener('click', convertFontToBin);

const inputs = ['charSpacing', 'lineSpacing', 'fontSize', 'isVerticalFont', 'lightnessThreshold', 'chkRenderAntiAlias', 'chkRenderGridFit', 'chkRenderBorder', 'chkOpticalAlign'];
const previewEl = document.getElementById('previewText');
const previewCount = document.getElementById('previewCount');
const PREVIEW_MAX = 500;

function updatePreviewCount() {
    const remaining = PREVIEW_MAX - (previewEl.value ? previewEl.value.length : 0);
    previewCount.textContent = `${remaining} characters remaining`;
}

// prevent paste that exceeds maxlength
previewEl.addEventListener('paste', (e) => {
    const paste = (e.clipboardData || window.clipboardData).getData('text');
    const willBe = (previewEl.value || '') + paste;
    if (willBe.length > PREVIEW_MAX) {
        e.preventDefault();
        // trim paste to remaining
        const allowed = PREVIEW_MAX - (previewEl.value ? previewEl.value.length : 0);
        if (allowed > 0) {
            const trimmed = paste.slice(0, allowed);
            const start = previewEl.selectionStart || previewEl.value.length;
            const before = previewEl.value.slice(0, start);
            const after = previewEl.value.slice(previewEl.selectionEnd || start);
            previewEl.value = before + trimmed + after;
            // move caret
            const pos = start + trimmed.length;
            previewEl.setSelectionRange(pos, pos);
            updatePreviewCount();
            renderPreviewText();
        }
    }
});

previewEl.addEventListener('input', () => {
    updatePreviewCount();
});
inputs.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('input', () => {
            updateControlStates();
            renderPreviewText();
            renderGlyphToCanvas('A');
        });
    }
});

// also wire previewText into rendering and controls
if (previewEl) {
    previewEl.addEventListener('input', () => {
        updateControlStates();
        renderPreviewText();
        renderGlyphToCanvas('A');
    });
    // initialize counter
    updatePreviewCount();
}

document.getElementById('lightnessThreshold').addEventListener('input', (e) => {
    document.getElementById('lightnessThresholdValue').textContent = e.target.value;
});

// Resize text preview on window resize
window.addEventListener('resize', renderPreviewText);

// Set initial state on load
updateControlStates();

// --- Developer helper: verify bin glyphs match preview ---
// Usage (in console): verifyBinMatchesPreview(['A','a','0']);
window.verifyBinMatchesPreview = async function(chars = ['A','a','0']) {
    if (!activeFont) {
        console.warn('No font loaded. Load a font first.');
        return;
    }
    const fontSize = parseInt(document.getElementById('fontSize').value, 10) || 28;
    const charSpacing = parseInt(document.getElementById('charSpacing').value, 10) || 0;
    const lineSpacing = parseInt(document.getElementById('lineSpacing').value, 10) || 0;
    const threshold = parseInt(document.getElementById('lightnessThreshold').value, 10) || 127;
    const shouldRenderBorder = document.getElementById('chkRenderBorder').checked;
    const useOpticalAlign = document.getElementById('chkOpticalAlign').checked;
    const isVerticalFont = document.getElementById('isVerticalFont').checked;

    const width = fontSize + charSpacing;
    const height = fontSize + lineSpacing;

    function renderGlyphOffscreen(char) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,canvas.width, canvas.height);
        if (shouldRenderBorder) {
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(0.5,0.5,canvas.width-1,canvas.height-1);
        }
        if (ft && activeFont) {
            ft.SetFont(activeFont.family_name, activeFont.style_name);
            ft.SetPixelSize(0, fontSize);
            const loadFlags = getFreetypeLoadFlags();
            const glyphs = ft.LoadGlyphs([char.charCodeAt(0)], loadFlags);
            const glyph = glyphs.get(char.charCodeAt(0));
            if (glyph && glyph.bitmap && glyph.bitmap.width > 0 && glyph.bitmap.rows > 0 && glyph.bitmap.imagedata) {
                const bitmap = glyph.bitmap;
                let dx = Math.floor((width - bitmap.width) / 2);
                if (useOpticalAlign) dx = getOpticalDx(char, bitmap.width, width, true);
                const baseline = Math.round(height * 0.75);
                const dy = baseline - glyph.bitmap_top;
                const sourceData = bitmap.imagedata.data;
                ctx.fillStyle = '#000';
                for (let y = 0; y < bitmap.rows; y++) {
                    for (let x = 0; x < bitmap.width; x++) {
                        const i = (y * bitmap.width + x) * 4;
                        if (sourceData[i + 3] > threshold) ctx.fillRect(dx + x, dy + y, 1, 1);
                    }
                }
            }
        }
        return canvas;
    }

    function packCanvasToBinBytes(canvas) {
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0,0,canvas.width,canvas.height).data;
        const widthByte = Math.ceil(canvas.width / 8);
        const charByte = widthByte * canvas.height;
        const arr = new Uint8Array(charByte);
        arr.fill(0);
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                const bit = (data[idx] < 128) ? 1 : 0;
                if (bit) {
                    const byteIdx = y * widthByte + (x >> 3);
                    const bitIdx = 7 - (x % 8);
                    arr[byteIdx] |= (1 << bitIdx);
                }
            }
        }
        return { bytes: arr, widthByte, charByte };
    }

    function unpackBinBytesToCanvas(bytes, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height);
        const img = ctx.getImageData(0,0,width,height);
        const widthByte = Math.ceil(width / 8);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const byteIdx = y * widthByte + (x >> 3);
                const bitIdx = 7 - (x % 8);
                const bit = (bytes[byteIdx] >> bitIdx) & 1;
                if (bit) {
                    const i = (y * width + x) * 4;
                    img.data[i] = 0; img.data[i+1] = 0; img.data[i+2] = 0; img.data[i+3] = 255;
                }
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvas;
    }

    for (const ch of chars) {
        const orig = renderGlyphOffscreen(ch);
        const packed = packCanvasToBinBytes(orig);
        const unpacked = unpackBinBytesToCanvas(packed.bytes, width, height);

        // compare pixel-wise
        const a = orig.getContext('2d').getImageData(0,0,width,height).data;
        const b = unpacked.getContext('2d').getImageData(0,0,width,height).data;
        let mismatch = 0;
        for (let i = 0; i < a.length; i += 4) {
            const aa = a[i] < 128 ? 1 : 0;
            const bb = b[i] < 128 ? 1 : 0;
            if (aa !== bb) mismatch++;
        }
        if (mismatch === 0) console.log(`OK: '${ch}' matches exactly (${width}x${height})`);
        else console.warn(`MISMATCH: '${ch}' has ${mismatch} differing pixels (${width}x${height})`);
        // expose canvases for manual inspection
        console.log('original canvas:', orig);
        console.log('unpacked canvas:', unpacked);
    }
};
