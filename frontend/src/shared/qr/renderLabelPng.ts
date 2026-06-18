// Shared QR-label rasterizer. Composes a printable PNG: a QR code on top,
// then one or more text lines underneath (brand, code, description, etc.).
// Used by both the asset-coding and POS QR preview modals so the print /
// download output stays consistent across the app.

export interface LabelLine {
    text: string;
    /** Font size in CSS px (before the internal retina SCALE is applied). */
    size: number;
    /** CSS font-weight token, e.g. "bold", "600", "normal". */
    weight?: string;
    /** Text color. Defaults to a muted gray. */
    color?: string;
    /** Vertical gap (CSS px) after this line. */
    gap?: number;
    /** Render in a monospace family (handy for raw payloads / serials). */
    mono?: boolean;
}

/**
 * Rasterize an inline <svg> QR plus a stack of text lines into a single PNG.
 * Returns a Blob suitable for download or printing.
 */
export async function renderLabelPng(svgEl: SVGSVGElement, lines: LabelLine[]): Promise<Blob> {
    // Layout (in pixels at the chosen scale)
    const SCALE = 2; // bumps clarity for laser printers / retina screens
    const W = 480 * SCALE;
    const QR_SIZE = 360 * SCALE;
    const PAD = 32 * SCALE;

    // Rasterize the SVG into an Image
    const xml = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const qrImage = await loadImage(svgUrl);
    URL.revokeObjectURL(svgUrl);

    // Measure text first so we can size the canvas tall enough.
    const measureCanvas = document.createElement("canvas");
    const mctx = measureCanvas.getContext("2d");
    if (!mctx) throw new Error("Canvas not supported");

    const fontFor = (l: LabelLine) => {
        const family = l.mono ? "ui-monospace, monospace" : "system-ui, sans-serif";
        const weight = l.weight ? `${l.weight} ` : "";
        return `${weight}${l.size * SCALE}px ${family}`;
    };

    // Wrap each line to canvas width and accumulate total height
    const maxTextWidth = W - PAD * 2;
    const wrapped: Array<{ text: string[]; lineHeight: number; gap: number; font: string; color: string }> = [];
    let textHeight = 0;

    for (const l of lines) {
        const font = fontFor(l);
        mctx.font = font;
        const lh = l.size * SCALE * 1.25;
        const gap = (l.gap ?? 6) * SCALE;
        const wrappedLines = wrapText(mctx, l.text, maxTextWidth);
        wrapped.push({
            text: wrappedLines,
            lineHeight: lh,
            gap,
            font,
            color: l.color ?? "#999999",
        });
        textHeight += wrappedLines.length * lh + gap;
    }

    const H = PAD + QR_SIZE + 24 * SCALE + textHeight + PAD;

    // Render
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Center QR horizontally
    const qrX = (W - QR_SIZE) / 2;
    ctx.drawImage(qrImage, qrX, PAD, QR_SIZE, QR_SIZE);

    // Draw text lines
    let y = PAD + QR_SIZE + 24 * SCALE;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const cx = W / 2;

    for (const block of wrapped) {
        ctx.font = block.font;
        ctx.fillStyle = block.color;
        for (const line of block.text) {
            ctx.fillText(line, cx, y);
            y += block.lineHeight;
        }
        y += block.gap;
    }

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("toBlob returned null"));
        }, "image/png");
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load QR image"));
        img.src = src;
    });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    if (!text) return [""];
    // Soft-break long unbroken strings (like the payload) by character.
    if (ctx.measureText(text).width <= maxWidth) return [text];
    const lines: string[] = [];
    let current = "";
    for (const ch of text) {
        const next = current + ch;
        if (ctx.measureText(next).width > maxWidth && current) {
            lines.push(current);
            current = ch;
        } else {
            current = next;
        }
    }
    if (current) lines.push(current);
    return lines;
}
