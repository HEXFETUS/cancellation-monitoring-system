import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { OperatorInfo, PosRecord } from "../../pos/types";
import {
    createOperatorChangeRequest,
    listOperatorChangeRequests,
    type OperatorChangeRequest,
} from "../../requests/services/operatorChangeRequests";
import ConfirmationModal from "../../pos/components/ConfirmationModal";
import Dropdown from "./Dropdown";

interface Props {
    open: boolean;
    posRecord: PosRecord | null;
    operators: OperatorInfo[];
    currentOperatorId?: number | null;
    onClose: () => void;
    onSubmitted: () => Promise<void>;
    onError?: (message: string) => void;
}

export default function AssignSubOperatorModal({
    open,
    posRecord,
    operators = [],
    currentOperatorId = null,
    onClose,
    onSubmitted,
    onError,
}: Props) {
    const [subOperatorId, setSubOperatorId] = useState<number | null>(null);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [existingPending, setExistingPending] = useState<OperatorChangeRequest | null>(null);

    useEffect(() => {
        if (open) {
            setSubOperatorId(null);
            setReason("");
            setError("");
            setShowConfirm(false);
            setExistingPending(null);
        }
    }, [open]);

    // Check for existing pending operator change requests for this POS record
    useEffect(() => {
        if (open && posRecord) {
            listOperatorChangeRequests({
                posRecordId: posRecord.id,
                status: "pending",
            })
                .then((requests) => {
                    if (requests.length > 0) {
                        setExistingPending(requests[0]);
                    }
                })
                .catch(() => {
                    // Silently fail, don't block the modal
                });
        }
    }, [open, posRecord]);

    if (!open || !posRecord) return null;

    const operatorName = (posRecord.operator ?? "").trim().toLowerCase();
    const posOperatorId = posRecord.operator_id != null ? Number(posRecord.operator_id) : null;
    const posOperator =
        (posOperatorId != null
            ? operators.find((o) => Number(o.id) === posOperatorId)
            : null) ??
        operators.find((o) => o.operator.trim().toLowerCase() === operatorName) ??
        null;

    const signedInOperator =
        currentOperatorId != null
            ? operators.find((o) => Number(o.id) === Number(currentOperatorId)) ?? null
            : null;

    const mainOperatorId =
        signedInOperator && signedInOperator.parent_operator_id == null
            ? Number(signedInOperator.id)
            : posOperator && posOperator.parent_operator_id == null
                ? Number(posOperator.id)
                : null;

    // Find sub-operators based on the parent_operator_id relationship:
    // operator_list.parent_operator_id references operator_list.id
    // A sub-operator is any operator whose parent_operator_id equals the current operator's id.
    const availableSubOperators = operators.filter((op) => {
        if (posOperatorId != null && Number(op.id) === posOperatorId) return false;

        // Only show operators that have the current operator as their parent
        return mainOperatorId != null && Number(op.parent_operator_id) === mainOperatorId;
    });

    const submit = async () => {
        if (!subOperatorId) {
            setError("Pick a sub-operator");
            return;
        }
        if (!reason.trim()) {
            setError("Reason is required");
            return;
        }
        setSaving(true);
        setError("");
        try {
            // Get the user_id associated with the sub-operator
            const targetOperator = operators.find((o) => o.id === subOperatorId);
            if (!targetOperator?.user_id) {
                setError("Selected sub-operator has no linked user account");
                return;
            }

            await createOperatorChangeRequest({
                user_id: targetOperator.user_id,
                pos_record_id: posRecord.id,
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm px-4 pt-16 sm:pt-24">
            <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                {/* Accent bar */}
                <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-ink">Assign to Sub-Operator</h2>
                            <p className="text-sm text-ink-muted mt-0.5">Transfer a POS device to a sub-operator</p>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {existingPending && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                                This device already has a pending operator change request. Please wait for it to be processed.
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
                                <span className="font-medium">Current Operator:</span> {posRecord.operator || "—"}
                            </div>
                        </div>

                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                Assign to Sub-Operator <span className="text-red-500">*</span>
                            </span>
                            {availableSubOperators.length === 0 ? (
                                <div className="rounded-lg border border-warm bg-cream/50 px-3 py-2.5 text-sm text-ink-muted">
                                    {mainOperatorId
                                        ? `Operator "${posRecord.operator}" has no available sub-operators assigned.`
                                        : "No operator found for this device."}
                                </div>
                            ) : (
                                <Dropdown
                                    value={subOperatorId}
                                    placeholder="Select a sub-operator"
                                    emptyMessage="No sub-operators available for this operator."
                                    onChange={(v) => setSubOperatorId(v)}
                                    options={availableSubOperators.map((op) => ({
                                        value: op.id,
                                        label: op.operator,
                                    }))}
                                />
                            )}
                        </label>

                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                Reason <span className="text-red-500">*</span>
                            </span>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                placeholder="Explain why you need to assign this device to a sub-operator."
                                className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            />
                        </label>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowConfirm(true)}
                            disabled={saving || !subOperatorId || !reason.trim() || !!existingPending}
                            className="flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                            style={{
                                background: "linear-gradient(to right, #92C7CF, #AAD7D9)",
                                boxShadow: "0 4px 16px rgba(146,199,207,0.25)",
                            }}
                        >
                            {saving ? "Submitting..." : "Submit Request"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                open={showConfirm}
                title="Confirm Operator Assignment"
                message="Are you sure you want to submit this operator assignment request?"
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
                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">From Operator</span>
                    <span className="text-sm font-semibold text-ink">{posRecord.operator || "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">To Operator</span>
                    <span className="text-sm font-semibold text-teal">
                        {operators.find((o) => o.id === subOperatorId)?.operator || "—"}
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
