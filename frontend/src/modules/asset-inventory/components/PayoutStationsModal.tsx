import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import ConfirmationModal from "../../../shared/components/ConfirmationModal";
import {
    type PayoutStation,
    type PayoutStationInput,
    createPayoutStation,
    deletePayoutStation,
    updatePayoutStation,
} from "../services/payoutStations";
import { useCanDelete } from "../hooks/useCanDelete";

interface Props {
    open: boolean;
    stations: PayoutStation[];
    onClose: () => void;
    onChanged: () => Promise<void>;
}

const EMPTY: PayoutStationInput = {
    stationCode: "",
    name: "",
    description: "",
    active: true,
};

export default function PayoutStationsModal({
    open,
    stations,
    onClose,
    onChanged,
}: Props) {
    const [draft, setDraft] = useState<PayoutStationInput>(EMPTY);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<PayoutStation | null>(null);
    const [stationPage, setStationPage] = useState(0);
    const canDelete = useCanDelete();
    const PAGE_SIZE = 5;
    const totalPages = Math.max(1, Math.ceil(stations.length / PAGE_SIZE));
    const pagedStations = stations.slice(stationPage * PAGE_SIZE, (stationPage + 1) * PAGE_SIZE);

    if (!open) return null;

    const startEdit = (s: PayoutStation) => {
        setEditingId(s.id);
        setDraft({
            stationCode: s.stationCode,
            name: s.name,
            description: s.description,
            active: s.active,
        });
        setError("");
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraft(EMPTY);
        setError("");
    };

    const handleSaveClick = () => {
        if (!draft.stationCode.trim() || !draft.name.trim()) {
            setError("Station code and name are required");
            return;
        }
        setError("");
        setShowConfirm(true);
    };

    const handleConfirmSave = async () => {
        setSaving(true);
        try {
            if (editingId) {
                await updatePayoutStation(editingId, draft);
            } else {
                await createPayoutStation({ ...draft, active: true });
            }
            await onChanged();
            cancelEdit();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
            setShowConfirm(false);
        }
    };

    const handleDeleteClick = (s: PayoutStation) => {
        setDeleteTarget(s);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deletePayoutStation(deleteTarget.id);
            await onChanged();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Delete failed");
        } finally {
            setDeleteTarget(null);
        }
    };

    const confirmStationCode = draft.stationCode.trim();
    const confirmName = draft.name.trim();
    const confirmDescription = draft.description.trim() || "—";
    const confirmLabel = editingId ? "Update Station" : "Add Station";

    return (
        <>
            {showConfirm && (
                <ConfirmationModal
                    open={showConfirm}
                    title={confirmLabel}
                    message={`Save the following station?`}
                    confirmLabel={confirmLabel}
                    isLoading={saving}
                    loadingLabel="Saving..."
                    variant="save"
                    onCancel={() => setShowConfirm(false)}
                    onConfirm={handleConfirmSave}
                >
                    <div className="w-full space-y-2 px-2 py-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-ink-muted">Station Code</span>
                            <span className="font-mono font-semibold text-ink">{confirmStationCode}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-ink-muted">Name</span>
                            <span className="font-semibold text-ink">{confirmName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-ink-muted">Description</span>
                            <span className="text-ink">{confirmDescription}</span>
                        </div>
                    </div>
                </ConfirmationModal>
            )}

            {deleteTarget && (
                <ConfirmationModal
                    open={Boolean(deleteTarget)}
                    title="Delete Station"
                    message={`Delete station "${deleteTarget.stationCode}"? Linked assets keep their data.`}
                    confirmLabel="Delete"
                    variant="delete"
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}

            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 pb-8">
                <div className="w-full max-w-2xl rounded-2xl border border-warm bg-card shadow-xl">
                    <div className="flex items-center justify-between border-b border-warm px-6 py-4">
                        <h3 className="text-lg font-semibold text-ink">Payout Stations</h3>
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

                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            {editingId ? "Edit station" : "Add station"}
                        </h4>
                        <section className="rounded-xl border border-warm/60 bg-gradient-to-br from-cream/80 to-transparent p-4">
                            <div className="grid gap-3">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="Station Code" required>
                                        <input
                                            type="text"
                                            value={draft.stationCode}
                                            onChange={(e) =>
                                                setDraft({ ...draft, stationCode: e.target.value.toUpperCase() })
                                            }
                                            placeholder="e.g. CDO, MOE, MOW"
                                            maxLength={10}
                                            className="w-full rounded-lg border border-warm bg-white px-3 py-2 text-sm text-ink uppercase tracking-wide focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal transition-shadow"
                                        />
                                    </Field>
                                    <Field label="Name" required>
                                        <input
                                            type="text"
                                            value={draft.name}
                                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                            placeholder="e.g. Cagayan de Oro"
                                            className="w-full rounded-lg border border-warm bg-white px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal transition-shadow"
                                        />
                                    </Field>
                                </div>
                                <Field label="Description">
                                    <input
                                        type="text"
                                        value={draft.description}
                                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                                        placeholder="Short description (optional)"
                                        className="w-full rounded-lg border border-warm bg-white px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal transition-shadow"
                                    />
                                </Field>
                            </div>
                            <div className="mt-4 flex items-center justify-end gap-2">
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="rounded-lg border border-warm bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleSaveClick}
                                    disabled={saving || !draft.name.trim()}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Plus size={14} />
                                    {editingId ? "Save changes" : "Add station"}
                                </button>
                            </div>
                        </section>

                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Existing stations ({stations.length})
                        </h4>
                        {stations.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-warm bg-cream/50 px-3 py-8 text-center">
                                <p className="text-sm text-ink-subtle">No stations yet.</p>
                                <p className="mt-1 text-xs text-ink-muted">Add your first one above.</p>
                            </div>
                        ) : (
                            <>
                                <ul className="divide-y divide-warm/60 rounded-xl border border-warm bg-white/70">
                                    {pagedStations.map((s) => (
                                        <li
                                            key={s.id}
                                            className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-cream/40"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded-lg border border-teal/30 bg-teal-light/30 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-ink">
                                                        {s.stationCode}
                                                    </span>
                                                    <span className="truncate text-sm font-semibold text-ink">
                                                        {s.name}
                                                    </span>
                                                    {!s.active && (
                                                        <span className="rounded-full bg-warm/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                                                            inactive
                                                        </span>
                                                    )}
                                                </div>
                                                {s.description && (
                                                    <p className="mt-1 truncate text-xs text-ink-muted">
                                                        {s.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 gap-2">
                                                <button
                                                    onClick={() => startEdit(s)}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-teal/80 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-teal active:scale-95"
                                                >
                                                    <Pencil size={13} />
                                                    Edit
                                                </button>
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDeleteClick(s)}
                                                        className="inline-flex items-center gap-1 rounded-lg bg-rose/80 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-rose active:scale-95"
                                                    >
                                                        <Trash2 size={13} />
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                {stations.length > PAGE_SIZE && (
                                    <div className="mt-3 flex items-center justify-between rounded-lg border border-warm/50 bg-white/60 px-3 py-2">
                                        <span className="text-xs text-ink-muted">
                                            Page {stationPage + 1} of {totalPages}
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setStationPage((p) => Math.max(0, p - 1))}
                                                disabled={stationPage === 0}
                                                className="rounded-lg border border-warm bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-warm/40 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Prev
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setStationPage((p) => Math.min(totalPages - 1, p + 1))}
                                                disabled={stationPage >= totalPages - 1}
                                                className="rounded-lg border border-warm bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-warm/40 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="flex justify-between border-t border-warm bg-cream/60 px-6 py-4">
                        <span className="text-xs text-ink-muted">{stations.filter((d) => d.active).length} active of {stations.length} total</span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-warm bg-white px-5 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-warm/40"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label} {required && <span className="text-red-500">*</span>}
            </span>
            {children}
        </label>
    );
}