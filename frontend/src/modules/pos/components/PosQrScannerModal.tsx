import { useEffect, useRef, useState } from "react";
import {
    AlertCircle,
    Camera,
    Image as ImageIcon,
    ScanLine,
    X,
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import type { PosRecord } from "../types";
import { fetchPosBySerial } from "../services";

const SCANNER_REGION_ID = "pos-qr-scanner-region";

// POS QR stickers encode the device serial_number directly. Basic shape
// validation catches non-POS QRs (URLs, vCards, random text) before we hit
// the API. Serials are alphanumeric with the occasional separator.
const SERIAL_MAX_LENGTH = 100;
const SERIAL_REGEX = /^[A-Za-z0-9 ._/-]+$/;

function validateScannedSerial(payload: string): string | null {
    if (typeof payload !== "string" || payload.length === 0) return "EMPTY_SERIAL";
    if (payload.length > SERIAL_MAX_LENGTH) return "SERIAL_TOO_LONG";
    if (!SERIAL_REGEX.test(payload)) return "SERIAL_FORMAT_INVALID";
    return null;
}

function serialErrorMessage(reason: string, payload: string): string {
    switch (reason) {
        case "EMPTY_SERIAL":
            return "The QR appears empty. Try scanning again.";
        case "SERIAL_TOO_LONG":
            return "This QR is too long to be a device serial. Wrong sticker?";
        case "SERIAL_FORMAT_INVALID":
            return `This isn't a POS QR. Decoded value: "${
                payload.length > 60 ? payload.slice(0, 60) + "..." : payload
            }"`;
        default:
            return "This QR is not a valid device serial.";
    }
}

interface ScanResult {
    payload: string;
    record: PosRecord | null;
    error: string | null;
}

interface Props {
    open: boolean;
    onClose: () => void;
    /** Optional: called with the matched record so the page can react (e.g. highlight the row). */
    onFound?: (record: PosRecord) => void;
}

export default function PosQrScannerModal({ open, onClose, onFound }: Props) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ScanResult | null>(null);

    const stopScanner = async () => {
        const instance = scannerRef.current;
        if (!instance) return;
        try {
            const state = instance.getState?.();
            if (state === Html5QrcodeScannerState.SCANNING) {
                await instance.stop();
            }
            await instance.clear();
        } catch {
            // best-effort
        }
        scannerRef.current = null;
        setScanning(false);
    };

    const lookup = async (payload: string) => {
        const reason = validateScannedSerial(payload);
        if (reason) {
            setResult({ payload, record: null, error: serialErrorMessage(reason, payload) });
            return;
        }

        setResult({ payload, record: null, error: null });
        try {
            const record = await fetchPosBySerial(payload);
            setResult({ payload, record, error: null });
            onFound?.(record);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Lookup failed";
            const notFound = /not found|404/i.test(msg);
            setResult({
                payload,
                record: null,
                error: notFound
                    ? "Looks like a valid POS QR, but no matching device exists."
                    : msg,
            });
        }
    };

    useEffect(() => {
        if (!open) return;
        if (result) return;

        let cancelled = false;
        setError(null);

        const start = async () => {
            try {
                const instance = new Html5Qrcode(SCANNER_REGION_ID, { verbose: false });
                scannerRef.current = instance;
                await instance.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: (viewW, viewH) => {
                            const size = Math.floor(Math.min(viewW, viewH) * 0.7);
                            return { width: size, height: size };
                        },
                    },
                    async (decodedText) => {
                        if (cancelled) return;
                        await stopScanner();
                        await lookup(decodedText.trim());
                    },
                    () => {
                        // Per-frame decode failures fire constantly; ignore.
                    }
                );
                if (!cancelled) setScanning(true);
            } catch (err) {
                if (cancelled) return;
                setScanning(false);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to access the camera. Please allow camera permission."
                );
            }
        };

        start();

        return () => {
            cancelled = true;
            stopScanner();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, result]);

    const handleClose = async () => {
        await stopScanner();
        setResult(null);
        setError(null);
        onClose();
    };

    // Bridge the file-based fallback decoder (inside ScannerPanel) to the
    // single lookup() pipeline used by live scans.
    useEffect(() => {
        if (!open) return;
        const handler = async (e: Event) => {
            const detail = (e as CustomEvent<string>).detail;
            if (typeof detail === "string" && detail.trim()) {
                await stopScanner();
                await lookup(detail.trim());
            }
        };
        window.addEventListener("pos-qr-scanner:decoded", handler);
        return () => window.removeEventListener("pos-qr-scanner:decoded", handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleRescan = async () => {
        setResult(null);
        setError(null);
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-70 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-8"
            onClick={handleClose}
        >
            <div
                className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-warm bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-warm bg-linear-to-r from-teal/15 to-teal-light/15 px-5 py-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70">
                            <ScanLine size={18} className="text-teal-dark" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-ink">
                                {result?.record ? "POS Device" : "Scan POS QR Code"}
                            </h3>
                            <p className="text-xs text-ink-muted">
                                {result?.record
                                    ? "Device details for the scanned sticker."
                                    : "Point your camera at a POS device's QR sticker."}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="rounded-lg p-1.5 text-ink-subtle hover:bg-warm/40 hover:text-ink"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {result ? (
                        <ResultPanel result={result} onRescan={handleRescan} onClose={handleClose} />
                    ) : (
                        <ScannerPanel error={error} scanning={scanning} />
                    )}
                </div>
            </div>
        </div>
    );
}

function ScannerPanel({ error, scanning }: { error: string | null; scanning: boolean }) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [decoding, setDecoding] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    const decodeFromFile = async (file: File) => {
        setDecoding(true);
        setFileError(null);
        try {
            const host = document.createElement("div");
            host.id = `pos-qr-file-host-${Date.now()}`;
            host.style.display = "none";
            document.body.appendChild(host);
            try {
                const reader = new Html5Qrcode(host.id, { verbose: false });
                const decoded = await reader.scanFile(file, false);
                window.dispatchEvent(
                    new CustomEvent("pos-qr-scanner:decoded", { detail: decoded.trim() })
                );
            } finally {
                host.remove();
            }
        } catch (err) {
            setFileError(
                err instanceof Error ? err.message : "Couldn't read a QR code from that image."
            );
        } finally {
            setDecoding(false);
        }
    };

    return (
        <>
            {error ? (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold">Camera unavailable</p>
                        <p className="mt-0.5 text-xs">{error}</p>
                        <p className="mt-1 text-xs">
                            Browsers only allow live camera access on HTTPS or localhost. On a
                            phone over the LAN you can still scan by uploading a photo of the QR —
                            use the button below.
                        </p>
                    </div>
                </div>
            ) : null}

            <div className="relative mx-auto mt-1 aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-black">
                <div id={SCANNER_REGION_ID} className="h-full w-full" />

                {!scanning && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
                        <Camera size={28} />
                        <p className="text-sm">Starting camera...</p>
                    </div>
                )}
            </div>

            <p className="mt-3 text-center text-xs text-ink-subtle">
                Hold steady. The scan will trigger as soon as the QR is detected.
            </p>

            <div className="mt-3 flex flex-col items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={decoding}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-cream disabled:opacity-50"
                >
                    <ImageIcon size={14} />
                    {decoding ? "Decoding..." : "Use a photo of the QR"}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) decodeFromFile(f);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                />
                {fileError && <p className="text-center text-xs text-red-600">{fileError}</p>}
            </div>
        </>
    );
}

