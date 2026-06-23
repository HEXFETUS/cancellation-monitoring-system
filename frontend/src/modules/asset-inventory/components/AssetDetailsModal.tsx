import { useState } from "react";
import { X, Pencil, Trash2 } from "lucide-react";
import type { AssetRow } from "./AssetTable";
import ConfirmationModal from "../../../shared/components/ConfirmationModal";

interface AssetDetailsModalProps {
    open: boolean;
    asset: AssetRow | null;
    onClose: () => void;
    onEdit?: (row: AssetRow) => void;
    onDelete?: (row: AssetRow) => void;
}

const PHP = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
});

function formatDate(iso: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "2-digit",
    });
}

export default function AssetDetailsModal({
    open,
    asset,
    onClose,
    onEdit,
    onDelete,
}: AssetDetailsModalProps) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    if (!open || !asset) return null;

    const handleEditClick = () => {
        if (onEdit) {
            onEdit(asset);
            onClose();
        }
    };

    const handleDeleteClick = () => {
        setConfirmDelete(true);
    };

    const handleDeleteConfirm = () => {
        if (onDelete) {
            onDelete(asset);
            onClose();
        }
        setConfirmDelete(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-8 pb-8 overflow-y-auto">
            <div className="w-full max-w-xl rounded-2xl border border-warm bg-card shadow-2xl">
                {/* ── Header ── */}
                <div className="flex items-start justify-between gap-4 border-b border-warm px-6 py-5">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-ink truncate">
                            {asset.itemDescription}
                        </h2>
                        <p className="mt-0.5 text-sm text-ink-muted">Asset Details</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-1.5 text-ink-subtle transition hover:bg-cream hover:text-ink"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto">
                    {/* Section 1: Purchase Information */}
                    <section>
                        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">
                            Purchase Information
                        </h4>
                        <div className="rounded-xl border border-warm bg-cream/50 divide-y divide-warm/60">
                            <Row label="Type" value={asset.type || "—"} />
                            <Row label="Serial No." value={asset.serialNumber || "—"} />
                            <Row label="Color" value={asset.color || "—"} />
                            <Row
                                label="Date Purchased"
                                value={formatDate(asset.datePurchase)}
                            />
                            <Row label="Vendor" value={asset.vendor || "—"} />
                            <Row
                                label="Purchase Price"
                                value={PHP.format(asset.purchasePrice)}
                                highlighted
                            />
                            <Row
                                label="Warranty Date"
                                value={formatDate(asset.warrantyDate)}
                            />
                        </div>
                    </section>

                    {/* Remarks */}
                    <section>
                        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">
                            Remarks
                        </h4>
                        <div className="rounded-xl border border-warm bg-cream/50 px-4 py-3">
                            <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                                {asset.remarks || "No remarks."}
                            </p>
                        </div>
                    </section>
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-end gap-3 border-t border-warm bg-cream px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40"
                    >
                        Close
                    </button>
                    {onEdit && (
                        <button
                            type="button"
                            onClick={handleEditClick}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark"
                        >
                            <Pencil size={16} />
                            Edit
                        </button>
                    )}
                    {onDelete && (
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-ink transition hover:bg-rose-dark"
                        >
                            <Trash2 size={16} />
                            Delete
                        </button>
                    )}
                </div>
            </div>

            <ConfirmationModal
                open={confirmDelete}
                variant="delete"
                title="Delete Asset"
                message={`Are you sure you want to delete "${asset.itemDescription}"? This cannot be undone.`}
                confirmLabel="Yes, Delete"
                cancelLabel="Cancel"
                onCancel={() => setConfirmDelete(false)}
                onConfirm={handleDeleteConfirm}
            />
        </div>
    );
}

/* ─── Helpers ─── */

function Row({
    label,
    value,
    highlighted = false,
}: {
    label: string;
    value: string;
    highlighted?: boolean;
}) {
    return (
        <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
            </span>
            <span
                className={`text-sm font-medium text-right ${
                    highlighted
                        ? "font-bold text-teal-dark"
                        : "text-ink"
                }`}
            >
                {value}
            </span>
        </div>
    );
}