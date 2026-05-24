import { useEffect, useMemo, useState } from "react";
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    UserX,
    AreaChart,
    Ticket,
    Building2,
    TrendingUp,
    List,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import {
    fetchCancellationHumanForce,
    fetchCancellationRecords,
    syncCancellationSummary,
} from "../services";
import type { CancellationHumanForce, CancellationRecord } from "../types";

/* ---------- tiny helpers ---------- */
function cx(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(" ");
}

function formatDisplayDate(dateStr: string): string {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/* ---------- loading skeleton ---------- */
function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={cx(
                "animate-pulse rounded-lg bg-gradient-to-r from-warm/40 via-warm/60 to-warm/40 bg-[length:200%_100%]",
                className
            )}
        />
    );
}

function StatCardSkeleton() {
    return (
        <div className="rounded-xl border border-white/30 bg-white/40 p-5 shadow-sm backdrop-blur-sm">
            <Skeleton className="mb-3 h-4 w-20" />
            <Skeleton className="mb-2 h-8 w-16" />
            <Skeleton className="h-1.5 w-full" />
        </div>
    );
}

function AreaCardSkeleton() {
    return (
        <div className="rounded-xl border border-white/30 bg-white/40 p-5 shadow-sm backdrop-blur-sm">
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                ))}
            </div>
        </div>
    );
}

