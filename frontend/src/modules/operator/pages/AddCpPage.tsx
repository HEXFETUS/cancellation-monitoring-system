import { useEffect, useRef, useState } from "react";
import { Plus, CheckCircle2, AlertCircle, X, Camera, ScanLine } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const SCANNER_REGION_ID = "add-cp-scanner-region";

type ScanTarget = "sn" | "imei1" | "imei2";

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
}

interface AddCpPageProps {
    onClose?: () => void;
    onSuccess?: () => void;
}

export default function AddCpPage({ onClose, onSuccess }: AddCpPageProps = {}) {
    const { user } = useAuth();
    const [me, setMe] = useState<Me | null>(null);

    // Form state
    const [brand, setBrand] = useState("");
    const [model, setModel] = useState("");
    const [specs, setSpecs] = useState("");
    const [sn, setSn] = useState("");
    const [imei1, setImei1] = useState("");
    const [imei2, setImei2] = useState("");
    const [controlNo, setControlNo] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Feedback state
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    // Camera scanner state
    const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null);
    const [scannerError, setScannerError] = useState<string | null>(null);
    const [scannerScanning, setScannerScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    // Auto-detect operator from logged-in user
    useEffect(() => {
        const init = async () => {
            if (!user?.id) return;
            try {
                const meRes = await fetch(`${API_BASE_URL}/api/users/me?id=${user.id}`);
                const meData = meRes.ok ? await meRes.json() : null;
                if (meData) {
                    setMe({
                        id: meData.id,
                        operator_id: meData.operator_id ?? null,
                        parent_operator_id: meData.parent_operator_id ?? null,
                    });
                }
            } catch {
                // silently fail
            }
        };
        init();
    }, [user]);

    // Camera scanner lifecycle
    useEffect(() => {
        if (!scanTarget) return;
        let cancelled = false;
        setScannerError(null);

        const startScanner = async () => {
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
                    (decodedText) => {
                        // Barcode / QR decoded successfully
                        if (cancelled) return;
                        stopScanner();
                        const value = decodedText.trim();
                        // Fill the target field based on which button was clicked
                        if (scanTarget === "sn") setSn(value);
                        else if (scanTarget === "imei1") setImei1(value);
                        else if (scanTarget === "imei2") setImei2(value);
                        setScanTarget(null);
                    },
                    () => {
                        // Per-frame decode failures — ignore
                    }
                );
                if (!cancelled) setScannerScanning(true);
            } catch (err) {
                if (cancelled) return;
                setScannerScanning(false);
                setScannerError(
                    err instanceof Error
                        ? err.message
                        : "Unable to access the camera. Please allow camera permission."
                );
            }
        };

        startScanner();

        return () => {
            cancelled = true;
            stopScanner();
        };
    }, [scanTarget]);

    function stopScanner() {
        const instance = scannerRef.current;
        if (!instance) return;
        (async () => {
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
            setScannerScanning(false);
        })();
    }

    const handleCloseScanner = () => {
        stopScanner();
        setScanTarget(null);
        setScannerError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

    // Validation — all fields required
        if (!brand.trim()) {
            setErrorMessage("Brand is required");
            return;
        }
        if (!model.trim()) {
            setErrorMessage("Model is required");
            return;
        }
        if (!specs.trim()) {
            setErrorMessage("Specs is required");
            return;
        }
        if (!sn.trim()) {
            setErrorMessage("Serial number is required");
            return;
        }
        if (!imei1.trim() && !imei2.trim()) {
            setErrorMessage("At least one IMEI (IMEI1 or IMEI2) is required");
            return;
        }
        if (!controlNo.trim()) {
            setErrorMessage("Control number is required");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/cellphones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    brand: brand.trim(),
                    model: model.trim(),
                    specs: specs.trim(),
                    serialNumber: sn.trim(),
                    imei1: imei1.trim() || null,
                    imei2: imei2.trim() || null,
                    controlNo: controlNo.trim(),
                    operatorId: me?.operator_id,
                    addedByUserId: user?.id,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to add cellphone");
            }

            setSuccessMessage("Cellphone added successfully");
            setBrand("");
            setModel("");
            setSpecs("");
            setSn("");
            setImei1("");
            setImei2("");
            setControlNo("");
            onSuccess?.();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to add cellphone");
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass = (disabled: boolean) =>
        `w-full rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30 transition-all border border-gray-300 bg-white ${disabled ? "opacity-60" : ""}`;

    // Shared scanner viewfinder rendered below whichever field triggered it
    const scannerViewfinder = scanTarget && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                    <ScanLine size={14} className="text-teal" />
                    Point camera at barcode / QR
                </span>
                <button
                    type="button"
                    onClick={handleCloseScanner}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition"
                >
                    <X size={16} />
                </button>
            </div>
            {scannerError ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <div>
                        <p className="font-medium text-red-700">Camera unavailable</p>
                        <p className="mt-1 text-red-500">{scannerError}</p>
                    </div>
                </div>
            ) : (
                <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-900">
                    <div id={SCANNER_REGION_ID} className="h-full w-full" />
                    {!scannerScanning && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                            <div className="flex flex-col items-center gap-2">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                                <p className="text-xs text-white/70">Starting camera…</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="w-full">
            <div className="rounded-2xl bg-white shadow-2xl border border-gray-200/60 overflow-hidden">
                {/* Header accent bar */}
                <div className="h-1.5 bg-linear-to-r from-teal via-teal-light to-teal" />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Add New Cellphone</h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Register a new cellphone device under your operator account.
                            </p>
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Feedback messages */}
                        {successMessage && (
                            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                                <CheckCircle2 size={16} className="shrink-0" />
                                {successMessage}
                            </div>
                        )}
                        {errorMessage && (
                            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                <AlertCircle size={16} className="shrink-0" />
                                {errorMessage}
                            </div>
                        )}

                        {/* Control No. */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Control No. <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={controlNo}
                                onChange={(e) => setControlNo(e.target.value)}
                                placeholder="e.g. BMC-001"
                                className={inputClass(submitting)}
                                disabled={submitting}
                            />
                        </div>

                        {/* Brand + Model */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Brand <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={brand}
                                    onChange={(e) => setBrand(e.target.value)}
                                    placeholder="e.g. Samsung"
                                    className={inputClass(submitting)}
                                    disabled={submitting}
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Model <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    placeholder="e.g. Galaxy S24"
                                    className={inputClass(submitting)}
                                    disabled={submitting}
                                />
                            </div>
                        </div>

                        {/* Specs */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Specs <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={specs}
                                onChange={(e) => setSpecs(e.target.value)}
                                placeholder="e.g. 12GB RAM, 256GB Storage"
                                className={inputClass(submitting)}
                                disabled={submitting}
                            />
                        </div>

                        {/* SN + IMEI1 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    SN <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={sn}
                                        onChange={(e) => setSn(e.target.value)}
                                        placeholder="e.g. SN-123456"
                                        className={`${inputClass(submitting)} flex-1`}
                                        disabled={submitting}
                                        autoComplete="off"
                                    />
                                    {!scanTarget && (
                                        <button
                                            type="button"
                                            onClick={() => setScanTarget("sn")}
                                            disabled={submitting}
                                            title="Scan barcode / QR with camera"
                                            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-500 transition hover:bg-gray-50 hover:text-teal disabled:opacity-50 shrink-0"
                                        >
                                            <Camera size={18} />
                                        </button>
                                    )}
                                </div>
                                {scanTarget === "sn" && scannerViewfinder}
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    IMEI1 <span className="text-xs font-normal normal-case text-gray-400">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={imei1}
                                        onChange={(e) => setImei1(e.target.value)}
                                        placeholder="e.g. 123456789012345"
                                        className={`${inputClass(submitting)} flex-1`}
                                        disabled={submitting}
                                        autoComplete="off"
                                    />
                                    {!scanTarget && (
                                        <button
                                            type="button"
                                            onClick={() => setScanTarget("imei1")}
                                            disabled={submitting}
                                            title="Scan barcode / QR with camera"
                                            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-500 transition hover:bg-gray-50 hover:text-teal disabled:opacity-50 shrink-0"
                                        >
                                            <Camera size={18} />
                                        </button>
                                    )}
                                </div>
                                {scanTarget === "imei1" && scannerViewfinder}
                            </div>
                        </div>

                        {/* IMEI2 */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                IMEI2 <span className="text-xs font-normal normal-case text-gray-400">(optional)</span>
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={imei2}
                                    onChange={(e) => setImei2(e.target.value)}
                                    placeholder="e.g. 123456789012346"
                                    className={`${inputClass(submitting)} flex-1`}
                                    disabled={submitting}
                                    autoComplete="off"
                                />
                                {!scanTarget && (
                                    <button
                                        type="button"
                                        onClick={() => setScanTarget("imei2")}
                                        disabled={submitting}
                                        title="Scan barcode / QR with camera"
                                        className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-500 transition hover:bg-gray-50 hover:text-teal disabled:opacity-50 shrink-0"
                                    >
                                        <Camera size={18} />
                                    </button>
                                )}
                            </div>
                            {scanTarget === "imei2" && scannerViewfinder}
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                            {onClose && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={submitting}
                                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    background: "linear-gradient(135deg, #92C7CF, #AAD7D9)",
                                    boxShadow: "0 2px 8px rgba(146,199,207,0.25)",
                                }}
                            >
                                <Plus size={16} />
                                {submitting ? "Adding..." : "Add Cellphone"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}