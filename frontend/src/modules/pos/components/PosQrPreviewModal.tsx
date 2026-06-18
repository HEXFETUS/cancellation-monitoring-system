import { useRef } from "react";
import { Download, Printer, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { PosRecord } from "../types";
import { renderLabelPng } from "../../../shared/qr/renderLabelPng";
import NiimbotPrintControls from "../../../shared/printing/NiimbotPrintControls";

interface Props {
    open: boolean;
    record: PosRecord | null;
    onClose: () => void;
}

/**
 * Printable / downloadable QR sticker for a POS device. The QR encodes the
 * device serial_number; scanning it (see PosQrScannerModal) pulls the record
 * back up on the POS page.
 */
export default function PosQrPreviewModal({ open, record, onClose }: Props) {
    const svgRef = useRef<HTMLDivElement>(null);

    if (!open || !record) return null;

    const serial = record.serial_no || record.serial_number || "";
    const boothLabel = record.booth_code
        ? `Booth ${record.booth_code}`
        : "Unassigned booth";

    const handleDownload = async () => {
        const svg = svgRef.current?.querySelector("svg");
        if (!svg) return;

        try {
            const blob = await renderLabelPng(svg, [
                { text: "HEXAPRIME INC.", size: 14, weight: "bold", color: "#1a1a1a", gap: 16 },
                { text: record.device_no, size: 16, weight: "600", color: "#4a4a4a", gap: 8 },
                { text: record.area ? `Area: ${record.area}` : "POS Device", size: 12, color: "#6b6b6b", gap: 6 },
                { text: boothLabel, size: 10, color: "#999999", gap: 10 },
                { text: serial, size: 9, mono: true, color: "#999999", gap: 0 },
            ]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${record.device_no || serial}-qr.png`;
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
            <html><head><title>${record.device_no}</title>
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
                .device { font-weight: 600; font-size: 16px; margin-top: 8px; color: #4a4a4a; }
                .label { margin-top: 2px; font-size: 12px; color: #6b6b6b; }
                .booth { margin-top: 6px; font-size: 10px; color: #999; }
                .serial { margin-top: 6px; font-size: 10px; font-family: ui-monospace, monospace; color: #999; }
                @media print { @page { size: 80mm 100mm; margin: 4mm; } }
            </style>
            </head><body>
                <div class="qr">${xml}</div>
                <div class="brand">HEXAPRIME INC.</div>
                <div class="device">${record.device_no}</div>
                <div class="label">${record.area ? `Area: ${record.area}` : "POS Device"}</div>
                <div class="booth">${boothLabel}</div>
                <div class="serial">${serial}</div>
            </body></html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 pb-8">
            <div className="w-full max-w-md rounded-2xl border border-warm bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-warm px-6 py-4">
                    <h3 className="text-lg font-semibold text-ink">POS QR Code</h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-ink-subtle transition hover:bg-cream hover:text-ink"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 py-6 text-center">
                    {serial ? (
                        <>
                            <div
                                ref={svgRef}
                                className="mx-auto inline-flex rounded-xl border border-warm bg-white p-4"
                            >
                                <QRCodeSVG value={serial} size={220} level="M" marginSize={2} />
                            </div>

                            <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-ink">
                                HEXAPRIME INC.
                            </p>
                            <p className="mt-2 text-base font-bold text-ink">{record.device_no}</p>
                            <p className="text-sm text-ink-muted">
                                {record.area ? `Area: ${record.area}` : "POS Device"}
                            </p>
                            <p className="mt-1 text-xs text-ink-subtle">{boothLabel}</p>
                            <p className="mt-3 break-all rounded-lg bg-cream px-3 py-2 font-mono text-xs text-ink-muted">
                                {serial}
                            </p>

                            <NiimbotPrintControls
                                svgContainerRef={svgRef}
                                lines={[
                                    { text: record.device_no, bold: true, scale: 1.3 },
                                    { text: serial, mono: true, scale: 1 },
                                ]}
                                className="mt-4"
                            />
                        </>
                    ) : (
                        <p className="py-8 text-sm text-ink-muted">
                            This device has no serial number, so a QR code can't be generated.
                        </p>
                    )}
                </div>

                {serial && (
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
                )}
            </div>
        </div>
    );
}
