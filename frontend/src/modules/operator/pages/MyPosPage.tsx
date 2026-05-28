import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, History, RefreshCw } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { fetchPosRecords, fetchBoothInfo, fetchOperators } from "../../pos/services";
import type { OperatorInfo, PosRecord, BoothInfo } from "../../pos/types";
import {
    listBoothChangeRequests,
    type BoothChangeRequest,
} from "../../pos/services/boothChangeRequests";
import RequestBoothChangeModal from "../components/RequestBoothChangeModal";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
}

export default function MyPosPage() {
    const { user } = useAuth();
    const [me, setMe] = useState<Me | null>(null);
    const [allOperators, setAllOperators] = useState<OperatorInfo[]>([]);
    const [records, setRecords] = useState<PosRecord[]>([]);
    const [booths, setBooths] = useState<BoothInfo[]>([]);
    const [requests, setRequests] = useState<BoothChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filterOperatorId, setFilterOperatorId] = useState<number | "all">("all");

    const [requesting, setRequesting] = useState<PosRecord | null>(null);

    const refresh = async () => {
        if (!user?.id) return;
        try {
            setLoading(true);
            setError("");
            const meRes = await fetch(`${API_BASE_URL}/api/users/me?id=${user.id}`);
            const meData = meRes.ok ? await meRes.json() : null;
            const meSafe: Me | null = meData
                ? {
                    id: meData.id,
                    operator_id: meData.operator_id ?? null,
                    parent_operator_id: meData.parent_operator_id ?? null,
                }
                : null;
            setMe(meSafe);

            // Build filter params: when a main operator narrows to a sub, send as_operator_id
            const filterParams: Parameters<typeof fetchPosRecords>[0] = {
                user_id: String(user.id),
            };
            if (
                meSafe &&
                meSafe.parent_operator_id === null &&
                filterOperatorId !== "all" &&
                typeof filterOperatorId === "number"
            ) {
                filterParams.as_operator_id = String(filterOperatorId);
            }

            const [posData, boothData, reqData, ops] = await Promise.all([
                fetchPosRecords(filterParams),
                fetchBoothInfo(),
                listBoothChangeRequests({ userId: user.id }),
                // Operators list — used to render the sub-operator filter dropdown
                fetchOperators().catch(() => [] as OperatorInfo[]),
            ]);
            setRecords(posData);
            setBooths(boothData);
            setRequests(reqData);
            setAllOperators(ops);
        } catch (err: any) {
            setError(err.message || "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, filterOperatorId]);

    const isMainOperator = me?.operator_id !== null && me?.parent_operator_id === null;
    const myDirectSubs = useMemo(() => {
        if (!isMainOperator || !me?.operator_id) return [] as OperatorInfo[];
        return allOperators.filter((o) => o.parent_operator_id === me.operator_id);
    }, [isMainOperator, me, allOperators]);

    const pendingByPos = useMemo(() => {
        const map = new Map<number, BoothChangeRequest>();
        for (const r of requests) {
            if (r.status === "pending") map.set(r.pos_record_id, r);
        }
        return map;
    }, [requests]);

    return (
        <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-ink">My POS Devices</h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Devices assigned to you. Request a booth change for any of them below.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {isMainOperator && myDirectSubs.length > 0 && (
                        <select
                            value={filterOperatorId === "all" ? "all" : String(filterOperatorId)}
                            onChange={(e) => {
                                const v = e.target.value;
                                setFilterOperatorId(v === "all" ? "all" : Number(v));
                            }}
                            className="rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            title="Filter to a specific sub-operator"
                        >
                            <option value="all">All (own + subs)</option>
                            {me?.operator_id && (
                                <option value={String(me.operator_id)}>
                                    Only mine
                                </option>
                            )}
                            {myDirectSubs.map((s) => (
                                <option key={s.id} value={String(s.id)}>
                                    Only {s.operator}
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-warm bg-cream">
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Device No.</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Serial</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Booth</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-subtle">Loading...</td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-subtle">No POS devices assigned to you yet.</td></tr>
                        ) : (
                            records.map((rec) => {
                                const pending = pendingByPos.get(rec.id);
                                return (
                                    <tr key={rec.id} className="border-b border-warm/60 transition hover:bg-cream">
                                        <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{rec.device_no}</td>
                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-muted">{rec.serial_number}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-ink">{rec.booth_code || "—"}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{rec.status}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                            {pending ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-peach/40 px-2.5 py-0.5 text-xs font-semibold text-ink">
                                                    Pending: → {pending.requested_booth_code}
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => setRequesting(rec)}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-teal-dark"
                                                >
                                                    <ArrowRightLeft size={14} />
                                                    Request Booth Change
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Request history */}
            <div className="mt-8">
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
                    <History size={16} />
                    My Booth Change Requests
                </h2>
                <RequestHistoryList requests={requests} onChanged={refresh} userId={user?.id ?? null} />
            </div>

            <RequestBoothChangeModal
                open={!!requesting}
                posRecord={requesting}
                booths={booths}
                onClose={() => setRequesting(null)}
                onSubmitted={async () => {
                    setRequesting(null);
                    await refresh();
                }}
            />
        </div>
    );
}

function RequestHistoryList({
    requests,
    onChanged,
    userId,
}: {
    requests: BoothChangeRequest[];
    onChanged: () => Promise<void>;
    userId: number | null;
}) {
    if (requests.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-warm bg-cream/50 px-3 py-4 text-center text-sm text-ink-subtle">
                You haven't submitted any requests yet.
            </p>
        );
    }
    return (
        <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-warm bg-cream">
                        <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Device</th>
                        <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">From</th>
                        <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">To</th>
                        <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Reason</th>
                        <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                        <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Submitted</th>
                    </tr>
                </thead>
                <tbody>
                    {requests.map((r) => (
                        <tr key={r.id} className="border-b border-warm/60">
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{r.device_no || `POS #${r.pos_record_id}`}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{r.current_booth_code || "—"}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-ink">{r.requested_booth_code || `#${r.requested_booth_id}`}</td>
                            <td className="px-4 py-3 text-ink-muted">{r.reason || "—"}</td>
                            <td className="whitespace-nowrap px-4 py-3"><StatusPill status={r.status} /></td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-subtle">{new Date(r.created_at).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {/* userId is captured for future "cancel" UI on this same screen if you want it later */}
            <input type="hidden" value={userId ?? ""} onChange={() => onChanged()} />
        </div>
    );
}

function StatusPill({ status }: { status: BoothChangeRequest["status"] }) {
    const colorMap: Record<BoothChangeRequest["status"], string> = {
        pending: "bg-peach/40 text-ink",
        approved: "bg-teal-light/60 text-ink",
        rejected: "bg-rose/40 text-ink",
        cancelled: "bg-warm text-ink-muted",
    };
    return (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${colorMap[status]}`}>
            {status}
        </span>
    );
}
