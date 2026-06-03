import { useState } from "react";
import {
    cancelBoothChangeRequest,
    type BoothChangeRequest,
} from "../../pos/services/boothChangeRequests";
import ConfirmationModal from "../../pos/components/ConfirmationModal";

interface Props {
    requests: BoothChangeRequest[];
    onChanged: () => Promise<void>;
    userId: number | null;
}

export default function BoothChangeRequestHistory({ requests, onChanged, userId }: Props) {
    const [cancelTarget, setCancelTarget] = useState<BoothChangeRequest | null>(null);
    const [canceling, setCanceling] = useState(false);
    const [cancelError, setCancelError] = useState("");

    const handleCancelRequest = async () => {
        if (!cancelTarget || userId == null) return;
        setCancelError("");
        setCanceling(true);
        try {
            await cancelBoothChangeRequest(cancelTarget.id, userId);
            setCancelTarget(null);
            await onChanged();
        } catch (err) {
            setCancelError(err instanceof Error ? err.message : String(err));
        } finally {
            setCanceling(false);
        }
    };

    if (requests.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-[#92C7CF]/20 bg-white/30 px-3 py-4 text-center text-sm text-gray-500">
                You haven't submitted any requests yet.
            </p>
        );
    }

    return (
        <>
            <div className="overflow-x-auto rounded-xl border border-white/40 bg-white/30">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-white/40 bg-gradient-to-r from-[#92C7CF]/10 to-[#AAD7D9]/10">
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Device</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">From</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">To</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Reason</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requests.map((r) => (
                            <tr key={r.id} className="border-b border-white/30 transition hover:bg-[#92C7CF]/8">
                                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{r.device_no || `POS #${r.pos_record_id}`}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-gray-500">{r.current_booth_code || "-"}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{r.requested_booth_code || `#${r.requested_booth_id}`}</td>
                                <td className="px-4 py-3 text-gray-500">{r.reason || "-"}</td>
                                <td className="whitespace-nowrap px-4 py-3"><StatusPill status={r.status} /></td>
                                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right">
                                    {(r.status || "").toLowerCase() === "pending" ? (
                                        <button
                                            onClick={() => setCancelTarget(r)}
                                            disabled={canceling}
                                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                    ) : (
                                        <span className="text-xs text-gray-400">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {cancelError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {cancelError}
                </div>
            )}

            <ConfirmationModal
                open={cancelTarget != null}
                title="Cancel Booth Change Request"
                message="Are you sure you want to cancel this pending booth change request?"
                confirmLabel="Yes, Cancel"
                cancelLabel="No, Keep"
                isLoading={canceling}
                loadingLabel="Cancelling..."
                onCancel={() => setCancelTarget(null)}
                onConfirm={handleCancelRequest}
            >
                {cancelTarget && (
                    <div className="space-y-2 px-4 py-3 text-sm text-gray-700">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">Device</span>
                            <span>{cancelTarget.device_no || `POS #${cancelTarget.pos_record_id}`}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">From</span>
                            <span>{cancelTarget.current_booth_code || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">To</span>
                            <span>{cancelTarget.requested_booth_code || `#${cancelTarget.requested_booth_id}`}</span>
                        </div>
                    </div>
                )}
            </ConfirmationModal>
        </>
    );
}

function StatusPill({ status }: { status: BoothChangeRequest["status"] }) {
    const normalizedStatus = ((status || "") as string).toLowerCase() as BoothChangeRequest["status"];
    const colorMap: Record<BoothChangeRequest["status"], string> = {
        pending: "bg-[#F2D7B5]/40 text-gray-700",
        approved: "bg-green-100 text-green-700",
        rejected: "bg-red-100 text-red-600",
        cancelled: "bg-gray-100 text-gray-500",
    };

    return (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${colorMap[normalizedStatus] || "bg-gray-100 text-gray-500"}`}>
            {status}
        </span>
    );
}
