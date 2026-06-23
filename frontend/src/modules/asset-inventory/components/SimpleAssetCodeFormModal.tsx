/**
 * SimpleAssetCodeFormModal – used in the OBS page (ObsPage.tsx)
 * for creating/editing OBS asset codes.
 */
import { useEffect, useState } from "react";
import { X, Plus, Pencil } from "lucide-react";
import {
    type AssetCode,
    type AssetCodeInput,
} from "../services/assetCodes";
import ConfirmationModal from "../../../shared/components/ConfirmationModal";

interface Props {
    open: boolean;
    initial?: AssetCode | null;
    onClose: () => void;
    onSubmit: (values: AssetCodeInput) => Promise<void>;
}

const EMPTY: AssetCodeInput = {
    itemCode: "",
    description: "",
    type: "",
    department: "OBS",
    careOf: "",
    space: "",
    assetId: null,
};

export default function SimpleAssetCodeFormModal({ open, initial, onClose, onSubmit }: Props) {
    const [v, setV] = useState<AssetCodeInput>(EMPTY);
    const [err, setErr] = useState("");
    const [saving, setSaving] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        if (!open) return;
        setErr("");
        setShowConfirm(false);
        if (initial) {
            setV({
                itemCode: initial.itemCode,
                description: initial.description,
                type: initial.type,
                department: initial.department,
                careOf: initial.careOf,
                space: initial.space,
                assetId: initial.assetId,
            });
        } else {
            setV(EMPTY);
        }
    }, [open, initial]);

    const set = <K extends keyof AssetCodeInput>(k: K, val: AssetCodeInput[K]) =>
        setV((prev) => ({ ...prev, [k]: val }));

    // Check if required fields are filled
    const isMissingRequired = !v.itemCode.trim() || !v.description.trim();

    // Step 1: Validate and show confirmation
    const handleSubmitClick = (e: React.FormEvent) => {
        e.preventDefault();
        if (!v.itemCode.trim() || !v.description.trim()) {
            setErr("Item code and description are required");
            return;
        }
        setErr("");
        setShowConfirm(true);
    };

    // Step 2: Actually save after confirmation
    const handleConfirmSave = async () => {
        setSaving(true);
        setErr("");
        try {
            await onSubmit(v);
            setShowConfirm(false);
            onClose();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Save failed");
            setShowConfirm(false);
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-sm pt-8 pb-8">
                <div className="w-full max-w-2xl rounded-2xl border border-warm bg-white shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-warm bg-gradient-to-r from-teal-50 to-white px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-teal-200">
                                {initial ? (
                                    <Pencil size={18} className="text-teal" />
                                ) : (
                                    <Plus size={18} className="text-teal" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-ink">
                                    {initial ? "Edit" : "Add"} OBS Asset Code
                                </h3>
                                {!initial && (
                                    <p className="text-xs text-ink-muted">Create a new asset code for OBS</p>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-ink-subtle transition hover:bg-cream hover:text-ink"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmitClick} className="max-h-[70vh] space-y-5 overflow-y-auto bg-slate-50/50 px-6 py-5">
                        {err && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">!</span>
                                {err}
                            </div>
                        )}

                        <section className="rounded-xl border border-warm bg-white p-4 shadow-sm">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Item Code" required>
                                    <Input
                                        value={v.itemCode}
                                        onChange={(s) => set("itemCode", s)}
                                        placeholder="e.g. OBS-001"
                                        required
                                    />
                                </Field>
                                <Field label="Description" required>
                                    <Input
                                        value={v.description}
                                        onChange={(s) => set("description", s)}
                                        required
                                    />
                                </Field>
                                <Field label="Type">
                                    <Input value={v.type} onChange={(s) => set("type", s)} />
                                </Field>
                                <Field label="Department">
                                    <Input
                                        value={v.department}
                                        onChange={(s) => set("department", s)}
                                    />
                                </Field>
                                <Field label="Care Of">
                                    <Input value={v.careOf} onChange={(s) => set("careOf", s)} />
                                </Field>
                                <Field label="Space">
                                    <Input value={v.space} onChange={(s) => set("space", s)} />
                                </Field>
                            </div>
                        </section>
                    </form>

                    {/* Footer */}
                    <div className="flex justify-end gap-2.5 border-t border-warm bg-slate-50 px-6 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmitClick}
                            disabled={saving || isMissingRequired}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-5 py-2 text-sm font-bold text-ink shadow-sm transition hover:bg-teal-dark disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isMissingRequired ? "Please fill in all required fields" : ""}
                        >
                            {saving ? (
                                <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                                    Saving…
                                </>
                            ) : initial ? "Update" : "Add"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                open={showConfirm}
                variant="save"
                title={initial ? "Update Asset Code?" : "Add Asset Code?"}
                message={`Please review the details below before ${initial ? "updating" : "adding"} this asset code.`}
                confirmLabel={initial ? "Yes, Update" : "Yes, Add"}
                cancelLabel="Go Back"
                isLoading={saving}
                loadingLabel={initial ? "Updating..." : "Adding..."}
                onCancel={() => setShowConfirm(false)}
                onConfirm={handleConfirmSave}
            >
                <div className="divide-y divide-warm/60 text-sm">
                    <SummaryRow label="Item Code" value={v.itemCode || "—"} />
                    <SummaryRow label="Description" value={v.description || "—"} />
                    <SummaryRow label="Type" value={v.type || "—"} />
                    <SummaryRow label="Department" value={v.department || "—"} />
                    <SummaryRow label="Care Of" value={v.careOf || "—"} />
                    <SummaryRow label="Space" value={v.space || "—"} />
                </div>
            </ConfirmationModal>
        </>
    );
}

/* ---------------- helpers ---------------- */

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between px-3 py-2">
            <span className="text-ink-muted font-medium">{label}</span>
            <span className="text-ink text-right max-w-[55%] truncate font-medium">{value}</span>
        </div>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
                {required && <span className="ml-0.5 text-rose-500">*</span>}
            </span>
            {children}
        </label>
    );
}

function Input({
    value,
    onChange,
    placeholder,
    required,
}: {
    value: string;
    onChange: (s: string) => void;
    placeholder?: string;
    required?: boolean;
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal transition-all"
        />
    );
}