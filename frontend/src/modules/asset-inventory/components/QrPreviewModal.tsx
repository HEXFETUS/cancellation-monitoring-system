import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Printer, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { AssetCode } from "../services/assetCodes";
import NiimbotPrintControls, {
    type LabelDimensions,
} from "../../../shared/printing/NiimbotPrintControls";
import { renderDeviceLabelCanvas } from "../../../shared/printing/renderDeviceLabelCanvas";
import { useNiimbot } from "../../../shared/printing/niimbot";

interface Props {
    open: boolean;
    code: AssetCode | null;
    onClose: () => void;
}

const BRAND = "HEXAPRIME INC.";
const PREVIEW_DPI = 600;

export default function QrPreviewModal({ open, code, onClose }: Props) {
    const svgRef = useRef<HTMLDivElement>(null);
    const n = useNiimbot();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const widthMm = n.settings.labelWidthMm;
    const heightMm = n.settings.labelHeightMm;
    const payload = code?.qrPayload ?? "";

    const buildCanvas = useCallback(
        async (dims: LabelDimensions, dpi?: number) => {
            const svg = svgRef.current?.querySelector("svg") as SVGSVGElement | null;
            if (!svg) throw new Error("QR not ready");
            return renderDeviceLabelCanvas({
                widthMm: dims.widthMm,
                heightMm: dims.heightMm,
                dpi,
                qrSvg: svg,
                brand: BRAND,
                fields: [
                    { label: "Code", value: code?.itemCode ?? "" },
                    { label: "", value: code?.description ?? "" },
                ],
            });
        },
        [code?.itemCode, code?.description]
    );

    useEffect(() => {
        if (!open || !payload) return;
        let cancelled = false;
        (async () => {
            setPreviewUrl(null);
            try {
                const canvas = await buildCanvas({ widthMm, heightMm }, PREVIEW_DPI);
                if (!cancelled) setPreviewUrl(canvas.toDataURL("image/png"));
            } catch {
                if (!cancelled) setPreviewUrl(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, payload, widthMm, heightMm, buildCanvas]);

    if (!open || !code) return null;

    const handleDownload = async () => {
        try {
            const canvas = await buildCanvas({ widthMm, heightMm }, PREVIEW_DPI);
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${code.itemCode}-qr.png`;
                a.click();
                URL.revokeObjectURL(url);
            }, "image/png");
        } catch (err) {
            console.error("PNG export failed:", err);
            alert("Could not generate PNG. Please try Print instead.");
        }
    };

    const handlePrint = async () => {
        try {
            const canvas = await buildCanvas({ widthMm, heightMm }, PREVIEW_DPI);
            const dataUrl = canvas.toDataURL("image/png");
            const win = window.open("", "_blank", "width=480,height=360");
            if (!win) return;
            win.document.write(`
                <!doctype html>
                <html><head><title>${code.itemCode}</title>
                <style>
                    html, body { margin: 0; padding: 0; }
                    body { text-align: center; }
                    img { width: ${widthMm}mm; height: ${heightMm}mm; object-fit: contain; }
                    @media screen { body { padding: 16px; background: #f4f4f4; } }
                    @media print { @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; } }
                </style>
                </head><body>
                    <img src="${dataUrl}" />
                </body></html>
            `);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 300);
        } catch (err) {
            console.error("Print failed:", err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 pb-8">
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
                    {/* Hidden bare QR (level H so the centre logo is safe). */}
                    <div ref={svgRef} className="sr-only" aria-hidden="true">
                        <QRCodeSVG value={payload} size={400} level="H" marginSize={2} />
                    </div>

                    {/* WYSIWYG label preview */}
                    <div className="mx-auto inline-flex rounded-xl border border-warm bg-white p-3">
                        {previewUrl ? (
                            <img
                                src={previewUrl}
                                alt={`Label for ${code.itemCode}`}
                                className="h-auto w-full max-w-[320px]"
                                style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
                            />
                        ) : (
                            <div
                                className="flex w-[320px] items-center justify-center text-xs text-ink-subtle"
                                style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
                            >
                                Generating label…
                            </div>
                        )}
                    </div>

                    <p className="mt-3 break-all rounded-lg bg-cream px-3 py-2 font-mono text-xs text-ink-muted">
                        {payload}
                    </p>

                    <NiimbotPrintControls renderCanvas={buildCanvas} className="mt-4" />
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
