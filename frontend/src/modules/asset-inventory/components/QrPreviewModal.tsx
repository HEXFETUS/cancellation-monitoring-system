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

    const handleDownload = () => {
        const svg = svgRef.current?.querySelector("svg");
        if (!svg) return;

        const serializer = new XMLSerializer();
        const xml = serializer.serializeToString(svg);
        const blob = new Blob([xml], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${code.itemCode}-qr.svg`;
        a.click();
        URL.revokeObjectURL(url);
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
                @media print { @page { size: 80mm 100mm; margin: 4mm; } }
            </style>
            </head><body>
                <div class="qr">${xml}</div>
                <div class="brand">HEXAPRIME INC.</div>
                <div class="code">${code.itemCode}</div>
                <div class="label">${code.description}</div>
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
                        Download SVG
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
