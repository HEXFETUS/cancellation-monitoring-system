import { useEffect, useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { updateCellphone } from "../services/cellphones";

interface CellphoneRecord {
    id: number;
    brand: string;
    model: string;
    specs: string;
    serial_number: string;
    imei1: string | null;
    imei2: string | null;
    control_no: string;
    operator_id: number | null;
    added_by_user_id: number | null;
    status: string;
    booth_id: number | null;
    created_at: string;
    updated_at: string;
}

interface Props {
    open: boolean;
    cellphone: CellphoneRecord | null;
    onClose: () => void;
    onSubmitted: () => Promise<void>;
}

export default function EditCpModal({ open, cellphone, onClose, onSubmitted }: Props) {
    const [brand, setBrand] = useState("");
    const [model, setModel] = useState("");
    const [specs, setSpecs] = useState("");
    const [sn, setSn] = useState("");
    const [imei1, setImei1] = useState("");
    const [imei2, setImei2] = useState("");
    const [controlNo, setControlNo] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open && cellphone) {
            setBrand(cellphone.brand || "");
            setModel(cellphone.model || "");
            setSpecs(cellphone.specs || "");
            setSn(cellphone.serial_number || "");
            setImei1(cellphone.imei1 || "");
            setImei2(cellphone.imei2 || "");
            setControlNo(cellphone.control_no || "");
            setError("");
        }
    }, [open, cellphone]);

    if (!open || !cellphone) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validation
        if (!brand.trim()) { setError("Brand is required"); return; }
        if (!model.trim()) { setError("Model is required"); return; }
        if (!specs.trim()) { setError("Specs is required"); return; }
        if (!sn.trim()) { setError("Serial number is required"); return; }
        if (!imei1.trim() && !imei2.trim()) { setError("At least one IMEI (IMEI1 or IMEI2) is required"); return; }
        if (!controlNo.trim()) { setError("Control number is required"); return; }

        setSaving(true);
        try {
            await updateCellphone(cellphone.id, {
                brand: brand.trim(),
                model: model.trim(),
                specs: specs.trim(),
                serialNumber: sn.trim(),
                imei1: imei1.trim() || null,
                imei2: imei2.trim() || null,
                controlNo: controlNo.trim(),
            });
            await onSubmitted();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update cellphone");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm pt-16 px-4">
            <div className="relative w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                {/* Header accent bar */}
                <div className="h-2 bg-linear-to-r from-teal to-teal-dark" />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-ink">Edit Cellphone</h2>
                            <p className="text-sm text-ink-muted mt-0.5">
                                Update the cellphone details
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
                            disabled={saving}
                        >
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                <AlertCircle size={16} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Device info display */}
                        <div className="rounded-lg border border-warm bg-gray-50 px-3 py-2 text-xs text-gray-500 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">ID:</span>
                                <span>#{cellphone.id}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">Status:</span>
                                <span className={`font-semibold ${cellphone.status === "Active" ? "text-emerald-600" : "text-gray-500"}`}>{cellphone.status}</span>
                            </div>
                        </div>

                        {/* Brand */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Brand <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={brand}
                                onChange={(e) => setBrand(e.target.value)}
                                placeholder="e.g. Samsung"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                disabled={saving}
                            />
                        </div>

                        {/* Model */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Model <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="e.g. Galaxy S24 Ultra"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                disabled={saving}
                            />
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
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                disabled={saving}
                            />
                        </div>

                        {/* Serial Number */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Serial No. <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={sn}
                                onChange={(e) => setSn(e.target.value)}
                                placeholder="e.g. SN-123456"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                disabled={saving}
                            />
                        </div>

                        {/* IMEI1 */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                IMEI1 <span className="text-xs font-normal normal-case text-gray-400">(at least one required)</span>
                            </label>
                            <input
                                type="text"
                                value={imei1}
                                onChange={(e) => setImei1(e.target.value)}
                                placeholder="e.g. 123456789012345"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                disabled={saving}
                            />
                        </div>

                        {/* IMEI2 */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                IMEI2 <span className="text-xs font-normal normal-case text-gray-400">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={imei2}
                                onChange={(e) => setImei2(e.target.value)}
                                placeholder="e.g. 123456789012346"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                disabled={saving}
                            />
                        </div>

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
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                disabled={saving}
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    background: "linear-gradient(135deg, #92C7CF, #AAD7D9)",
                                    boxShadow: "0 2px 8px rgba(146,199,207,0.25)",
                                }}
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}