// Renders a branded device label onto a canvas sized to the physical label
// stock at the printer's native resolution (NIIMBOT B21S = 203 dpi).
//
// Layout (landscape stock such as 50x30mm), matching the reference sticker:
//   ┌───────────────────────────────────┐
//   │  [HEXLOGO]  HEXAPRIME INC.   ┌────┐│
//   │  Device#: 201               │ QR ││
//   │  SN: ABC123                 └────┘│
//   └───────────────────────────────────┘
//
// The brand logo (HEXLOGO.png) is also composited into the centre of the QR.
// The caller must render the QR with error-correction level "H" (30% recovery)
// so the centre logo does not break scanning.
//
// Output is pure black-on-white so the thermal head produces crisp dots;
// niimbluelib's ImageEncoder thresholds luminance when converting to printer
// rows.

import hexLogoUrl from "../../assets/HEXLOGO.png";

export interface DeviceLabelField {
    /** Field label, e.g. "Device#" or "SN". Empty string draws value only. */
    label: string;
    value: string;
}

export interface DeviceLabelOptions {
    /** Physical label width in millimetres. */
    widthMm: number;
    /** Physical label height in millimetres. */
    heightMm: number;
    /** Render resolution in dots per inch. B21S prints at 203. */
    dpi?: number;
    /** Bare QR <svg> element. Render it with level "H" for the centre logo. */
    qrSvg: SVGSVGElement;
    /** Brand text shown next to the logo. Defaults to "HEXAPRIME INC.". */
    brand?: string;
    /** Stacked text fields (Device#, SN, …) drawn under the brand. */
    fields: DeviceLabelField[];
    /** Composite the brand logo into the QR centre. Defaults to true. */
    logoInQrCenter?: boolean;
}

const MM_PER_INCH = 25.4;

let logoPromise: Promise<HTMLImageElement | null> | null = null;

/** Load (and cache) the brand logo. Resolves to null if it fails to load. */
function loadLogo(): Promise<HTMLImageElement | null> {
    if (!logoPromise) {
        logoPromise = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = hexLogoUrl;
        });
    }
    return logoPromise;
}

export async function renderDeviceLabelCanvas(
    opts: DeviceLabelOptions
): Promise<HTMLCanvasElement> {
    const dpi = opts.dpi ?? 203;
    const dotsPerMm = dpi / MM_PER_INCH;
    // The encoder needs the print-head dimension to be a multiple of 8, so keep
    // both dimensions on an /8 grid regardless of print direction.
    const round8 = (n: number) => Math.max(8, Math.round(n / 8) * 8);
    const W = round8(opts.widthMm * dotsPerMm);
    const H = round8(opts.heightMm * dotsPerMm);
    const pad = Math.max(4, Math.round(dotsPerMm * 1.2)); // ~1.2mm margin

    const [qrImg, logo] = await Promise.all([rasterizeSvg(opts.qrSvg), loadLogo()]);

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // ---- QR on the right (square, fit to height) ----
    const qrSize = Math.min(H - pad * 2, Math.floor(W * 0.42));
    const qrX = W - qrSize - pad;
    const qrY = Math.round((H - qrSize) / 2);
    ctx.imageSmoothingEnabled = false; // keep QR modules crisp
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // ---- Logo in the QR centre ----
    if (logo && opts.logoInQrCenter !== false) {
        const box = Math.round(qrSize * 0.26);
        const bx = qrX + Math.round((qrSize - box) / 2);
        const by = qrY + Math.round((qrSize - box) / 2);
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, bx, by, box, box, Math.round(box * 0.18));
        ctx.fill();
        const lpad = Math.round(box * 0.16);
        ctx.imageSmoothingEnabled = true;
        drawImageContain(ctx, logo, bx + lpad, by + lpad, box - lpad * 2, box - lpad * 2);
    }

    // ---- Left region: brand row + fields ----
    ctx.imageSmoothingEnabled = true;
    const leftX = pad;
    const leftW = qrX - pad - leftX;

    // Brand row (logo + brand text), top of the left region.
    const brandH = Math.round(H * 0.3);
    let brandLogoW = 0;
    if (logo) {
        const naturalW = Math.round(brandH * (logo.width / logo.height || 1));
        brandLogoW = Math.min(naturalW, Math.round(leftW * 0.45));
        drawImageContain(ctx, logo, leftX, pad, brandLogoW, brandH);
    }
    const brand = opts.brand ?? "HEXAPRIME INC.";
    const brandTextX = leftX + (brandLogoW ? brandLogoW + Math.round(pad * 0.8) : 0);
    const brandTextW = leftX + leftW - brandTextX;
    if (brandTextW > 0) {
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        setFittedFont(ctx, brand, brandTextW, Math.round(brandH * 0.7), "700", "system-ui, sans-serif");
        ctx.fillText(brand, brandTextX, pad + Math.round(brandH / 2), brandTextW);
    }

    // Fields under the brand row.
    const fieldsY = pad + brandH + Math.round(pad * 0.8);
    const fieldsH = H - fieldsY - pad;
    drawFields(ctx, opts.fields, leftX, fieldsY, leftW, fieldsH);

    return canvas;
}

/** Draw stacked "label: value" lines, shrinking each to fit the width. */
function drawFields(
    ctx: CanvasRenderingContext2D,
    fields: DeviceLabelField[],
    x: number,
    y: number,
    w: number,
    h: number
) {
    if (fields.length === 0 || w <= 0 || h <= 0) return;
    const family = "system-ui, sans-serif";
    const gap = Math.max(2, Math.round(h * 0.08));
    const lineH = Math.floor((h - gap * (fields.length - 1)) / fields.length);
    if (lineH < 1) return;

    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    let cy = y;

    for (const f of fields) {
        const labelText = f.label ? `${f.label}: ` : "";
        // Shrink until "label value" fits the width.
        let fontPx = lineH;
        for (; fontPx >= 8; fontPx--) {
            ctx.font = `500 ${fontPx}px ${family}`;
            const lW = ctx.measureText(labelText).width;
            ctx.font = `700 ${fontPx}px ${family}`;
            const vW = ctx.measureText(f.value).width;
            if (lW + vW <= w) break;
        }
        ctx.fillStyle = "#000000";
        ctx.font = `500 ${fontPx}px ${family}`;
        ctx.fillText(labelText, x, cy);
        const labelW = ctx.measureText(labelText).width;
        ctx.font = `700 ${fontPx}px ${family}`;
        ctx.fillText(f.value, x + labelW, cy, Math.max(1, w - labelW));
        cy += lineH + gap;
    }
}

/** Set ctx.font to the largest size (<= maxPx) whose text fits width w. */
function setFittedFont(
    ctx: CanvasRenderingContext2D,
    text: string,
    w: number,
    maxPx: number,
    weight: string,
    family: string
) {
    let fontPx = Math.max(8, maxPx);
    for (; fontPx >= 8; fontPx--) {
        ctx.font = `${weight} ${fontPx}px ${family}`;
        if (ctx.measureText(text).width <= w) break;
    }
}

/** Draw an image scaled to fit inside the box, preserving aspect ratio. */
function drawImageContain(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
) {
    const ar = img.width / img.height || 1;
    let dw = w;
    let dh = h;
    if (w / h > ar) dw = Math.round(h * ar);
    else dh = Math.round(w / ar);
    const dx = x + Math.round((w - dw) / 2);
    const dy = y + Math.round((h - dh) / 2);
    ctx.drawImage(img, dx, dy, dw, dh);
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
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
