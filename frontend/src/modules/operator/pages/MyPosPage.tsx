import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, ChevronLeft, ChevronRight, History, RefreshCw, Search } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { fetchPosRecords, fetchBoothInfo, fetchOperators } from "../../pos/services";
import type { OperatorInfo, PosRecord, BoothInfo } from "../../pos/types";
import {
    listBoothChangeRequests,
    type BoothChangeRequest,
} from "../../pos/services/boothChangeRequests";
import RequestBoothChangeModal from "../components/RequestBoothChangeModal";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const PAGE_SIZE = 10;

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
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);

    const [requesting, setRequesting] = useState<PosRecord | null>(null);

    const handleRefresh = async () => {
        // Reset all filters back to defaults
        setFilterOperatorId("all");
        setSearchQuery("");
        setPage(1);
        await refresh();
    };

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
                // Operators list — used to build the sub-operator filter dropdown
                fetchOperators().catch(() => [] as OperatorInfo[]),
            ]);
            setRecords(posData);
            setBooths(boothData);
            setRequests(reqData);
            setAllOperators(ops);
        } catch (err) {
            setError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, filterOperatorId]);

    // Resolve the logged-in user's operator profile from either the /api/users/me endpoint
    // or from the operators list (matched by user_id).
    // Uses Number() coercion because the APIs return ids as different types (string vs number).
    const myOperator = useMemo(() => {
        const myOpId = me?.operator_id != null ? Number(me.operator_id) : null;
        if (myOpId != null) return allOperators.find((o) => Number(o.id) === myOpId) ?? null;
        const myUserId = user?.id != null ? Number(user.id) : null;
        if (myUserId != null) return allOperators.find((o) => o.user_id != null && Number(o.user_id) === myUserId) ?? null;
        return null;
    }, [me, allOperators, user?.id]);

    const isMainOperator = myOperator !== null && myOperator.parent_operator_id == null;
    // Automatically detect sub-operators that belong to this main operator
    const myDirectSubs = useMemo(() => {
        if (!isMainOperator || !myOperator) return [] as OperatorInfo[];
        const myId = Number(myOperator.id);
        return allOperators.filter((o) => o.parent_operator_id != null && Number(o.parent_operator_id) === myId);
    }, [isMainOperator, myOperator, allOperators]);

    const pendingByPos = useMemo(() => {
        const map = new Map<number, BoothChangeRequest>();
        for (const r of requests) {
            if (r.status === "pending") map.set(r.pos_record_id, r);
        }
        return map;
    }, [requests]);

    // Search filter — searches device_no and serial_number across all records
    const searchedRecords = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return records;
        return records.filter(
            (r) =>
                (r.device_no || "").toLowerCase().includes(q) ||
                (r.serial_number || r.serial_no || "").toLowerCase().includes(q)
        );
    }, [records, searchQuery]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(searchedRecords.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginatedRecords = useMemo(
        () => searchedRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
        [searchedRecords, safePage]
    );

    const pageNumbers = useMemo(() => {
        const pages: (number | "...")[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (safePage > 3) pages.push("...");
            const start = Math.max(2, safePage - 1);
            const end = Math.min(totalPages - 1, safePage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (safePage < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    }, [totalPages, safePage]);

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
                    {/* Search by device no. / serial number */}
                    <div className="relative">
                        <Search
                            size={14}
                            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search device no. or SN…"
                            className="w-44 rounded-lg border border-warm bg-card pl-8 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                        />
                    </div>
                    {/* Sub-operator filter — automatically populated for main operators */}
                    {isMainOperator && myDirectSubs.length > 0 && (
                        <select
                            value={filterOperatorId === "all" ? "all" : String(filterOperatorId)}
                            onChange={(e) => {
                                const v = e.target.value;
                                setFilterOperatorId(v === "all" ? "all" : Number(v));
                                setSearchQuery("");
                                setPage(1);
                            }}
                            className="rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                        >
                            <option value="all">All devices</option>
                            {myDirectSubs.map((s) => (
                                <option key={s.id} value={String(s.id)}>
                                    {s.operator}
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={handleRefresh}
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
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Operator</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-subtle">Loading...</td></tr>
                        ) : searchedRecords.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-subtle">No devices match your search.</td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-subtle">No POS devices assigned to you yet.</td></tr>
                        ) : (
                            paginatedRecords.map((rec) => {
                                const pending = pendingByPos.get(rec.id);
                                return (
                                    <tr key={rec.id} className="border-b border-warm/60 transition hover:bg-cream">
                                        <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{rec.device_no}</td>
                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-muted">{rec.serial_number}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-ink">{rec.booth_code || "—"}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{rec.operator || "—"}</td>
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

                {/* Pagination footer — only when data exists and not loading */}
                {!loading && searchedRecords.length > 0 && (
                    <div className="flex items-center justify-between border-t border-warm/60 px-4 py-3">
                        <p className="text-xs text-ink-subtle">
                            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, searchedRecords.length)} of {searchedRecords.length}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-subtle transition hover:bg-warm/40 disabled:opacity-30 disabled:pointer-events-none"
                                aria-label="Previous page"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {pageNumbers.map((p, i) =>
                                p === "..." ? (
                                    <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-ink-subtle">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition ${p === safePage
                                            ? "bg-teal text-ink"
                                            : "text-ink-subtle hover:bg-warm/40"
                                            }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-subtle transition hover:bg-warm/40 disabled:opacity-30 disabled:pointer-events-none"
                                aria-label="Next page"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
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
                operators={allOperators}
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