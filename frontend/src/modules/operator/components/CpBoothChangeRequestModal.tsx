import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import type { BoothInfo, OperatorInfo } from "../../pos/types";
import { createCpBoothChangeRequest } from "../../requests/services/cpBoothChangeRequests";
import ConfirmationModal from "../../pos/components/ConfirmationModal";

interface CellphoneRecord {
    id: number;
    brand: string;
    model: string;
    specs: string;
    serial_number: string;
    control_no: string;
    operator_id: number | null;
    booth_id: number | null;
    area: string | null;
}

interface Props {
    open: boolean;
    cellphone: CellphoneRecord | null;
    booths: BoothInfo[];
    operators?: OperatorInfo[];
    unavailableBoothIds?: number[];
    hasPendingRequest?: boolean;
    onClose: () => void;
    onSubmitted: () => Promise<void>;
    onError?: (message: string) => void;
}

export default function CpBoothChangeRequestModal({
    open,
    cellphone,
    booths,
    operators = [],
    unavailableBoothIds = [],
    hasPendingRequest = false,
    onClose,
    onSubmitted,
    onError,
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

    if (!open || !cellphone || hasPendingRequest) return null;

    // Derive the device's area from the cellphone record's area field, or fall back to booth code
    const currentBooth = cellphone.booth_id != null
        ? booths.find((b) => Number(b.id) === Number(cellphone.booth_id))
        : null;
    const deviceArea =
        (cellphone.area || "").toUpperCase() ||
        (currentBooth?.booth_code
            ? currentBooth.booth_code.startsWith("CDO-") || currentBooth.booth_code.startsWith("CD0-")
                ? "CDO"
                : currentBooth.booth_code.startsWith("MOE-") || currentBooth.booth_code.startsWith("MOW-")
                    ? "MISOR"
                    : null
            : null);

    // Derive operator family root to filter booths to same operator family
    const operatorRoot = (id: number | null | undefined): number | null => {
        if (id == null) return null;
        const op = operators.find((o) => Number(o.id) === Number(id));
        if (!op) return Number(id);
        return Number(op.parent_operator_id ?? op.id);
    };

    const cpRoot = operatorRoot(cellphone.operator_id);
    const unavailableBoothIdSet = new Set(unavailableBoothIds.map(Number));

    // Filter booths to only those within the same operator family, same area, and not unavailable
    const availableBooths = booths.filter((b) => {
        if (unavailableBoothIdSet.has(Number(b.id))) return false;
        if (b.id === cellphone.booth_id) return false;
        if (b.operator_id != null && cpRoot != null) {
            const boothRoot = operatorRoot(b.operator_id);
            if (boothRoot != null && boothRoot !== cpRoot) return false;
        }
        // Same area check — derive area from booth code
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
        if (!reason.trim()) {
            setError("Reason is required");
            return;
        }
        setSaving(true);
        setError("");
        try {
            await createCpBoothChangeRequest({
                cellphone_id: cellphone.id,
                requested_booth_id: boothId,
                requested_by_user_id: user?.id ?? null,
                reason: reason.trim(),
            });
            await onSubmitted();
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to submit";
            setError(message);
            onError?.(message);
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
                            <h2 className="text-lg font-bold text-ink">Request Booth Change</h2>
                            <p className="text-sm text-ink-muted mt-0.5">
                                Request to assign this cellphone to a booth
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

                    <div className="space-y-4">
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

                        {/* Cellphone info */}
                        <div className="space-y-1 rounded-lg border border-warm bg-cream/50 px-3 py-2 text-sm">
                            <div className="text-ink">
                                <span className="font-medium">Device:</span> {cellphone.brand} {cellphone.model}
                            </div>
                            <div className="text-ink">
                                <span className="font-medium">Serial No.:</span> {cellphone.serial_number}
                            </div>
                            <div className="text-ink">
                                <span className="font-medium">Control No.:</span> {cellphone.control_no}
                            </div>
                        </div>

                        {/* Booth dropdown */}
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                Assign to Booth <span className="text-red-500">*</span>
                            </span>
                            <select
                                value={boothId ?? ""}
                                onChange={(e) => setBoothId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full rounded-lg border border-warm bg-card px-3 py-2.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            >
                                <option value="">-- Select a booth --</option>
                                {availableBooths.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.booth_code}{b.location ? ` · ${b.location}` : ""}
                                    </option>
                                ))}
                            </select>
                            {availableBooths.length === 0 && (
                                <p className="mt-1 text-xs text-ink-muted">
                                    No booths are available within your operator family.
                                </p>
                            )}
                        </label>

                        {/* Reason */}
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                Reason <span className="text-red-500">*</span>
                            </span>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                placeholder="Explain why you need this change."
                                className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            />
                        </label>

                        {/* Buttons */}
                        <div className="flex justify-end gap-3 pt-4">
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
                            disabled={saving || !boothId || !reason.trim() || hasPendingRequest}
                            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                        >
                            {saving ? "Submitting..." : "Submit Request"}
                        </button>
                        </div>
                    </div>
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
                    <span className="text-sm font-semibold text-ink">{cellphone.control_no || cellphone.serial_number}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">To Booth</span>
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