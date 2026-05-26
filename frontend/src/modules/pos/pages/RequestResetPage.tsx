import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import {
    approveBoothChangeRequest,
    listBoothChangeRequests,
    rejectBoothChangeRequest,
    type BoothChangeRequest,
    type RequestStatus,
} from "../services/boothChangeRequests";

export default function RequestResetPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<BoothChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<RequestStatus | "all">("pending");
    const [busyId, setBusyId] = useState<number | null>(null);
    const [notesById, setNotesById] = useState<Record<number, string>>({});

    const refresh = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await listBoothChangeRequests(
                filter === "all" ? {} : { status: filter }
            );
            setRequests(data);
        } catch (err: any) {
            setError(err.message || "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    const counts = useMemo(() => {
        const c = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
        for (const r of requests) c[r.status]++;
        return c;
    }, [requests]);

    const setNote = (id: number, value: string) =>
        setNotesById((prev) => ({ ...prev, [id]: value }));

    const handleApprove = async (req: BoothChangeRequest) => {
        if (!confirm(`Approve booth change for ${req.device_no} → ${req.requested_booth_code}?`)) return;
        setBusyId(req.id);
        try {
            await approveBoothChangeRequest(req.id, {
                admin_user_id: user?.id ?? null,
                admin_notes: notesById[req.id] || "",
            });
            await refresh();
        } catch (e: any) {
            alert(e.message || "Approval failed");
        } finally {
            setBusyId(null);
        }
    };

    const handleReject = async (req: BoothChangeRequest) => {
        const note = notesById[req.id] || "";
        if (!note.trim()) {
            alert("Please add a note explaining why before rejecting.");
            return;
        }
        if (!confirm(`Reject this request for ${req.device_no}?`)) return;
        setBusyId(req.id);
        try {
            await rejectBoothChangeRequest(req.id, {
                admin_user_id: user?.id ?? null,
                admin_notes: note,
            });
            await refresh();
        } catch (e: any) {
            alert(e.message || "Reject failed");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-ink">Request Reset Device</h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Booth change requests submitted by operators. Approve to move the device automatically.
                    </p>
                </div>
                <button
                    onClick={refresh}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            {/* Filter tabs */}
            <div className="mb-4 flex flex-wrap gap-2">
                {(
                    [
                        ["pending", "Pending"],
                        ["approved", "Approved"],
                        ["rejected", "Rejected"],
                        ["cancelled", "Cancelled"],
                        ["all", "All"],
                    ] as Array<[RequestStatus | "all", string]>
                ).map(([value, label]) => (
                    <button
                        key={value}
                        onClick={() => setFilter(value)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filter === value
                            ? "bg-teal text-ink"
                            : "border border-warm bg-card text-ink-muted hover:bg-warm/40"
                            }`}
                    >
                        {label}
                        {value !== "all" && filter === value && (
                            <span className="ml-1.5 text-xs opacity-70">({counts[value]})</span>
                        )}
                    </button>
                ))}
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                {loading ? (
                    <p className="rounded-xl border border-warm bg-card px-3 py-10 text-center text-sm text-ink-subtle">
                        Loading...
                    </p>
                ) : requests.length === 0 ? (
                    <p className="rounded-xl border border-warm bg-card px-3 py-10 text-center text-sm text-ink-subtle">
                        No {filter === "all" ? "" : filter} requests.
                    </p>
                ) : (
                    requests.map((req) => (
                        <div
                            key={req.id}
                            className="rounded-xl border border-warm bg-card p-4 shadow-sm"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-semibold text-ink">
                                            {req.device_no || `POS #${req.pos_record_id}`}
                                        </span>
                                        <StatusPill status={req.status} />
                                    </div>
                                    <p className="mt-1 text-xs text-ink-muted">
                                        Requested by{" "}
                                        <span className="font-medium text-ink">
                                            {req.requested_by_name || "—"}
                                        </span>
                                        {" · "}
                                        {new Date(req.created_at).toLocaleString()}
                                    </p>
                                </div>

                                {req.status === "pending" && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(req)}
                                            disabled={busyId === req.id}
                                            className="inline-flex items-center gap-1 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                                        >
                                            <CheckCircle2 size={14} />
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(req)}
                                            disabled={busyId === req.id}
                                            className="inline-flex items-center gap-1 rounded-lg bg-rose px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-rose-dark disabled:opacity-50"
                                        >
                                            <XCircle size={14} />
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="mt-3 grid gap-2 rounded-lg bg-cream/50 p-3 text-sm sm:grid-cols-3">
                                <Pair label="Serial" value={req.serial_number || "—"} />
                                <Pair
                                    label="Move from"
                                    value={req.current_booth_code || "—"}
                                />
                                <Pair
                                    label="Move to"
                                    value={req.requested_booth_code || `#${req.requested_booth_id}`}
                                />
                            </div>

                            {req.reason && (
                                <p className="mt-3 rounded-lg border border-warm bg-cream px-3 py-2 text-sm text-ink">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                        Reason
                                    </span>
                                    <br />
                                    {req.reason}
                                </p>
                            )}

                            {req.status === "pending" ? (
                                <textarea
                                    value={notesById[req.id] ?? ""}
                                    onChange={(e) => setNote(req.id, e.target.value)}
                                    placeholder="Admin note (required to reject; optional to approve)"
                                    rows={2}
                                    className="mt-3 w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                                />
                            ) : (
                                req.admin_notes && (
                                    <p className="mt-3 text-xs text-ink-muted">
                                        <span className="font-semibold text-ink">Admin note:</span>{" "}
                                        {req.admin_notes}
                                        {req.admin_name && ` — ${req.admin_name}`}
                                    </p>
                                )
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function Pair({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
            </div>
            <div className="text-sm text-ink">{value}</div>
        </div>
    );
}

function StatusPill({ status }: { status: RequestStatus }) {
    const colorMap: Record<RequestStatus, string> = {
        pending: "bg-peach/40 text-ink",
        approved: "bg-teal-light/60 text-ink",
        rejected: "bg-rose/40 text-ink",
        cancelled: "bg-warm text-ink-muted",
    };
    return (
        <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${colorMap[status]}`}
        >
            {status}
        </span>
    );
}
