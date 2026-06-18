// Renders a QR label onto a canvas sized to the physical label stock at the
// printer's native resolution (NIIMBOT B21S = 203 dpi). The output canvas is
// pure black-on-white so the thermal head produces crisp dots; niimbluelib's
// ImageEncoder thresholds luminance when it converts the canvas to printer
// rows.

export interface ThermalLabelLine {
    text: string;
    /** Relative weight used to size the line (bigger = larger font). */
    scale?: number;
    bold?: boolean;
    mono?: boolean;
}

export interface ThermalLabelOptions {
    /** Physical label width in millimetres. */
    widthMm: number;
    /** Physical label height in millimetres. */
    heightMm: number;
    /** Printer resolution in dots per inch. B21S is 203. */
    dpi?: number;
    /** Text lines drawn next to / under the QR (device no, serial, etc.). */
    lines?: ThermalLabelLine[];
}

const MM_PER_INCH = 25.4;

/**
 * Rasterize a QR <svg> plus text into a label-sized canvas. Async because the
 * SVG is drawn through an Image.
 */
export async function renderThermalLabelCanvas(
    svgEl: SVGSVGElement,
    opts: ThermalLabelOptions
): Promise<HTMLCanvasElement> {
    const dpi = opts.dpi ?? 203;
    const dotsPerMm = dpi / MM_PER_INCH;
    // The encoder requires the column count (the dimension that maps to the
    // print head) to be a multiple of 8, so round both dimensions to /8 to stay
    // valid regardless of print direction.
    const round8 = (n: number) => Math.max(8, Math.round(n / 8) * 8);
    const W = round8(opts.widthMm * dotsPerMm);
    const H = round8(opts.heightMm * dotsPerMm);
    const pad = Math.max(2, Math.round(dotsPerMm)); // ~1mm margin

    const qrImage = await rasterizeSvg(svgEl);

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false; // keep QR modules crisp
    ctx.fillStyle = "#000000";

    const lines = opts.lines ?? [];
    const landscape = W >= H * 1.4 && lines.length > 0;

    if (landscape) {
        // QR on the left (square, full height minus margins), text on the right.
        const qrSize = Math.min(H - pad * 2, Math.floor(W * 0.5));
        const qrX = pad;
        const qrY = Math.round((H - qrSize) / 2);
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

        const textX = qrX + qrSize + pad;
        const textW = W - textX - pad;
        drawTextBlock(ctx, lines, textX, 0, textW, H, "left");
    } else {
        // QR on top (centered), text underneath.
        const textReserve = lines.length > 0 ? Math.round(H * 0.32) : 0;
        const qrSize = Math.min(W - pad * 2, H - textReserve - pad * 2);
        const qrX = Math.round((W - qrSize) / 2);
        const qrY = pad;
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

        if (lines.length > 0) {
            const textY = qrY + qrSize + Math.round(pad / 2);
            drawTextBlock(ctx, lines, pad, textY, W - pad * 2, H - textY - pad, "center");
        }
    }

    return canvas;
}

/** Draw stacked, centered-vertically text lines, shrinking fonts to fit width. */
function drawTextBlock(
    ctx: CanvasRenderingContext2D,
    lines: ThermalLabelLine[],
    x: number,
    y: number,
    w: number,
    h: number,
    align: "left" | "center"
) {
    if (w <= 0 || h <= 0) return;

    // Base font height: split the available height across lines, weighted by scale.
    const totalScale = lines.reduce((s, l) => s + (l.scale ?? 1), 0) || 1;
    const gap = Math.max(2, Math.round(h * 0.06));
    const usableH = h - gap * (lines.length - 1);

    const measured = lines.map((l) => {
        const share = (l.scale ?? 1) / totalScale;
        let fontPx = Math.max(8, Math.floor(usableH * share));
        const family = l.mono ? "ui-monospace, monospace" : "system-ui, sans-serif";
        const weight = l.bold ? "700 " : "500 ";
        // Shrink until the text fits the width.
        for (; fontPx >= 8; fontPx--) {
            ctx.font = `${weight}${fontPx}px ${family}`;
            if (ctx.measureText(l.text).width <= w) break;
        }
        return { line: l, fontPx, font: `${weight}${fontPx}px ${family}` };
    });

    const blockH = measured.reduce((s, m) => s + m.fontPx, 0) + gap * (measured.length - 1);
    let cursorY = y + Math.max(0, Math.round((h - blockH) / 2));

    ctx.textBaseline = "top";
    ctx.textAlign = align;
    const drawX = align === "center" ? x + w / 2 : x;

    for (const m of measured) {
        ctx.font = m.font;
        ctx.fillStyle = "#000000";
        ctx.fillText(m.line.text, drawX, cursorY, w);
        cursorY += m.fontPx + gap;
    }
}

function rasterizeSvg(svgEl: SVGSVGElement): Promise<HTMLImageElement> {
    const xml = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to rasterize QR SVG"));
        };
        img.src = url;
    });
}
