import { useRef } from "react";
import { Download, Printer, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { AssetCode } from "../services/assetCodes";

interface Props {
    open: boolean;
    code: AssetCode | null;
    onClose: () => void;
}

export default function QrPreviewModal({ open, code, onClose }: Props) {
    const svgRef = useRef<HTMLDivElement>(null);

    if (!open || !code) return null;

    // Use updatedAt because regenerating a QR bumps it; falls back to createdAt.
    const issuedAt = code.updatedAt || code.createdAt;
    const issuedLabel = formatDateTime(issuedAt);

    const handleDownload = async () => {
        const svg = svgRef.current?.querySelector("svg");
        if (!svg) return;

        try {
            const blob = await renderLabelPng(svg, {
                brand: "HEXAPRIME INC.",
                code: code.itemCode,
                description: code.description,
                issued: `Issued ${issuedLabel}`,
                payload: code.qrPayload,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${code.itemCode}-qr.png`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("PNG export failed:", err);
            alert("Could not generate PNG. Please try Print instead.");
        }
    };

    const handlePrint = () => {
        const svg = svgRef.current?.querySelector("svg");
        if (!svg) return;
        const xml = new XMLSerializer().serializeToString(svg);
        const win = window.open("", "_blank", "width=400,height=500");
        if (!win) return;
        win.document.write(`
            <!doctype html>
            <html><head><title>${code.itemCode}</title>
            <style>
                body { font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
                .qr { display: inline-block; }
                .brand {
                    margin-top: 10px;
                    font-size: 14px;
                    font-weight: 700;
                    letter-spacing: 0.18em;
                    color: #1a1a1a;
                }
                .code { font-weight: 600; font-size: 16px; margin-top: 8px; color: #4a4a4a; }
                .label { margin-top: 2px; font-size: 12px; color: #6b6b6b; }
                .issued { margin-top: 6px; font-size: 10px; color: #999; }
                @media print { @page { size: 80mm 100mm; margin: 4mm; } }
            </style>
            </head><body>
                <div class="qr">${xml}</div>
                <div class="brand">HEXAPRIME INC.</div>
                <div class="code">${code.itemCode}</div>
                <div class="label">${code.description}</div>
                <div class="issued">Issued ${issuedLabel}</div>
            </body></html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-warm bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-warm px-6 py-4">
                    <h3 className="text-lg font-semibold text-ink">QR Code</h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-ink-subtle transition hover:bg-cream hover:text-ink"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 py-6 text-center">
                    <div
                        ref={svgRef}
                        className="mx-auto inline-flex rounded-xl border border-warm bg-white p-4"
                    >
                        <QRCodeSVG
                            value={code.qrPayload}
                            size={220}
                            level="M"
                            marginSize={2}
                        />
                    </div>

                    <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-ink">
                        HEXAPRIME INC.
                    </p>
                    <p className="mt-2 text-base font-bold text-ink">{code.itemCode}</p>
                    <p className="text-sm text-ink-muted">{code.description}</p>
                    <p className="mt-2 text-xs text-ink-subtle">Issued {issuedLabel}</p>
                    <p className="mt-3 break-all rounded-lg bg-cream px-3 py-2 font-mono text-xs text-ink-muted">
                        {code.qrPayload}
                    </p>
                </div>

                <div className="flex justify-center gap-3 border-t border-warm bg-cream px-6 py-4">
                    <button
                        onClick={handleDownload}
                        className="inline-flex items-center gap-2 rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40"
                    >
                        <Download size={16} />
                        Download PNG
                    </button>
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark"
                    >
                        <Printer size={16} />
                        Print
                    </button>
                </div>
            </div>
        </div>
    );
}

function formatDateTime(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

interface LabelText {
    brand: string;
    code: string;
    description: string;
    issued: string;
    payload: string;
}

/**
 * Compose a printable label as a PNG: QR on top, then HEXAPRIME, code,
 * description, issued date, and payload underneath. Uses canvas so the
 * output is a single rasterized image.
 */
async function renderLabelPng(svgEl: SVGSVGElement, text: LabelText): Promise<Blob> {
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

    const lines: Array<{ text: string; font: string; gap: number; color: string }> = [
        { text: text.brand, font: `bold ${14 * SCALE}px system-ui, sans-serif`, gap: 16 * SCALE, color: "#1a1a1a" },
        { text: text.code, font: `600 ${16 * SCALE}px system-ui, sans-serif`, gap: 8 * SCALE, color: "#4a4a4a" },
        { text: text.description, font: `${12 * SCALE}px system-ui, sans-serif`, gap: 6 * SCALE, color: "#6b6b6b" },
        { text: text.issued, font: `${10 * SCALE}px system-ui, sans-serif`, gap: 10 * SCALE, color: "#999999" },
        { text: text.payload, font: `${9 * SCALE}px ui-monospace, monospace`, gap: 0, color: "#999999" },
    ];

    // Wrap each line to canvas width and accumulate total height
    const maxTextWidth = W - PAD * 2;
    const wrapped: Array<{ text: string[]; lineHeight: number; gap: number; font: string; color: string }> = [];
    let textHeight = 0;

    for (const l of lines) {
        mctx.font = l.font;
        const lh = parseInt(l.font.match(/(\d+)px/)?.[1] || "12", 10) * 1.25;
        const wrappedLines = wrapText(mctx, l.text, maxTextWidth);
        wrapped.push({
            text: wrappedLines,
            lineHeight: lh,
            gap: l.gap,
            font: l.font,
            color: l.color,
        });
        textHeight += wrappedLines.length * lh + l.gap;
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
