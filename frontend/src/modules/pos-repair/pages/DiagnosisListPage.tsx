import { useState, useEffect } from "react";
import {
    Plus,
    Edit,
    Trash2,
    X,
    Save,
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    RefreshCw,
    Stethoscope,
} from "lucide-react";
import {
    listDiagnoses,
    createDiagnosis,
    updateDiagnosis,
    deleteDiagnosis,
} from "../services/diagnosisList";
import type { DiagnosisItem } from "../services/diagnosisList";
import CsrConfirmationModal from "../../csr/components/CsrConfirmationModal";
import Pagination from "../components/Pagination";

const teal = "#92C7CF";

/* ─── Toast ─── */
interface Toast {
    show: boolean;
    message: string;
    type: "error" | "success";
}

/* ─── Create / Edit Modal ─── */
interface FormModalProps {
    mode: "create" | "edit";
    initialName?: string;
    onClose: () => void;
    onSave: (name: string) => void;
    saving: boolean;
    error: string | null;
}

function FormModal({ mode, initialName = "", onClose, onSave, saving, error }: FormModalProps) {
    const [name, setName] = useState(initialName);

    const handleSubmit = () => onSave(name);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm pt-16 px-4">
            <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-ink">
                                {mode === "create" ? "New Diagnosis" : "Edit Diagnosis"}
                            </h2>
                            <p className="text-sm text-ink-muted mt-0.5">
                                {mode === "create"
                                    ? "Add a new entry to the diagnosis list"
                                    : "Update the diagnosis name"}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-ink mb-1.5">
                                Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && name.trim()) handleSubmit();
                                }}
                                placeholder="Enter diagnosis name..."
                                autoFocus
                                className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-rose-500 flex items-center gap-1">
                                <AlertTriangle size={14} />
                                {error}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-warm/60">
                        <button
                            onClick={onClose}
                            className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving || !name.trim()}
                            className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <span className="inline-flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Saving...
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-2">
                                    <Save className="h-4 w-4" />
                                    {mode === "create" ? "Create" : "Save Changes"}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ─── */
