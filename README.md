# XTEink Web Font Toolkit

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
