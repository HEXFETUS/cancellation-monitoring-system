import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import type { BoothInfo, OperatorInfo, PosRecord } from "../../pos/types";
import { createBoothChangeRequest } from "../../pos/services/boothChangeRequests";
import ConfirmationModal from "../../pos/components/ConfirmationModal";

interface Props {
    open: boolean;
    posRecord: PosRecord | null;
    booths: BoothInfo[];
    /**
     * Full operator list. Used to compute the operator-family root so a
     * sub-operator can request changes to booths owned by sibling subs or
     * the parent main, but not to operators in another family.
     */
    operators?: OperatorInfo[];
    unavailableBoothIds?: number[];
    hasPendingRequest?: boolean;
    onClose: () => void;
    onSubmitted: () => Promise<void>;
}

export default function RequestBoothChangeModal({
    open,
    posRecord,
    booths,
    operators = [],
    unavailableBoothIds = [],
    hasPendingRequest = false,
    onClose,
    onSubmitted,
}: Props) {
    const { user } = useAuth();
    const [boothId, setBoothId] = useState<number | null>(null);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        if (open) {
            setBoothId(null);
            setReason("");
            setError("");
            setShowConfirm(false);
        }
    }, [open]);

    useEffect(() => {
        if (open && hasPendingRequest) {
            onClose();
        }
    }, [hasPendingRequest, onClose, open]);

    if (!open || !posRecord || hasPendingRequest) return null;

    // Derive the device's area from its booth code or from posRecord.area
    const deviceArea = posRecord.area
        ? posRecord.area.trim().toUpperCase()
        : posRecord.booth_code
            ? posRecord.booth_code.startsWith("CDO-") || posRecord.booth_code.startsWith("CD0-")
                ? "CDO"
                : posRecord.booth_code.startsWith("MOE-") || posRecord.booth_code.startsWith("MOW-")
                    ? "MISOR"
                    : null
            : null;

    // Build a map of operator_id -> root operator_id (parent or self).
    // Subs belong to the same family as their parent and siblings.
    const operatorRoot = (id: number | null | undefined): number | null => {
        if (id == null) return null;
        const op = operators.find((o) => Number(o.id) === Number(id));
        if (!op) return Number(id);
        return Number(op.parent_operator_id ?? op.id);
    };
    const deviceRoot = operatorRoot(posRecord.operator_id ?? null);
    const unavailableBoothIdSet = new Set(unavailableBoothIds.map(Number));

    // Filter to booths within the same operator FAMILY (main + subs) AND same area
    const availableBooths = booths.filter((b) => {
        if (b.id === posRecord.booth_id) return false;
        if (unavailableBoothIdSet.has(Number(b.id))) return false;
        // Same operator-family check (main + all its subs share a root)
        if (deviceRoot != null && b.operator_id != null) {
            const boothRoot = operatorRoot(b.operator_id);
            if (boothRoot != null && boothRoot !== deviceRoot) return false;
        }
        // Same area check — derive area from booth code if we know the device's area
        if (deviceArea) {
            const boothCode = (b.booth_code || "").trim().toUpperCase();
            const boothArea = boothCode.startsWith("MOE-") || boothCode.startsWith("MOW-")
                ? "MISOR"
                : boothCode.startsWith("CDO-") || boothCode.startsWith("CD0-")
                    ? "CDO"
                    : null;
            if (boothArea && boothArea !== deviceArea) return false;
        }
        return true;
    });

    const submit = async () => {
        if (!boothId) {
            setError("Pick a target booth");
            return;
        }
        setSaving(true);
        setError("");
        try {
            await createBoothChangeRequest({
                pos_record_id: posRecord.id,
                requested_booth_id: boothId,
                requested_by_user_id: user?.id ?? null,
                reason: reason.trim() || undefined,
            });
            await onSubmitted();
        } catch (e) {
            setError(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Failed to submit");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16 sm:pt-24">
            <div className="w-full max-w-md rounded-2xl border border-warm bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-warm px-6 py-4">
                    <h3 className="text-lg font-semibold text-ink">Request Booth Change</h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-ink-subtle transition hover:bg-cream hover:text-ink"
                        disabled={saving}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4 px-6 py-5">
                    {hasPendingRequest && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                            This device already has a pending booth change request. Please wait for it to be processed.
                        </div>
                    )}

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1 rounded-lg border border-warm bg-cream/50 px-3 py-2 text-sm">
                        <div className="text-ink">
                            <span className="font-medium">Device:</span> {posRecord.device_no}
                        </div>
                        <div className="text-ink">
                            <span className="font-medium">Serial Number:</span>{" "}
                            {posRecord.serial_number || posRecord.serial_no || "—"}
                        </div>
                        <div className="text-ink">
                            <span className="font-medium">Booth code:</span> {posRecord.booth_code || "—"}
                        </div>
                    </div>

                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Move to Booth *
                        </span>
                        <select
                            value={boothId ?? ""}
                            onChange={(e) =>
                                setBoothId(e.target.value === "" ? null : Number(e.target.value))
                            }
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                        >
                            <option value="" disabled hidden>
                                Pick a booth
                            </option>
                            {availableBooths.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.booth_code} {b.location ? `· ${b.location}` : ""}
                                </option>
                            ))}
                        </select>
                        {availableBooths.length === 0 && (
                            <p className="mt-1 text-xs text-ink-subtle">
                                No alternate booths are available within your operator family.
                            </p>
                        )}
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Reason
                        </span>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            placeholder="Optional. Explain why you need this change."
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                        />
                    </label>
                </div>

                <div className="flex justify-end gap-3 border-t border-warm bg-cream px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowConfirm(true)}
                        disabled={saving || !boothId || hasPendingRequest}
                        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                    >
                        {saving ? "Submitting..." : "Submit Request"}
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                open={showConfirm}
                title="Confirm Booth Change Request"
                message="Are you sure you want to submit this booth change request?"
                confirmLabel="Submit Request"
                isLoading={saving}
                loadingLabel="Submitting..."
                onCancel={() => setShowConfirm(false)}
                onConfirm={submit}
            >
                <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Device</span>
                    <span className="text-sm font-semibold text-ink">{posRecord.device_no}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">From</span>
                    <span className="text-sm font-semibold text-ink">{posRecord.booth_code || "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">To</span>
                    <span className="text-sm font-semibold text-teal">
                        {booths.find((b) => b.id === boothId)?.booth_code || "—"}
                    </span>
                </div>
                {reason.trim() && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Reason</span>
                        <span className="text-sm font-medium text-ink text-right max-w-[200px] truncate">{reason.trim()}</span>
                    </div>
                )}
            </ConfirmationModal>
        </div>
    );
}