function ResultPanel({
    result,
    onRescan,
    onClose,
}: {
    result: ScanResult;
    onRescan: () => void;
    onClose: () => void;
}) {
    const { record, error, payload } = result;

    if (!record) {
        return (
            <div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                        {error ?? "QR scanned"}
                    </p>
                    <p className="mt-1 break-all text-sm text-ink">{payload || "(empty)"}</p>
                    <p className="mt-2 text-xs text-ink-muted">
                        This QR isn't tied to any POS device in the system. You can scan another.
                    </p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-warm bg-card px-3 py-1.5 text-sm text-ink-muted hover:bg-cream"
                    >
                        Done
                    </button>
                    <button
                        onClick={onRescan}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-ink hover:bg-teal-dark"
                    >
                        <ScanLine size={14} />
                        Scan another
                    </button>
                </div>
            </div>
        );
    }

    const rows: Array<{ label: string; value: string }> = [
        { label: "Device No.", value: record.device_no || "—" },
        { label: "Serial No.", value: record.serial_no || record.serial_number || "—" },
        { label: "Area", value: record.area || "—" },
        { label: "Status", value: record.status || "—" },
        { label: "Booth Code", value: record.booth_code || "—" },
        { label: "Booth Location", value: record.booth_location || "—" },
        { label: "Operator", value: record.operator || "—" },
    ];

    return (
        <div>
            <div className="overflow-hidden rounded-xl border border-warm">
                <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-warm/60">
                        {rows.map((r) => (
                            <tr key={r.label}>
                                <th className="bg-cream px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                    {r.label}
                                </th>
                                <td className="px-4 py-2.5 text-ink">{r.value}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="rounded-lg border border-warm bg-card px-3 py-1.5 text-sm text-ink-muted hover:bg-cream"
                >
                    Done
                </button>
                <button
                    onClick={onRescan}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-ink hover:bg-teal-dark"
                >
                    <ScanLine size={14} />
                    Scan another
                </button>
            </div>
        </div>
    );
}