export default function DiagnosisListPage() {
    const [items, setItems] = useState<DiagnosisItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /* modal state */
    const [showForm, setShowForm] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingItem, setEditingItem] = useState<DiagnosisItem | null>(null);
    const [formSaving, setFormSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    /* delete confirmation */
    const [deletingItem, setDeletingItem] = useState<DiagnosisItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    /* toast */
    const [toast, setToast] = useState<Toast>({ show: false, message: "", type: "success" });

    const showToast = (message: string, type: "error" | "success" = "success") => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: "", type: "success" }), 4000);
    };
    const hideToast = () => setToast({ show: false, message: "", type: "success" });

    /* ─── Fetch ─── */
    const fetchItems = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listDiagnoses();
            setItems(data);
        } catch (err) {
            console.error("Failed to fetch diagnoses:", err);
            setError(err instanceof Error ? err.message : "Failed to load diagnoses");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    /* ─── Create ─── */
    const handleCreate = () => {
        setFormMode("create");
        setEditingItem(null);
        setFormError(null);
        setShowForm(true);
    };

    /* ─── Edit ─── */
    const handleEdit = (item: DiagnosisItem) => {
        setFormMode("edit");
        setEditingItem(item);
        setFormError(null);
        setShowForm(true);
    };

    /* ─── Save (create or edit) ─── */
    const handleSave = async (name: string) => {
        if (!name.trim()) {
            setFormError("Name is required");
            return;
        }
        setFormSaving(true);
        setFormError(null);
        try {
            if (formMode === "create") {
                const created = await createDiagnosis(name.trim());
                setItems((prev) => [...prev, created]);
                setShowForm(false);
                showToast("Diagnosis created successfully!", "success");
            } else if (editingItem) {
                const updated = await updateDiagnosis(editingItem.id, name.trim());
                setItems((prev) =>
                    prev.map((d) => (d.id === updated.id ? updated : d))
                );
                setShowForm(false);
                showToast("Diagnosis updated successfully!", "success");
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to save";
            setFormError(msg);
            showToast(msg, "error");
        } finally {
            setFormSaving(false);
        }
    };

    /* ─── Delete ─── */
    const handleDelete = (item: DiagnosisItem) => setDeletingItem(item);

    const handleConfirmDelete = async () => {
        if (!deletingItem) return;
        setDeleting(true);
        try {
            await deleteDiagnosis(deletingItem.id);
            setItems((prev) => prev.filter((d) => d.id !== deletingItem.id));
            setDeletingItem(null);
            showToast("Diagnosis deleted successfully!", "success");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to delete";
            showToast(msg, "error");
        } finally {
            setDeleting(false);
        }
    };

    /* ─── Pagination ─── */
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const totalPages = Math.ceil(items.length / pageSize);
    const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

    /* ─── Render ─── */
    return (
        <div className="w-full max-w-5xl space-y-5">
            {/* Header */}
            <div className="relative rounded-2xl p-5 border border-white/50 backdrop-blur-xl bg-white/30 shadow-lg overflow-hidden">
                <div
                    className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15 blur-3xl pointer-events-none"
                    style={{ background: teal }}
                />
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ background: "rgba(146,199,207,0.15)", color: teal }}
                    >
                        <Stethoscope className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className="text-lg font-bold text-ink">Diagnosis List</h2>
                        <p className="text-sm text-ink-muted">
                            Manage diagnosis names used across the system
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleCreate}
                    className="group inline-flex shrink-0 h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-xl hover:scale-[1.03] active:scale-[0.97]"
                    style={{
                        background: `linear-gradient(135deg, ${teal}, #AAD7D9)`,
                        boxShadow: "0 4px 16px rgba(146,199,207,0.30)",
                    }}
                >
                    <Plus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                    New Diagnosis
                </button>
                </div>
            </div>

            {/* Toast */}
            {toast.show && (
                <div
                    className={`relative rounded-xl px-4 py-3 shadow-lg backdrop-blur-xl transition-all duration-300 flex items-center gap-3 ${
                        toast.type === "error"
                            ? "bg-red-50/95 border border-red-200/60"
                            : "bg-green-50/95 border border-green-200/60"
                    }`}
                >
                    {toast.type === "error" ? (
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    ) : (
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    )}
                    <p
                        className={`text-sm font-medium ${
                            toast.type === "error" ? "text-red-700" : "text-green-700"
                        }`}
                    >
                        {toast.message}
                    </p>
                    <button
                        onClick={hideToast}
                        className="ml-auto p-1 rounded-lg hover:bg-black/5 transition-colors"
                    >
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                <div className="border-b border-white/40 px-5 py-3">
                    <h2 className="text-sm font-semibold text-gray-800">Diagnosis Entries</h2>
                    <p className="text-xs text-gray-500">List of all diagnosis names in the system</p>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div
                                className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
                                style={{ borderColor: teal, borderTopColor: "transparent" }}
                            />
                            <p className="text-gray-500">Loading diagnoses...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <p className="text-red-500 mb-4">{error}</p>
                            <button
                                onClick={fetchItems}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
                                style={{ background: "rgba(146,199,207,0.2)", color: "#1F2937" }}
                            >
                                <RefreshCw className="h-4 w-4" />
                                Retry
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr
                                    className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                                    style={{ borderBottom: "1px solid rgba(146,199,207,0.15)" }}
                                >
                                    <th className="px-5 py-3.5 w-16">#</th>
                                    <th className="px-5 py-3.5">Name</th>
                                    <th className="px-5 py-3.5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="px-5 py-10 text-center text-gray-400"
                                        >
                                            No diagnoses found. Click "New Diagnosis" to add one.
                                        </td>
                                    </tr>
                                ) : (
                                    pagedItems.map((item, idx) => (
                                        <tr
                                            key={item.id}
                                            className="transition-all duration-200 hover:bg-white/10"
                                            style={{
                                                borderBottom:
                                                    idx < pagedItems.length - 1
                                                        ? "1px solid rgba(146,199,207,0.08)"
                                                        : "none",
                                            }}
                                        >
                                            <td className="px-5 py-3 text-gray-500">
                                                {(page - 1) * pageSize + idx + 1}
                                            </td>
                                            <td className="px-5 py-3 font-medium text-gray-800">
                                                {item.name}
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleEdit(item)}
                                                        className="rounded-lg p-1.5 transition-colors hover:bg-amber-50"
                                                        title="Edit"
                                                        style={{ color: "#F59E0B" }}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item)}
                                                        className="rounded-lg p-1.5 transition-colors hover:bg-red-50"
                                                        title="Delete"
                                                        style={{ color: "#EF4444" }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {items.length > 0 && (
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={items.length}
                        onPageChange={setPage}
                    />
                )}
            </div>

            {/* Form Modal */}
            {showForm && (
                <FormModal
                    mode={formMode}
                    initialName={editingItem?.name ?? ""}
                    onClose={() => setShowForm(false)}
                    onSave={handleSave}
                    saving={formSaving}
                    error={formError}
                />
            )}

            {/* Delete Confirmation */}
            <CsrConfirmationModal
                open={deletingItem !== null}
                title="Delete diagnosis?"
                message={
                    deletingItem
                        ? `Are you sure you want to delete "${deletingItem.name}"? This action cannot be undone.`
                        : undefined
                }
                confirmLabel="Delete"
                loading={deleting}
                variant="delete"
                onCancel={() => setDeletingItem(null)}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}