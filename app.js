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
    // Shift Left (Strong)
    "l": -0.06, "i": -0.06, "I": -0.06, "1": -0.06, "!": -0.06, "|": -0.06,
    "(": -0.06, ")": -0.06, "[": -0.06, "]": -0.06, "{": -0.06, "}": -0.06,
    // Shift Left (Medium)
    "t": -0.04, "f": -0.04, "j": -0.04, "T": -0.04, "F": -0.04, "J": -0.04,
    // Shift Right (Medium)
    "n": 0.03, "m": 0.03, "h": 0.03, "u": 0.03, "p": 0.03, "b": 0.03, "d": 0.03,
    "N": 0.03, "M": 0.03, "H": 0.03, "U": 0.03, "P": 0.03, "B": 0.03, "D": 0.03, "R": 0.03,
    // Shift Right (Slight)
    "r": 0.02, "k": 0.02, "y": 0.02, "K": 0.02, "Y": 0.02, "z": 0.02, "Z": 0.02,
    "s": 0.02, "S": 0.02, "e": 0.02, "E": 0.02, "c": 0.02, "C": 0.02, "G": 0.02
};
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
    const fontSize = parseInt(document.getElementById('fontSize').value, 10) || 28;
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
                        dx = charX + getOpticalDx(char, bitmap.width, boxWidth, i === 0);
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
}

function updateControlStates() {
    const isAntiAlias = document.getElementById('chkRenderAntiAlias').checked;
    document.getElementById('lightnessThreshold').disabled = !isAntiAlias;
    document.getElementById('lightnessThresholdValue').style.opacity = isAntiAlias ? 1 : 0.5;
}

// --- Event Listeners ---
document.getElementById('fontFile').addEventListener('change', handleFontFileChange);
document.getElementById('convertBtn').addEventListener('click', convertFontToBin);

const inputs = ['previewText', 'charSpacing', 'lineSpacing', 'fontSize', 'isVerticalFont', 'lightnessThreshold', 'chkRenderAntiAlias', 'chkRenderGridFit', 'chkRenderBorder', 'chkOpticalAlign'];
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

document.getElementById('lightnessThreshold').addEventListener('input', (e) => {
    document.getElementById('lightnessThresholdValue').textContent = e.target.value;
});

// Resize text preview on window resize
window.addEventListener('resize', renderPreviewText);

// Set initial state on load
updateControlStates();