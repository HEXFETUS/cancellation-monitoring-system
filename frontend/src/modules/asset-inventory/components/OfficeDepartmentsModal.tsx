import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
    type OfficeDepartment,
    type OfficeDepartmentInput,
    createOfficeDepartment,
    deleteOfficeDepartment,
    updateOfficeDepartment,
} from "../services/officeDepartments";
import { useCanDelete } from "../hooks/useCanDelete";

interface Props {
    open: boolean;
    departments: OfficeDepartment[];
    onClose: () => void;
    onChanged: () => Promise<void>;
}

const EMPTY: OfficeDepartmentInput = {
    deptCode: "",
    name: "",
    description: "",
    active: true,
};

export default function OfficeDepartmentsModal({
    open,
    departments,
    onClose,
    onChanged,
}: Props) {
    const [draft, setDraft] = useState<OfficeDepartmentInput>(EMPTY);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const canDelete = useCanDelete();

    if (!open) return null;

    const startEdit = (d: OfficeDepartment) => {
        setEditingId(d.id);
        setDraft({
            deptCode: d.deptCode,
            name: d.name,
            description: d.description,
            active: d.active,
        });
        setError("");
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraft(EMPTY);
        setError("");
    };

    const handleSave = async () => {
        if (!draft.deptCode.trim() || !draft.name.trim()) {
            setError("Department code and name are required");
            return;
        }
        setSaving(true);
        setError("");
        try {
            if (editingId) {
                await updateOfficeDepartment(editingId, draft);
            } else {
                await createOfficeDepartment(draft);
            }
            await onChanged();
            cancelEdit();
        } catch (e) {
            setError(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (d: OfficeDepartment) => {
        if (!confirm(`Delete department "${d.deptCode}"? Linked assets keep their data.`)) return;
        try {
            await deleteOfficeDepartment(d.id);
            await onChanged();
        } catch (e) {
            alert(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Delete failed");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 pb-8">
            <div className="w-full max-w-2xl rounded-2xl border border-warm bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-warm px-6 py-4">
                    <h3 className="text-lg font-semibold text-ink">Office Departments</h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-ink-subtle transition hover:bg-cream hover:text-ink"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <section>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            {editingId ? "Edit department" : "Add department"}
                        </h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Department Code *">
                                <input
                                    type="text"
                                    value={draft.deptCode}
                                    onChange={(e) => setDraft({ ...draft, deptCode: e.target.value })}
                                    placeholder="e.g. IT, Accounting, OPS/Admin"
                                    maxLength={40}
                                    className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                                />
                            </Field>
                            <Field label="Name *">
                                <input
                                    type="text"
                                    value={draft.name}
                                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                    placeholder="e.g. Information Technology"
                                    className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                                />
                            </Field>
                        </div>
                        <Field label="Description">
                            <input
                                type="text"
                                value={draft.description}
                                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                                className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            />
                        </Field>
                        <label className="mt-2 inline-flex items-center gap-2 text-sm text-ink">
                            <input
                                type="checkbox"
                                checked={draft.active}
                                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                            />
                            Active
                        </label>

                        <div className="mt-3 flex justify-end gap-2">
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                            >
                                <Plus size={14} />
                                {editingId ? "Save changes" : "Add department"}
                            </button>
                        </div>
                    </section>

                    <section>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Existing departments ({departments.length})
                        </h4>
                        {departments.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-warm bg-cream/50 px-3 py-4 text-center text-sm text-ink-subtle">
                                No departments yet. Add your first one above.
                            </p>
                        ) : (
                            <ul className="divide-y divide-warm/60 rounded-lg border border-warm">
                                {departments.map((d) => (
                                    <li
                                        key={d.id}
                                        className="flex items-center justify-between gap-3 px-3 py-2"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-full border border-teal/30 bg-teal-light/40 px-2 py-0.5 font-mono text-xs font-semibold text-ink">
                                                    {d.deptCode}
                                                </span>
                                                <span className="truncate text-sm font-medium text-ink">
                                                    {d.name}
                                                </span>
                                                {!d.active && (
                                                    <span className="text-xs uppercase text-ink-subtle">
                                                        inactive
                                                    </span>
                                                )}
                                            </div>
                                            {d.description && (
                                                <p className="mt-0.5 truncate text-xs text-ink-muted">
                                                    {d.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 gap-1.5">
                                            <button
                                                onClick={() => startEdit(d)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-teal-dark"
                                            >
                                                <Pencil size={14} />
                                                Edit
                                            </button>
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(d)}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-rose px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-rose-dark"
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <div className="flex justify-end border-t border-warm bg-cream px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
            </span>
            {children}
        </label>
    );
}
