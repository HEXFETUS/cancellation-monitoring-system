import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import type { BoothInfo, PosRecord } from "../../pos/types";
import { createBoothChangeRequest } from "../../pos/services/boothChangeRequests";

interface Props {
    open: boolean;
    posRecord: PosRecord | null;
    booths: BoothInfo[];
    onClose: () => void;
    onSubmitted: () => Promise<void>;
}

export default function RequestBoothChangeModal({
    open,
    posRecord,
    booths,
    onClose,
    onSubmitted,
}: Props) {
    const { user } = useAuth();
    const [boothId, setBoothId] = useState<number | null>(null);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setBoothId(null);
            setReason("");
            setError("");
        }
    }, [open]);

    if (!open || !posRecord) return null;

    // Filter to booths within the same operator (when device has one)
    const availableBooths = booths.filter((b) => {
        if (b.id === posRecord.booth_id) return false;
        if (posRecord.operator_id && b.operator_id && b.operator_id !== posRecord.operator_id) return false;
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
        } catch (e: any) {
            setError(e.message || "Failed to submit");
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
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <div className="rounded-lg border border-warm bg-cream/50 px-3 py-2 text-sm">
                        <div className="font-semibold text-ink">{posRecord.device_no}</div>
                        <div className="text-xs text-ink-muted">
                            Currently at <span className="font-medium text-ink">{posRecord.booth_code || "—"}</span>
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
                            <option value="">Pick a booth</option>
                            {availableBooths.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.booth_code} {b.location ? `· ${b.location}` : ""}
                                </option>
                            ))}
                        </select>
                        {availableBooths.length === 0 && (
                            <p className="mt-1 text-xs text-ink-subtle">
                                No alternate booths are available for your operator.
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
                        onClick={submit}
                        disabled={saving || !boothId}
                        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                    >
                        {saving ? "Submitting..." : "Submit Request"}
                    </button>
                </div>
            </div>
        </div>
    );
}
