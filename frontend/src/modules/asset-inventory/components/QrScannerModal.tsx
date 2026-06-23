import { useEffect, useRef, useState } from "react";
import {
    AlertCircle,
    Camera,
    Image as ImageIcon,
    Paperclip,
    ScanLine,
    Save,
    Trash2,
    X,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import type { AssetCode } from "../services/assetCodes";
import {
    type AssetMedia,
    deleteAssetMedia,
    getAssetById,
    listAssetMedia,
    updateAssetRemarks,
    uploadAssetMedia,
    type AssetLocation,
} from "../services";
import type { AssetRow } from "./AssetTable";
import { useAuth } from "../../../context/AuthContext";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const ACCEPTED_MIME = /^(image\/(jpe?g|png)|video\/mp4)$/i;
const ACCEPTED_EXT = /\.(jpe?g|png|mp4)$/i;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

// QR stickers now encode the item_code directly (e.g. "1", "2", "ITEM-A")
// rather than a separate qr_payload string. We do basic shape validation so
// non-asset QRs (URLs, vCards, random text) get caught before hitting the API.
const ITEM_CODE_MAX_LENGTH = 100;
const ITEM_CODE_REGEX = /^[A-Za-z0-9._-]+$/;

function validateScannedItemCode(payload: string): string | null {
    if (typeof payload !== "string" || payload.length === 0) return "EMPTY_ITEM_CODE";
    if (payload.length > ITEM_CODE_MAX_LENGTH) return "ITEM_CODE_TOO_LONG";
    if (!ITEM_CODE_REGEX.test(payload)) return "ITEM_CODE_FORMAT_INVALID";
    return null;
}

function itemCodeErrorMessage(reason: string, payload: string): string {
    switch (reason) {
        case "EMPTY_ITEM_CODE":
        case "EMPTY_PAYLOAD":
            return "The QR appears empty. Try scanning again.";
        case "ITEM_CODE_TOO_LONG":
        case "PAYLOAD_TOO_LONG":
            return "This QR is too long to be an asset code. Wrong sticker?";
        case "ITEM_CODE_FORMAT_INVALID":
        case "PAYLOAD_FORMAT_INVALID":
            return `This isn't an asset QR. Decoded value: "${
                payload.length > 60 ? payload.slice(0, 60) + "..." : payload
            }"`;
        default:
            return "This QR is not a valid asset code.";
    }
}

interface AssetCodeWire {
    id: number;
    item_code: string;
    description: string;
    type: string | null;
    department: string | null;
    care_of: string | null;
    space: string | null;
    asset_id: number | null;
    created_at: string;
    updated_at: string;
}

function fromWire(w: AssetCodeWire): AssetCode {
    return {
        id: w.id,
        itemCode: w.item_code,
        description: w.description,
        type: w.type ?? "",
        department: w.department ?? "",
        careOf: w.care_of ?? "",
        space: w.space ?? "",
        // qrPayload is no longer stored — derive a sensible display value
        // from the item_code so any UI that still reads it has something.
        qrPayload: w.item_code,
        assetId: w.asset_id,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
    };
}

function resolveUrl(p?: string | null) {
    if (!p) return "";
    if (/^https?:\/\//i.test(p)) return p;
    return `${API_BASE_URL}${p}`;
}

function isVideo(m: AssetMedia) {
    if (m.mimeType && m.mimeType.startsWith("video/")) return true;
    return /\.mp4(\?|$)/i.test(m.url);
}

interface ScanResult {
    payload: string;
    code: AssetCode | null;
    error: string | null;
}

interface Props {
    open: boolean;
    onClose: () => void;
}

const SCANNER_REGION_ID = "qr-scanner-region";

export default function QrScannerModal({ open, onClose }: Props) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ScanResult | null>(null);

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

    const handleClose = async () => {
        await stopScanner();
        setResult(null);
        setError(null);
        onClose();
    };

    const lookup = async (payload: string) => {
        // Client-side validation first: catches non-asset QRs (URLs, vCards,
        // random text) without hitting the API. Backend repeats the same
        // check as defense in depth.
        const reason = validateScannedItemCode(payload);
        if (reason) {
            setResult({
                payload,
                code: null,
                error: itemCodeErrorMessage(reason, payload),
            });
            return;
        }

        setResult({ payload, code: null, error: null });
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/asset-codes/by-item-code/${encodeURIComponent(payload)}`
            );
            if (res.status === 400) {
                const body = await res.json().catch(() => ({}));
                setResult({
                    payload,
                    code: null,
                    error: itemCodeErrorMessage(body?.error ?? "ITEM_CODE_FORMAT_INVALID", payload),
                });
                return;
            }
            if (res.status === 404) {
                setResult({
                    payload,
                    code: null,
                    error: "Looks like a valid asset QR, but no matching record exists.",
                });
                return;
            }
            if (!res.ok) throw new Error("Lookup failed");
            const data: AssetCodeWire = await res.json();
            setResult({ payload, code: fromWire(data), error: null });
        } catch (err) {
            setResult({
                payload,
                code: null,
                error: err instanceof Error ? err.message : "Lookup failed",
            });
        }
    };

    // Bridge between the file-based fallback decoder (inside ScannerPanel)
    // and the parent so a single lookup() pipeline handles both live scans
    // and uploaded photos.
    useEffect(() => {
        if (!open) return;
        const handler = async (e: Event) => {
            const detail = (e as CustomEvent<string>).detail;
            if (typeof detail === "string" && detail.trim()) {
                await stopScanner();
                await lookup(detail.trim());
            }
        };
        window.addEventListener("qr-scanner:decoded", handler);
        return () => window.removeEventListener("qr-scanner:decoded", handler);
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
                <div className="flex items-center justify-between border-b border-warm bg-gradient-to-r from-teal-50 to-teal-100/50 px-5 py-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-teal-200">
                            <ScanLine size={20} className="text-teal" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-ink">
                                {result?.code ? "Asset Details" : "QR Code Scanner"}
                            </h3>
                            <p className="text-xs text-ink-muted">
                                {result?.code
                                    ? "Asset matched — view details below"
                                    : "Position the QR sticker within the frame to scan"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="rounded-lg p-1.5 text-ink-subtle transition hover:bg-warm/40 hover:text-ink"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-5">
                    {result ? (
                        <ResultPanel
                            result={result}
                            onRescan={handleRescan}
                            onClose={handleClose}
                        />
                    ) : (
                        <ScannerPanel error={error} scanning={scanning} />
                    )}
                </div>
            </div>
        </div>
    );
}

function ScannerPanel({
    error,
    scanning,
}: {
    error: string | null;
    scanning: boolean;
}) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [decoding, setDecoding] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    const decodeFromFile = async (file: File) => {
        setDecoding(true);
        setFileError(null);
        try {
            // html5-qrcode supports decoding from a File without keeping a
            // running camera stream. Mount a hidden host so its internal
            // helpers have a DOM target, then dispose immediately.
            const host = document.createElement("div");
            host.id = `qr-file-host-${Date.now()}`;
            host.style.display = "none";
            document.body.appendChild(host);
            try {
                const reader = new Html5Qrcode(host.id, { verbose: false });
                const decoded = await reader.scanFile(file, false);
                window.dispatchEvent(
                    new CustomEvent("qr-scanner:decoded", { detail: decoded.trim() })
                );
            } finally {
                host.remove();
            }
        } catch (err) {
            setFileError(
                err instanceof Error
                    ? err.message
                    : "Couldn't read a QR code from that image."
            );
        } finally {
            setDecoding(false);
        }
    };

    return (
        <>
            {error ? (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                        <AlertCircle size={18} className="text-red-600" />
                    </div>
                    <div>
                        <p className="font-semibold text-red-800">Camera unavailable</p>
                        <p className="mt-1 text-xs text-red-600">{error}</p>
                        <p className="mt-1.5 text-xs text-red-600/80">
                            Browsers require HTTPS for live camera access. Use the photo option below to scan from an image instead.
                        </p>
                    </div>
                </div>
            ) : null}

            {/* Scanner viewport */}
            <div className="mx-auto mt-3 w-full max-w-sm">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-900 shadow-lg ring-4 ring-slate-700/50">
                    {/* Corner brackets overlay */}
                    <div className="absolute inset-0 z-10 pointer-events-none">
                        <div className="absolute inset-6 rounded-xl border-2 border-teal/40" />
                        <div className="absolute left-3 top-3 h-5 w-5 border-t-2 border-l-2 border-teal" />
                        <div className="absolute right-3 top-3 h-5 w-5 border-t-2 border-r-2 border-teal" />
                        <div className="absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-teal" />
                        <div className="absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-teal" />
                    </div>
                    <div id={SCANNER_REGION_ID} className="h-full w-full" />

                    {!scanning && !error && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-900/90 backdrop-blur-sm">
                            <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-slate-800">
                                <Camera size={28} className="text-teal" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Starting camera…</p>
                                <p className="mt-1 text-xs text-slate-400">Please allow camera access when prompted</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Scan pulse indicator */}
                {scanning && (
                    <div className="mx-auto mt-4 flex items-center justify-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-teal" />
                        </span>
                        <span className="text-xs font-medium text-slate-600">Scanning…</span>
                    </div>
                )}

                <p className="mt-3 text-center text-xs text-slate-500">
                    Hold steady within the frame. Scan triggers automatically when detected.
                </p>
            </div>

            {/* No-camera fallback */}
            <div className="mt-5 flex flex-col items-center gap-2">
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                        <span className="bg-slate-50 px-3 text-slate-400">or</span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={decoding}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                    <ImageIcon size={15} />
                    {decoding ? "Decoding image…" : "Upload a photo of the QR code"}
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
                {fileError && (
                    <p className="text-center text-xs text-red-500">{fileError}</p>
                )}
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
    const { code, error, payload } = result;

    if (!code) {
        return (
            <div className="space-y-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                            <XCircle size={18} className="text-red-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-red-800">
                                {error ?? "QR scanned — no match found"}
                            </p>
                            <p className="mt-1.5 break-all rounded-lg bg-red-100/60 px-2.5 py-1 font-mono text-xs text-red-700">
                                {payload || "(empty payload)"}
                            </p>
                            <p className="mt-2 text-xs text-red-600/80">
                                This code isn't registered in the system. You can add it as a new asset code.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        Done
                    </button>
                    <button
                        onClick={onRescan}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-teal-dark"
                    >
                        <ScanLine size={15} />
                        Scan another
                    </button>
                </div>
            </div>
        );
    }

    return <AssetEditPanel code={code} onRescan={onRescan} onClose={onClose} />;
}

function AssetEditPanel({
    code,
    onRescan,
    onClose,
}: {
    code: AssetCode;
    onRescan: () => void;
    onClose: () => void;
}) {
    const { user } = useAuth();
    const [asset, setAsset] = useState<(AssetRow & { location: AssetLocation }) | null>(null);
    const [media, setMedia] = useState<AssetMedia[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const [remarksDraft, setRemarksDraft] = useState("");
    const [savingRemarks, setSavingRemarks] = useState(false);
    const [remarksMsg, setRemarksMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [pending, setPending] = useState<File[]>([]);
    const [caption, setCaption] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

    const [lightbox, setLightbox] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setLoadError("");

                if (!code.assetId) {
                    if (!cancelled) {
                        setAsset(null);
                        setMedia([]);
                    }
                    return;
                }

                const [a, m] = await Promise.all([
                    getAssetById(code.assetId),
                    listAssetMedia(code.assetId),
                ]);
                if (cancelled) return;
                setAsset(a);
                setRemarksDraft(a?.remarks ?? "");
                setMedia(m);
            } catch (e) {
                if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load asset");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [code.assetId]);

    const handleSaveRemarks = async () => {
        if (!asset) return;
        setSavingRemarks(true);
        setRemarksMsg(null);
        try {
            const updated = await updateAssetRemarks(Number(asset.id), remarksDraft);
            setAsset(updated);
            setRemarksDraft(updated.remarks ?? "");
            setRemarksMsg({ kind: "ok", text: "Remarks saved." });
        } catch (e) {
            setRemarksMsg({
                kind: "err",
                text: e instanceof Error ? e.message : "Failed to save",
            });
        } finally {
            setSavingRemarks(false);
        }
    };

    const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? []);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (picked.length === 0) return;

        setUploadMsg(null);
        const next = [...pending];
        for (const f of picked) {
            if (!ACCEPTED_MIME.test(f.type) || !ACCEPTED_EXT.test(f.name)) {
                setUploadMsg({
                    kind: "err",
                    text: "Only JPG, PNG, and MP4 files are allowed.",
                });
                continue;
            }
            if (f.size > MAX_FILE_BYTES) {
                setUploadMsg({ kind: "err", text: `${f.name} exceeds 25 MB.` });
                continue;
            }
            next.push(f);
        }
        setPending(next);
    };

    const removePending = (idx: number) => {
        setPending((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleUpload = async () => {
        if (!asset || pending.length === 0) return;
        setUploading(true);
        setUploadMsg(null);
        try {
            const uploaded = await uploadAssetMedia(Number(asset.id), pending, {
                caption: caption.trim() || undefined,
                userId: user?.id,
            });
            setMedia((prev) => [...uploaded, ...prev]);
            setPending([]);
            setCaption("");
            setUploadMsg({ kind: "ok", text: `${uploaded.length} file(s) uploaded.` });
        } catch (e) {
            setUploadMsg({
                kind: "err",
                text: e instanceof Error ? e.message : "Upload failed",
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteMedia = async (m: AssetMedia) => {
        if (!asset) return;
        if (!window.confirm("Remove this attachment?")) return;
        try {
            await deleteAssetMedia(Number(asset.id), m.id);
            setMedia((prev) => prev.filter((x) => x.id !== m.id));
        } catch (e) {
            // Purchasers are blocked from this endpoint; surface that gracefully.
            setUploadMsg({
                kind: "err",
                text: e instanceof Error ? e.message : "Could not remove attachment",
            });
        }
    };

    return (
        <div className="space-y-5">
            {/* Asset code summary */}
            <section className="relative overflow-hidden rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm">
                <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-teal-100">
                    <CheckCircle2 size={18} className="text-teal" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-teal">
                    Asset Matched
                </p>
                <h4 className="mt-1.5 text-xl font-bold text-ink tracking-tight">{code.itemCode}</h4>
                <p className="mt-1 text-sm text-ink-muted">{code.description}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                    <Field label="Type" value={code.type || "—"} />
                    <Field label="Department" value={code.department || "—"} />
                    <Field label="Care Of" value={code.careOf || "—"} />
                    <Field label="Space" value={code.space || "—"} />
                    <Field label="Asset ID" value={code.assetId ? `#${code.assetId}` : "—"} highlight />
                </dl>
            </section>

            {/* Linked asset details */}
            {loading ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-warm bg-white p-6">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                    <p className="text-sm text-ink-subtle">Loading asset details…</p>
                </div>
            ) : loadError ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    {loadError}
                </div>
            ) : !asset ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                            <AlertCircle size={18} className="text-amber-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-amber-800">No linked asset record</p>
                            <p className="mt-1 text-xs text-amber-700/80">
                                This QR code isn't yet tied to an asset row. Visit the Asset Coding page to link it.
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <section className="rounded-xl border border-warm bg-card p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h5 className="text-sm font-semibold text-ink">Asset</h5>
                            <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                                {asset.location}
                            </span>
                        </div>
                        <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                            <Field label="Item Description" value={asset.itemDescription || "—"} />
                            <Field label="Type" value={asset.type || "—"} />
                            <Field label="Serial #" value={asset.serialNumber || "—"} />
                            <Field label="Vendor" value={asset.vendor || "—"} />
                            <Field label="Department" value={asset.department || "—"} />
                            <Field label="Space" value={asset.space || "—"} />
                            <Field
                                label="Asset Value"
                                value={
                                    asset.assetValue
                                        ? `₱ ${asset.assetValue.toLocaleString()}`
                                        : "—"
                                }
                            />
                            <Field label="Quantity" value={String(asset.quantity || 0)} />
                            <Field
                                label="Total Value"
                                value={
                                    asset.totalValue
                                        ? `₱ ${asset.totalValue.toLocaleString()}`
                                        : "—"
                                }
                            />
                        </dl>
                    </section>

                    {/* Remarks editor */}
                    <section className="rounded-xl border border-warm bg-card p-4">
                        <div className="mb-2 flex items-center justify-between">
                            <h5 className="text-sm font-semibold text-ink">Remarks</h5>
                            {remarksDraft !== (asset.remarks ?? "") && (
                                <span className="text-[10px] uppercase tracking-wide text-amber-600">
                                    Unsaved changes
                                </span>
                            )}
                        </div>
                        <textarea
                            value={remarksDraft}
                            onChange={(e) => setRemarksDraft(e.target.value)}
                            disabled={savingRemarks}
                            rows={3}
                            placeholder="Add remarks about this asset..."
                            className="w-full resize-y rounded-lg border border-warm bg-white px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal disabled:opacity-50"
                        />
                        <div className="mt-2 flex items-center justify-between gap-2">
                            {remarksMsg ? (
                                <p
                                    className={`text-xs ${
                                        remarksMsg.kind === "ok"
                                            ? "text-teal-dark"
                                            : "text-red-600"
                                    }`}
                                >
                                    {remarksMsg.text}
                                </p>
                            ) : (
                                <span />
                            )}
                            <button
                                onClick={handleSaveRemarks}
                                disabled={
                                    savingRemarks || remarksDraft === (asset.remarks ?? "")
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-ink hover:bg-teal-dark disabled:opacity-50"
                            >
                                <Save size={14} />
                                {savingRemarks ? "Saving..." : "Save remarks"}
                            </button>
                        </div>
                    </section>

                    {/* Media uploader */}
                    <section className="rounded-xl border border-warm bg-card p-4">
                        <h5 className="mb-2 text-sm font-semibold text-ink">
                            Photos &amp; Videos
                        </h5>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-cream disabled:opacity-50"
                            >
                                <Paperclip size={14} />
                                Choose files
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,video/mp4"
                                multiple
                                className="hidden"
                                onChange={handlePickFiles}
                            />
                            <input
                                type="text"
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="Optional caption (applies to this batch)"
                                disabled={uploading}
                                className="flex-1 min-w-45 rounded-lg border border-warm bg-white px-3 py-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            />
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading || pending.length === 0}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-ink hover:bg-teal-dark disabled:opacity-50"
                            >
                                <ImageIcon size={14} />
                                {uploading
                                    ? "Uploading..."
                                    : `Upload${pending.length ? ` (${pending.length})` : ""}`}
                            </button>
                        </div>

                        {pending.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {pending.map((f, idx) => (
                                    <span
                                        key={`${f.name}-${idx}`}
                                        className="inline-flex items-center gap-1 rounded-md bg-cream px-2 py-0.5 text-[11px] text-ink"
                                    >
                                        <Paperclip size={11} />
                                        <span className="max-w-40 truncate">{f.name}</span>
                                        <button
                                            onClick={() => removePending(idx)}
                                            className="rounded p-0.5 text-ink-subtle hover:bg-warm/60"
                                        >
                                            <X size={11} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {uploadMsg && (
                            <p
                                className={`mt-2 text-xs ${
                                    uploadMsg.kind === "ok"
                                        ? "text-teal-dark"
                                        : "text-red-600"
                                }`}
                            >
                                {uploadMsg.text}
                            </p>
                        )}

                        {/* Gallery */}
                        {media.length === 0 ? (
                            <p className="mt-3 text-xs text-ink-subtle">
                                No attachments yet. JPG, PNG, or MP4 — up to 25 MB each.
                            </p>
                        ) : (
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {media.map((m) => (
                                    <div
                                        key={m.id}
                                        className="group relative overflow-hidden rounded-lg border border-warm bg-cream"
                                    >
                                        {isVideo(m) ? (
                                            <video
                                                src={resolveUrl(m.url)}
                                                controls
                                                className="h-32 w-full bg-black object-contain"
                                            />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setLightbox(resolveUrl(m.url))}
                                                className="block w-full"
                                            >
                                                <img
                                                    src={resolveUrl(m.url)}
                                                    alt={m.caption || "asset media"}
                                                    className="h-32 w-full object-cover transition group-hover:scale-105"
                                                />
                                            </button>
                                        )}
                                        <div className="flex items-center justify-between gap-1 px-2 py-1 text-[10px] text-ink-muted">
                                            <span className="truncate" title={m.caption || ""}>
                                                {m.caption ||
                                                    (m.uploadedByName
                                                        ? `by ${m.uploadedByName}`
                                                        : "")}
                                            </span>
                                            <button
                                                onClick={() => handleDeleteMedia(m)}
                                                className="shrink-0 rounded p-1 text-red-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-50"
                                                title="Remove"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}

            {/* Footer actions */}
            <div className="flex justify-end gap-2 border-t border-warm pt-3">
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

            {/* Lightbox */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-80 flex items-center justify-center bg-black/85 p-4"
                    onClick={() => setLightbox(null)}
                >
                    <button
                        type="button"
                        onClick={() => setLightbox(null)}
                        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                    >
                        <X size={20} />
                    </button>
                    <img
                        src={lightbox}
                        alt=""
                        className="max-h-full max-w-full rounded-xl object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                {label}
            </dt>
            <dd className={`mt-0.5 text-sm ${highlight ? "font-semibold text-teal-dark" : "text-ink"}`}>
                {value}
            </dd>
        </div>
    );
}