export default function CancellationRecordsPage() {
    const { user } = useAuth();
    const [date, setDate] = useState("");
    const [records, setRecords] = useState<CancellationRecord[]>([]);
    const [humanForce, setHumanForce] = useState<CancellationHumanForce[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [manualSyncing, setManualSyncing] = useState(false);
    const todayStr = new Date().toISOString().split("T")[0];

    /* Derived data ------------------------------------------------ */
    const totals = useMemo(
        () =>
            records.reduce(
                (sum, item) => ({
                    approved: sum.approved + Number(item.approved || 0),
                    denied: sum.denied + Number(item.denied || 0),
                }),
                { approved: 0, denied: 0 }
            ),
        [records]
    );

    const humanForceCounts = useMemo(() => {
        let force = 0;
        let human = 0;
        for (const hf of humanForce) {
            const reason = (hf.reaseon_for_deny || "").toUpperCase();
            if (reason.includes("FORCE CANCEL")) force++;
            else if (reason.includes("HUMAN ERROR")) human++;
        }
        return { force, human };
    }, [humanForce]);

    const grandTotal = totals.approved + totals.denied;
    const grandTroubleTotal = humanForceCounts.force + humanForceCounts.human;

    /** Per-area breakdown: approved, denied, force_cancel, human_error */
    const areaOverview = useMemo(() => {
        const map = new Map<
            string,
            { approved: number; denied: number; force_cancel: number; human_error: number }
        >();

        for (const rec of records) {
            const key = rec.area;
            if (!map.has(key)) {
                map.set(key, { approved: 0, denied: 0, force_cancel: 0, human_error: 0 });
            }
            const entry = map.get(key)!;
            entry.approved += Number(rec.approved || 0);
            entry.denied += Number(rec.denied || 0);
        }

        for (const hf of humanForce) {
            const key = hf.area;
            if (!map.has(key)) {
                map.set(key, { approved: 0, denied: 0, force_cancel: 0, human_error: 0 });
            }
            const entry = map.get(key)!;
            const reason = (hf.reaseon_for_deny || "").toUpperCase();
            if (reason.includes("FORCE CANCEL")) {
                entry.force_cancel += 1;
            } else if (reason.includes("HUMAN ERROR")) {
                entry.human_error += 1;
            }
        }

        const preferred = ["CDO", "MISOR"];
        const sorted = Array.from(map.entries()).sort(([a], [b]) => {
            const ia = preferred.indexOf(a.toUpperCase());
            const ib = preferred.indexOf(b.toUpperCase());
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
        return sorted.map(([area, data]) => ({ area, ...data }));
    }, [records, humanForce]);

    /* Data loading ------------------------------------------------ */
    useEffect(() => {
        let ignore = false;

        async function loadRecords() {
            setLoading(true);
            setError("");
            try {
                const [recordRows, humanForceRows] = await Promise.all([
                    fetchCancellationRecords(date),
                    fetchCancellationHumanForce(date),
                ]);
                if (!ignore) {
                    setRecords(recordRows);
                    setHumanForce(humanForceRows);
                }
            } catch (err) {
                if (!ignore) setError(err instanceof Error ? err.message : "Unable to load cancellation records");
            } finally {
                if (!ignore) setLoading(false);
            }
        }

        loadRecords();
        return () => {
            ignore = true;
        };
    }, [date]);

    async function doSync(manual: boolean) {
        setManualSyncing(manual);
        setSyncing(true);
        setError("");
        if (manual) setMessage("");

        try {
            const result = await syncCancellationSummary({
                sync_all: true,
                cancelled_by_id: user?.id ?? null,
            });
            const targetDate = manual ? date : todayStr;
            const [recordRows, humanForceRows] = await Promise.all([
                fetchCancellationRecords(targetDate),
                fetchCancellationHumanForce(targetDate),
            ]);
            setRecords(recordRows);
            setHumanForce(humanForceRows);
            setLastSynced(new Date());
            if (manual) {
                setMessage(
                    `Scanned ${result.scanned} transaction${result.scanned === 1 ? "" : "s"} across ${
                        result.synced_dates?.length || 0
                    } date${result.synced_dates?.length === 1 ? "" : "s"}.`
                );
            }
        } catch (err) {
            if (manual) setError(err instanceof Error ? err.message : "Unable to sync cancellation summary");
        } finally {
            setSyncing(false);
            setManualSyncing(false);
        }
    }

    /* Auto-sync every 5 minutes for the current date */
    useEffect(() => {
        const id = setInterval(() => {
            doSync(false);
        }, 5 * 60 * 1000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* Auto-dismiss manual success toast after 5 seconds */
    useEffect(() => {
        if (!message) return;
        const id = setTimeout(() => setMessage(""), 5000);
        return () => clearTimeout(id);
    }, [message]);

    /* ---------- render ---------- */
    return (
        <div className="space-y-6">
            {/* ─────────────── Decorative Header ─────────────── */}
            <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-br from-white/30 to-white/10 p-6 shadow-lg backdrop-blur-xl sm:p-8">
                {/* Decorative blobs */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-teal/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-teal-light/10 blur-3xl" />

                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal to-teal-light text-white shadow-lg shadow-teal/30">
                            <List className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-ink">
                                {date ? formatDisplayDate(date) : formatDisplayDate(new Date().toISOString().split("T")[0])}
                            </h1>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                                {syncing && !manualSyncing && (
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
                                    </span>
                                )}
                                {lastSynced ? `Last synced: ${formatTime(lastSynced)}` : "Not synced yet"}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <input
                                type="date"
                                value={date}
                                onChange={(event) => setDate(event.target.value)}
                                className="h-10 rounded-xl border border-white/40 bg-white/50 pl-3 pr-3 text-sm text-ink outline-none backdrop-blur-sm transition focus:border-teal focus:ring-2 focus:ring-teal/20"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => doSync(true)}
                            disabled={syncing}
                            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-br from-teal to-teal-light px-4 text-sm font-medium text-white shadow-lg shadow-teal/30 transition hover:from-teal-dark hover:to-teal focus:ring-2 focus:ring-teal/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                            {syncing ? "Syncing…" : "Sync Sheet"}
                        </button>
                    </div>
                </div>
            </div>

            {/* ─────────────── Message Banner ─────────────── */}
            {(message || error) && (
                <div
                    className={cx(
                        "animate-[slideDown_0.3s_ease-out] rounded-xl border px-4 py-3 text-sm font-medium shadow-sm backdrop-blur-sm",
                        error
                            ? "border-rose/40 bg-rose/10 text-rose-dark"
                            : "border-emerald-200/60 bg-emerald-50/70 text-emerald-700"
                    )}
                >
                    <span className="inline-flex items-center gap-2">
                        {error ? (
                            <XCircle className="h-4 w-4 shrink-0" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                        )}
                        {error || message}
                    </span>
                </div>
            )}

            {/* ─────────────── Overall Totals ─────────────── */}
            <section>
                {loading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                    </div>
                ) : (
                    <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-br from-white/30 to-white/10 p-5 shadow-lg backdrop-blur-xl sm:p-6">
                        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/5 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-amber-500/5 blur-3xl" />

                        <div className="relative">
                            <div className="mb-4 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-ink-muted" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                    Overall Total
                                </span>
                                <span className="ml-auto text-xs text-ink-muted">
                                    Total: <strong className="text-ink">{grandTotal}</strong> cancellations
                                </span>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {/* Approved */}
                                <div className="group rounded-xl border border-white/30 bg-white/40 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md hover:bg-white/60">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-ink-muted">Approved</span>
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50/60">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                        </div>
                                    </div>
                                    <div className="mt-2 text-2xl font-bold text-emerald-600">{totals.approved}</div>
                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
                                        <div
                                            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                                            style={{
                                                width: grandTotal > 0 ? `${(totals.approved / grandTotal) * 100}%` : "0%",
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Denied */}
                                <div className="group rounded-xl border border-white/30 bg-white/40 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md hover:bg-white/60">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-ink-muted">Denied</span>
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50/60">
                                            <XCircle className="h-4 w-4 text-red-400" />
                                        </div>
                                    </div>
                                    <div className="mt-2 text-2xl font-bold text-red-600">{totals.denied}</div>
                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-red-100">
                                        <div
                                            className="h-full rounded-full bg-red-400 transition-all duration-500"
                                            style={{
                                                width: grandTotal > 0 ? `${(totals.denied / grandTotal) * 100}%` : "0%",
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Force Cancel */}
                                <div className="group rounded-xl border border-white/30 bg-white/40 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md hover:bg-white/60">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-ink-muted">Force Cancel</span>
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50/60">
                                            <AlertTriangle className="h-4 w-4 text-orange-400" />
                                        </div>
                                    </div>
                                    <div className="mt-2 text-2xl font-bold text-orange-600">{humanForceCounts.force}</div>
                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-orange-100">
                                        <div
                                            className="h-full rounded-full bg-orange-400 transition-all duration-500"
                                            style={{
                                                width: grandTroubleTotal > 0 ? `${(humanForceCounts.force / grandTroubleTotal) * 100}%` : "0%",
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Human Error */}
                                <div className="group rounded-xl border border-white/30 bg-white/40 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md hover:bg-white/60">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-ink-muted">Human Error</span>
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50/60">
                                            <UserX className="h-4 w-4 text-purple-400" />
                                        </div>
                                    </div>
                                    <div className="mt-2 text-2xl font-bold text-purple-600">{humanForceCounts.human}</div>
                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-purple-100">
                                        <div
                                            className="h-full rounded-full bg-purple-400 transition-all duration-500"
                                            style={{
                                                width: grandTroubleTotal > 0 ? `${(humanForceCounts.human / grandTroubleTotal) * 100}%` : "0%",
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* ─────────────── Area Overview Cards ─────────────── */}
            <section>
                <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-br from-white/30 to-white/10 p-5 shadow-lg backdrop-blur-xl sm:p-6">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-teal/5 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-amber-500/5 blur-3xl" />

                    <div className="relative">
                        <div className="mb-4 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-ink-muted" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Area Overview
                            </span>
                        </div>

                        {loading ? (
                            <div className="grid gap-6 sm:grid-cols-2">
                                <AreaCardSkeleton />
                                <AreaCardSkeleton />
                            </div>
                        ) : areaOverview.length > 0 ? (
                            <div className="grid gap-6 sm:grid-cols-2">
                                {areaOverview.map((area) => {
                                    const areaTotal = area.approved + area.denied + area.force_cancel + area.human_error;
                                    const accent = area.area.toUpperCase() === "CDO" ? "teal" : "warm";
                                    return (
                                        <div
                                            key={area.area}
                                            className="group overflow-hidden rounded-xl border border-white/30 bg-white/40 shadow-sm backdrop-blur-sm transition hover:shadow-md hover:bg-white/60"
                                        >
                                            {/* Card header */}
                                            <div
                                                className={cx(
                                                    "flex items-center justify-between px-5 py-3.5",
                                                    accent === "teal" ? "bg-teal/5" : "bg-warm/20"
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Building2
                                                        className={cx(
                                                            "h-4 w-4",
                                                            accent === "teal" ? "text-teal" : "text-ink-muted"
                                                        )}
                                                    />
                                                    <h3 className="text-sm font-bold text-ink">{area.area}</h3>
                                                </div>
                                                <span className="text-xs text-ink-muted">
                                                    Total: <strong className="text-ink">{areaTotal}</strong>
                                                </span>
                                            </div>

                                            {/* Metrics grid */}
                                            <div className="grid grid-cols-4 divide-x divide-white/20">
                                                <div className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                                        <span className="text-[10px] text-ink-muted">Appr.</span>
                                                    </div>
                                                    <div className="mt-1 text-lg font-bold text-emerald-600">
                                                        {area.approved}
                                                    </div>
                                                </div>
                                                <div className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <XCircle className="h-3 w-3 text-red-400" />
                                                        <span className="text-[10px] text-ink-muted">Denied</span>
                                                    </div>
                                                    <div className="mt-1 text-lg font-bold text-red-600">
                                                        {area.denied}
                                                    </div>
                                                </div>
                                                <div className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <AlertTriangle className="h-3 w-3 text-orange-400" />
                                                        <span className="text-[10px] text-ink-muted">Force</span>
                                                    </div>
                                                    <div className="mt-1 text-lg font-bold text-orange-600">
                                                        {area.force_cancel}
                                                    </div>
                                                </div>
                                                <div className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <UserX className="h-3 w-3 text-purple-400" />
                                                        <span className="text-[10px] text-ink-muted">Human</span>
                                                    </div>
                                                    <div className="mt-1 text-lg font-bold text-purple-600">
                                                        {area.human_error}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-white/30 bg-white/20 p-8 text-center shadow-sm backdrop-blur-sm">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/40">
                                    <AreaChart className="h-6 w-6 text-ink-muted" />
                                </div>
                                <p className="text-sm text-ink-muted">No data available for this date.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ─────────────── Force Cancel / Human Error Table ─────────────── */}
            <section>
                <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-br from-white/30 to-white/10 shadow-lg backdrop-blur-xl">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-500/5 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-purple-500/5 blur-3xl" />

                    <div className="relative px-5 pt-5 sm:px-6 sm:pt-6">
                        <div className="mb-4 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-ink-muted" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Force Cancel / Human Error
                            </span>
                            {!loading && (
                                <span className="ml-auto text-xs text-ink-muted">
                                    <strong className="text-ink">{humanForce.length}</strong> record{humanForce.length === 1 ? "" : "s"}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto px-0 pb-0">
                        <table className="min-w-full text-left text-xs">
                            <thead>
                                <tr className="border-y border-white/30 bg-white/20">
                                    <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-ink-muted">Ticket Number</th>
                                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-ink-muted">Area</th>
                                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-ink-muted">Booth</th>
                                    <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-ink-muted">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/20 text-ink">
                                {humanForce.map((item, idx) => {
                                    const reason = (item.reaseon_for_deny || "").toUpperCase();
                                    const isForce = reason.includes("FORCE CANCEL");
                                    return (
                                        <tr
                                            key={item.id}
                                            className={cx(
                                                "transition hover:bg-teal/5",
                                                idx % 2 === 0 ? "bg-white/30" : "bg-white/10"
                                            )}
                                        >
                                            <td className="px-5 py-3.5 font-medium text-ink">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Ticket className="h-3 w-3 text-ink-subtle" />
                                                    {item.ticket_number || "-"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5">{item.area}</td>
                                            <td className="px-4 py-3.5">{item.booth_code || item.booth_id || "-"}</td>
                                            <td className="px-5 py-3.5">
                                                <span
                                                    className={cx(
                                                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                        isForce
                                                            ? "bg-orange-50/80 text-orange-700 ring-1 ring-orange-200/60"
                                                            : "bg-purple-50/80 text-purple-700 ring-1 ring-purple-200/60"
                                                    )}
                                                >
                                                    {isForce ? (
                                                        <AlertTriangle className="h-3 w-3" />
                                                    ) : (
                                                        <UserX className="h-3 w-3" />
                                                    )}
                                                    {item.reaseon_for_deny}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!loading && humanForce.length === 0 && (
                                    <tr>
                                        <td className="px-5 py-10 text-center text-ink-subtle" colSpan={4}>
                                            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/30">
                                                <AlertTriangle className="h-5 w-5 text-ink-subtle" />
                                            </div>
                                            No FORCE CANCEL or HUMAN ERROR denied tickets stored for this date.
                                        </td>
                                    </tr>
                                )}
                                {loading && (
                                    <tr>
                                        <td className="px-5 py-10 text-center text-ink-subtle" colSpan={4}>
                                            Loading denied ticket reasons…
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}
