import { useEffect, useState } from "react";
import { X, AlertCircle, Trash2 } from "lucide-react";
import { updateCellphone, deleteCellphone } from "../services/cellphones";

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
    mode?: "edit" | "view";
    onEditClick?: () => void;
    isSubOperator?: boolean;
}

export default function EditCpModal({ open, cellphone, onClose, onSubmitted, mode = "edit", onEditClick, isSubOperator = false }: Props) {
    const [brand, setBrand] = useState("");
    const [model, setModel] = useState("");
    const [specs, setSpecs] = useState("");
    const [sn, setSn] = useState("");
    const [imei1, setImei1] = useState("");
    const [imei2, setImei2] = useState("");
    const [controlNo, setControlNo] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

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

    const isViewMode = mode === "view";
    const viewerStyle = "border border-gray-300 bg-white";

    function ViewField({ label, value }: { label: string; value: string }) {
        return (
            <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {label}
                </label>
                <div className="w-full rounded-xl border border-gray-200/70 bg-gray-50/80 px-3 py-2.5 text-sm text-gray-700">
                    {value || "—"}
                </div>
            </div>
        );
    }

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteCellphone(cellphone.id);
            setShowDeleteConfirm(false);
            await onSubmitted();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete cellphone");
        } finally {
            setDeleting(false);
        }
    };

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
            <div className="relative w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-gray-200/60 overflow-hidden">
                {/* Header accent bar */}
                <div className="h-1.5 bg-linear-to-r from-teal via-teal-light to-teal" />

                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                            <h3 className="text-lg font-bold text-gray-800">Delete Cellphone</h3>
                            <p className="mt-2 text-sm text-gray-600">
                                Are you sure you want to delete <strong>{cellphone.brand} {cellphone.model}</strong> ({cellphone.control_no})? This action cannot be undone.
                            </p>
                            {error && (
                                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                                    <AlertCircle size={14} className="shrink-0" />
                                    {error}
                                </div>
                            )}
                            <div className="mt-5 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowDeleteConfirm(false); setError(""); }}
                                    disabled={deleting}
                                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                                >
                                    <Trash2 size={14} />
                                    {deleting ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">{isViewMode ? "View Cellphone Details" : "Edit Cellphone"}</h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {isViewMode ? "Review cellphone information" : "Update the cellphone details"}
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

                        {isViewMode ? (
                            <>
                                {/* View mode: display-only fields */}
                                <ViewField label="Control No." value={controlNo} />
                                <div className="grid grid-cols-2 gap-3">
                                    <ViewField label="Brand" value={brand} />
                                    <ViewField label="Model" value={model} />
                                </div>
                                <ViewField label="Specs" value={specs} />
                                <div className="grid grid-cols-2 gap-3">
                                    <ViewField label="Serial No." value={sn} />
                                    <ViewField label="IMEI1" value={imei1} />
                                </div>
                                <ViewField label="IMEI2" value={imei2 || "—"} />
                            </>
                        ) : (
                            <>
                                {/* Edit mode: input fields */}
                                {/* Control No. — first field */}
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Control No. <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={controlNo}
                                        onChange={(e) => setControlNo(e.target.value)}
                                        placeholder="e.g. BMC-001"
                                        className={`w-full rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30 transition-all ${viewerStyle}`}
                                        disabled={saving}
                                    />
                                </div>

                                {/* Brand + Model on same row */}
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
                                            className={`w-full rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30 transition-all ${viewerStyle}`}
                                            disabled={saving}
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
                                            className={`w-full rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30 transition-all ${viewerStyle}`}
                                            disabled={saving}
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
                                        className={`w-full rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30 transition-all ${viewerStyle}`}
                                        disabled={saving}
                                    />
                                </div>

                                {/* SN + IMEI1 on same row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Serial No. <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={sn}
                                            onChange={(e) => setSn(e.target.value)}
                                            placeholder="e.g. SN-123456"
                                            className={`w-full rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30 transition-all ${viewerStyle}`}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            IMEI1 <span className="text-xs font-normal normal-case text-gray-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={imei1}
                                            onChange={(e) => setImei1(e.target.value)}
                                            placeholder="e.g. 123456789012345"
                                            className={`w-full rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30 transition-all ${viewerStyle}`}
                                            disabled={saving}
                                        />
                                    </div>
                                </div>

                                {/* IMEI2 standalone */}
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        IMEI2 <span className="text-xs font-normal normal-case text-gray-400">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={imei2}
                                        onChange={(e) => setImei2(e.target.value)}
                                        placeholder="e.g. 123456789012346"
                                        className={`w-full rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30 transition-all ${viewerStyle}`}
                                        disabled={saving}
                                    />
                                </div>
                            </>
                        )}

                        {/* Status pill — clean display */}
                        <div className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-gray-50/60 px-4 py-2.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>
                            <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                    cellphone.status === "Active"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-gray-100 text-gray-500"
                                }`}
                            >
                                {cellphone.status === "Active" ? "Active" : "Inactive"}
                            </span>
                        </div>

                        {/* Footer buttons */}
                        <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-200">
                            <div className="flex items-center gap-2">
                                {isViewMode && !isSubOperator && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {isViewMode ? (
                                    isSubOperator ? (
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                        >
                                            Close
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={onEditClick}
                                            className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
                                            style={{
                                                background: "linear-gradient(135deg, #92C7CF, #AAD7D9)",
                                                boxShadow: "0 2px 8px rgba(146,199,207,0.25)",
                                            }}
                                        >
                                            Edit
                                        </button>
                                    )
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            disabled={saving}
                                            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={{
                                                background: "linear-gradient(135deg, #92C7CF, #AAD7D9)",
                                                boxShadow: "0 2px 8px rgba(146,199,207,0.25)",
                                            }}
                                        >
                                            {saving ? "Saving..." : "Save Changes"}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}