import { useMemo, useState } from "react";
import {
    cancelCpBoothChangeRequest,
    type CpBoothChangeRequest,
} from "../../requests/services/cpBoothChangeRequests";
import ConfirmationModal from "../../pos/components/ConfirmationModal";

interface Props {
    requests: CpBoothChangeRequest[];
    search?: string;
    onChanged: () => Promise<void>;
    userId: number | null;
    onCancelled?: (request: CpBoothChangeRequest) => void;
    onCancelError?: (message: string) => void;
}

export default function CpBoothChangeRequestHistory({
    requests,
    search = "",
    onChanged,
    userId,
    onCancelled,
    onCancelError,
}: Props) {
    const [cancelTarget, setCancelTarget] = useState<CpBoothChangeRequest | null>(null);
    const [canceling, setCanceling] = useState(false);
    const [cancelError, setCancelError] = useState("");

    const handleCancelRequest = async () => {
        if (!cancelTarget || userId == null) return;
        setCancelError("");
        setCanceling(true);
        const target = cancelTarget;
        try {
            await cancelCpBoothChangeRequest(target.id, userId);
            setCancelTarget(null);
            await onChanged();
            onCancelled?.(target);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setCancelError(message);
            onCancelError?.(message);
        } finally {
            setCanceling(false);
        }
    };

    const filteredRequests = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return requests;
        return requests.filter((r) => {
            const control_no = String(r.control_no || "").toLowerCase();
            const serial = String(r.serial_number || "").toLowerCase();
            return control_no.includes(q) || serial.includes(q);
        });
    }, [requests, search]);

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
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Admin Note</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRequests.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-6 text-center text-sm text-gray-500"
                                >
                                    No requests match "{search}".
                                </td>
                            </tr>
                        ) : (
                            filteredRequests.map((r) => (
                                <tr key={r.id} className="border-b border-white/30 transition hover:bg-[#92C7CF]/8">
                                    <td className="whitespace-nowrap px-4 py-3">
                                        <div className="font-medium text-gray-800">
                                            {r.control_no || `CP #${r.cellphone_id}`}
                                        </div>
                                        <div className="font-mono text-xs text-gray-500">
                                            {r.serial_number || "—"}
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">-</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{r.requested_booth_code || `#${r.requested_booth_id}`}</td>
                                    <td className="px-4 py-3 text-gray-500">{r.reason || "-"}</td>
                                    <td className="whitespace-nowrap px-4 py-3"><CpStatusPill status={r.status} /></td>
                                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-gray-500 max-w-[200px] truncate" title={r.admin_notes || ""}>{r.admin_notes || "-"}</td>
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
                            ))
                        )}
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
                            <span>
                                {cancelTarget.control_no || `CP #${cancelTarget.cellphone_id}`}
                                {cancelTarget.serial_number ? (
                                    <span className="ml-2 font-mono text-xs text-gray-500">
                                        {cancelTarget.serial_number}
                                    </span>
                                ) : null}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">From</span>
                            <span>-</span>
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

function CpStatusPill({ status }: { status: CpBoothChangeRequest["status"] }) {
    const normalizedStatus = ((status || "") as string).toLowerCase() as CpBoothChangeRequest["status"];
    const colorMap: Record<CpBoothChangeRequest["status"], string> = {
        pending: "bg-[#F2D7B5]/40 text-gray-700 dark:bg-amber-800/60 dark:text-amber-200",
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