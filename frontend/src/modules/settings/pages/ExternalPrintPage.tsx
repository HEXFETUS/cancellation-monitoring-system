import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import NiimbotPrintControls, {
    type LabelDimensions,
} from "../../../shared/printing/NiimbotPrintControls";
import { renderDeviceLabelCanvas } from "../../../shared/printing/renderDeviceLabelCanvas";
import { useNiimbot } from "../../../shared/printing/niimbot";

const BRAND = "HEXAPRIME INC.";
const PREVIEW_DPI = 600;

export default function ExternalPrintPage() {
    const [deviceNo, setDeviceNo] = useState("");
    const svgRef = useRef<HTMLDivElement>(null);
    const n = useNiimbot();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const widthMm = n.settings.labelWidthMm;
    const heightMm = n.settings.labelHeightMm;
    const payload = deviceNo.trim() || " ";

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
                    { label: "DEVICE NO.", value: deviceNo.trim() || "—" },
                    { label: "", value: "External Printer" },
                ],
            });
        },
        [deviceNo]
    );

    useEffect(() => {
        if (!deviceNo.trim()) {
            setPreviewUrl(null);
            return;
        }
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
    }, [deviceNo, widthMm, heightMm, buildCanvas]);

    const handleDownload = async () => {
        try {
            const canvas = await buildCanvas({ widthMm, heightMm }, PREVIEW_DPI);
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `hexaprime-${deviceNo.trim() || "device"}-qr.png`;
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
                <html><head><title>${deviceNo.trim() || "device"}</title>
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
        <div>
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-ink">Hexa External Printer</h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Generate and print QR labels for external devices with the NIIMBOT printer.
                    </p>
                </div>
            </div>

            {/* Device number input */}
            <div className="mb-5 max-w-lg">
                <label className="mb-1.5 block text-sm font-medium text-ink">
                    DEVICE NO.
                </label>
                <input
                    type="text"
                    value={deviceNo}
                    onChange={(e) => setDeviceNo(e.target.value)}
                    placeholder="Enter device number..."
                    className="w-full rounded-lg border border-warm dark:border-gray-700 bg-card dark:bg-gray-800/70 px-3 py-2 text-sm text-ink dark:text-gray-100 placeholder:text-ink-subtle dark:placeholder:text-gray-400 focus:border-teal dark:focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal dark:focus:ring-teal/50"
                />
                <p className="mt-2 text-xs text-ink-subtle">
                    Enter the device number to generate a QR label.
                </p>
            </div>

            {/* Label preview + print controls */}
            {deviceNo.trim() && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm max-w-lg">
                    {/* Hidden bare QR (level H so the centre logo is safe). */}
                    <div ref={svgRef} className="sr-only" aria-hidden="true">
                        <QRCodeSVG value={payload} size={400} level="H" marginSize={2} />
                    </div>

                    {/* WYSIWYG label preview */}
                    <div className="relative mx-auto w-full max-w-75 rounded-xl border-2 border-dashed border-warm bg-white p-2 shadow-inner">
                        {previewUrl ? (
                            <img
                                src={previewUrl}
                                alt={`Label for device ${deviceNo}`}
                                className="h-auto w-full rounded-lg"
                                style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
                            />
                        ) : (
                            <div
                                className="flex w-full items-center justify-center text-xs text-ink-subtle"
                                style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                                    <span>Generating label…</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
                        {payload}
                    </p>

                    <div className="mt-4">
                        <NiimbotPrintControls renderCanvas={buildCanvas} />
                    </div>

                    <div className="mt-3 flex justify-center gap-2.5">
                        <button
                            onClick={handleDownload}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-white"
                        >
                            <Download size={15} />
                            PNG
                        </button>
                        <button
                            onClick={handlePrint}
                            className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-teal-dark"
                        >
                            <Printer size={15} />
                            Print
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}