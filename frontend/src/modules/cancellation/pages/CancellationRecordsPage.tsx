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
    CalendarRange,
    ArrowUpRight,
    ArrowDownRight,
    Sparkles,
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
        <div className="rounded-2xl border border-white/20 bg-white/30 p-5 shadow-sm backdrop-blur-sm">
            <Skeleton className="mb-3 h-4 w-20" />
            <Skeleton className="mb-2 h-8 w-16" />
            <Skeleton className="h-1.5 w-full" />
        </div>
    );
}

function AreaCardSkeleton() {
    return (
        <div className="rounded-2xl border border-white/20 bg-white/30 p-5 shadow-sm backdrop-blur-sm">
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                ))}
            </div>
        </div>
    );
}

/* ---------- Animated counter ---------- */
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        let start = display;
        const diff = value - start;
        if (diff === 0) return;
        const duration = 600;
        const startTime = performance.now();
        function tick(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(start + diff * eased));
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);
    return <span className={className}>{display.toLocaleString()}</span>;
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
            <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/40 via-white/20 to-white/5 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 sm:p-8 hover:shadow-2xl">
                {/* Decorative gradient blobs */}
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-teal/15 to-teal-light/5 blur-3xl transition-all duration-700 group-hover:scale-110" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-gradient-to-br from-teal-light/10 to-warm/20 blur-3xl transition-all duration-700 group-hover:scale-110" />
                <div className="pointer-events-none absolute right-1/3 top-1/4 h-20 w-20 rounded-full bg-emerald-500/5 blur-2xl" />

                {/* Subtle grid pattern overlay */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                        backgroundSize: "24px 24px",
                    }}
                />

                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal via-teal-light to-teal text-white shadow-lg shadow-teal/30 ring-1 ring-white/20 transition-all duration-300 group-hover:shadow-teal/40 group-hover:scale-105">
                            <List className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-ink sm:text-3xl">
                                {date ? formatDisplayDate(date) : formatDisplayDate(new Date().toISOString().split("T")[0])}
                            </h1>
                            <p className="mt-1 flex items-center gap-2 text-xs text-ink-muted/80">
                                <span className="inline-flex items-center gap-1">
                                    <CalendarRange className="h-3.5 w-3.5" />
                                    Cancellation Records
                                </span>
                                <span className="h-1 w-1 rounded-full bg-ink-muted/30" />
                                {syncing && !manualSyncing && (
                                    <>
                                        <span className="relative flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
                                        </span>
                                        Auto-syncing…
                                    </>
                                )}
                                {lastSynced && !syncing && (
                                    <span className="inline-flex items-center gap-1">
                                        <RefreshCw className="h-3 w-3" />
                                        Synced {formatTime(lastSynced)}
                                    </span>
                                )}
                                {!lastSynced && !syncing && "Not synced yet"}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="group/input relative">
                            <input
                                type="date"
                                value={date}
                                onChange={(event) => setDate(event.target.value)}
                                className="h-11 rounded-2xl border border-white/30 bg-white/50 pl-4 pr-4 text-sm text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-teal/50 focus:bg-white/70 focus:ring-2 focus:ring-teal/20 hover:border-white/50"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => doSync(true)}
                            disabled={syncing}
                            className="group/btn inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-2xl bg-gradient-to-br from-teal via-teal-light to-teal px-5 text-sm font-semibold text-white shadow-lg shadow-teal/25 ring-1 ring-white/20 transition-all duration-200 hover:from-teal-dark hover:via-teal hover:to-teal-dark hover:shadow-teal/40 hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-teal/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100"
                        >
                            <RefreshCw className={`h-4 w-4 transition-transform duration-500 ${syncing ? "animate-spin" : "group-hover/btn:rotate-180"}`} />
                            {syncing ? "Syncing…" : "Sync Sheet"}
                        </button>
                    </div>
                </div>
            </div>

            {/* ─────────────── Message Banner ─────────────── */}
            {(message || error) && (
                <div
                    className={cx(
                        "animate-[slideDown_0.4s_cubic-bezier(0.16,1,0.3,1)] rounded-2xl border px-5 py-3.5 text-sm font-medium shadow-lg backdrop-blur-md",
                        error
                            ? "border-rose/30 bg-gradient-to-r from-rose/10 to-rose/5 text-rose-dark ring-1 ring-rose/20"
                            : "border-emerald-200/40 bg-gradient-to-r from-emerald-50/80 to-emerald-50/40 text-emerald-700 ring-1 ring-emerald-200/30"
                    )}
                >
                    <span className="inline-flex items-center gap-2.5">
                        <span
                            className={cx(
                                "flex h-7 w-7 items-center justify-center rounded-full",
                                error ? "bg-rose/15" : "bg-emerald-100/80"
                            )}
                        >
                            {error ? (
                                <XCircle className="h-4 w-4 shrink-0" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            )}
                        </span>
                        <span>{error || message}</span>
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
                    <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/40 via-white/20 to-white/5 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 sm:p-7 hover:shadow-2xl">
                        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/5 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-amber-500/5 blur-3xl" />
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.02]"
                            style={{
                                backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                                backgroundSize: "20px 20px",
                            }}
                        />

                        <div className="relative">
                            <div className="mb-5 flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal/10 to-teal-light/10 ring-1 ring-teal/20">
                                    <TrendingUp className="h-4 w-4 text-teal" />
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70">
                                    Overall Total
                                </span>
                                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/40 px-3 py-1 text-[11px] font-semibold text-ink-muted ring-1 ring-white/30">
                                    <Sparkles className="h-3 w-3 text-teal" />
                                    <AnimatedNumber value={grandTotal} /> cancellation{grandTotal === 1 ? "" : "s"}
                                </span>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {/* Approved */}
                                <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-emerald-50/30 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:from-white/60 hover:to-emerald-50/40 hover:border-emerald-200/40 hover:-translate-y-0.5">
                                    <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-400/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                                    <div className="relative">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">Approved</span>
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-400/5 ring-1 ring-emerald-400/20 transition-all duration-300 group-hover/card:scale-110 group-hover/card:shadow-lg group-hover/card:shadow-emerald-400/20">
                                                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                                            </div>
                                        </div>
                                        <AnimatedNumber
                                            value={totals.approved}
                                            className="mt-2.5 text-2xl font-bold tracking-tight text-emerald-600"
                                        />
                                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100/60">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all duration-1000 ease-out"
                                                style={{
                                                    width: grandTotal > 0 ? `${(totals.approved / grandTotal) * 100}%` : "0%",
                                                }}
                                            />
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-500/70">
                                            <ArrowUpRight className="h-3 w-3" />
                                            {(grandTotal > 0 ? ((totals.approved / grandTotal) * 100) : 0).toFixed(1)}% of total
                                        </div>
                                    </div>
                                </div>

                                {/* Denied */}
                                <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-red-50/30 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:from-white/60 hover:to-red-50/40 hover:border-red-200/40 hover:-translate-y-0.5">
                                    <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-red-400/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                                    <div className="relative">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">Denied</span>
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-400/20 to-red-400/5 ring-1 ring-red-400/20 transition-all duration-300 group-hover/card:scale-110 group-hover/card:shadow-lg group-hover/card:shadow-red-400/20">
                                                <XCircle className="h-4.5 w-4.5 text-red-400" />
                                            </div>
                                        </div>
                                        <AnimatedNumber
                                            value={totals.denied}
                                            className="mt-2.5 text-2xl font-bold tracking-tight text-red-600"
                                        />
                                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-red-100/60">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-300 transition-all duration-1000 ease-out"
                                                style={{
                                                    width: grandTotal > 0 ? `${(totals.denied / grandTotal) * 100}%` : "0%",
                                                }}
                                            />
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-500/70">
                                            <ArrowDownRight className="h-3 w-3" />
                                            {(grandTotal > 0 ? ((totals.denied / grandTotal) * 100) : 0).toFixed(1)}% of total
                                        </div>
                                    </div>
                                </div>

                                {/* Force Cancel */}
                                <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-orange-50/30 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:from-white/60 hover:to-orange-50/40 hover:border-orange-200/40 hover:-translate-y-0.5">
                                    <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-orange-400/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                                    <div className="relative">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">Force Cancel</span>
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400/20 to-orange-400/5 ring-1 ring-orange-400/20 transition-all duration-300 group-hover/card:scale-110 group-hover/card:shadow-lg group-hover/card:shadow-orange-400/20">
                                                <AlertTriangle className="h-4.5 w-4.5 text-orange-400" />
                                            </div>
                                        </div>
                                        <AnimatedNumber
                                            value={humanForceCounts.force}
                                            className="mt-2.5 text-2xl font-bold tracking-tight text-orange-600"
                                        />
                                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-orange-100/60">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-300 transition-all duration-1000 ease-out"
                                                style={{
                                                    width: grandTroubleTotal > 0 ? `${(humanForceCounts.force / grandTroubleTotal) * 100}%` : "0%",
                                                }}
                                            />
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-orange-500/70">
                                            <ArrowUpRight className="h-3 w-3" />
                                            {(grandTroubleTotal > 0 ? ((humanForceCounts.force / grandTroubleTotal) * 100) : 0).toFixed(1)}% of trouble
                                        </div>
                                    </div>
                                </div>

                                {/* Human Error */}
                                <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-purple-50/30 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:from-white/60 hover:to-purple-50/40 hover:border-purple-200/40 hover:-translate-y-0.5">
                                    <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-purple-400/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                                    <div className="relative">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">Human Error</span>
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400/20 to-purple-400/5 ring-1 ring-purple-400/20 transition-all duration-300 group-hover/card:scale-110 group-hover/card:shadow-lg group-hover/card:shadow-purple-400/20">
                                                <UserX className="h-4.5 w-4.5 text-purple-400" />
                                            </div>
                                        </div>
                                        <AnimatedNumber
                                            value={humanForceCounts.human}
                                            className="mt-2.5 text-2xl font-bold tracking-tight text-purple-600"
                                        />
                                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-purple-100/60">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-300 transition-all duration-1000 ease-out"
                                                style={{
                                                    width: grandTroubleTotal > 0 ? `${(humanForceCounts.human / grandTroubleTotal) * 100}%` : "0%",
                                                }}
                                            />
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-purple-500/70">
                                            <ArrowDownRight className="h-3 w-3" />
                                            {(grandTroubleTotal > 0 ? ((humanForceCounts.human / grandTroubleTotal) * 100) : 0).toFixed(1)}% of trouble
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* ─────────────── Area Overview Cards ─────────────── */}
            <section>
                <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/40 via-white/20 to-white/5 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 sm:p-7 hover:shadow-2xl">
                    <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-teal/5 blur-3xl transition-all duration-700 group-hover:scale-110" />
                    <div className="pointer-events-none absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-amber-500/5 blur-3xl transition-all duration-700 group-hover:scale-110" />
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.02]"
                        style={{
                            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                            backgroundSize: "20px 20px",
                        }}
                    />

                    <div className="relative">
                        <div className="mb-5 flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal/10 to-teal-light/10 ring-1 ring-teal/20">
                                <Building2 className="h-4 w-4 text-teal" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70">
                                Area Overview
                            </span>
                            {!loading && (
                                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/40 px-3 py-1 text-[11px] font-semibold text-ink-muted ring-1 ring-white/30">
                                    {areaOverview.length} area{areaOverview.length === 1 ? "" : "s"}
                                </span>
                            )}
                        </div>

                        {loading ? (
                            <div className="grid gap-6 sm:grid-cols-2">
                                <AreaCardSkeleton />
                                <AreaCardSkeleton />
                            </div>
                        ) : areaOverview.length > 0 ? (
                            <div className="grid gap-6 sm:grid-cols-2">
                                {areaOverview.map((area, idx) => {
                                    const areaTotal = area.approved + area.denied + area.force_cancel + area.human_error;
                                    const isCdo = area.area.toUpperCase() === "CDO";
                                    return (
                                        <div
                                            key={area.area}
                                            className="group/card overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-white/30 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                                            style={{
                                                animationDelay: `${idx * 80}ms`,
                                            }}
                                        >
                                            {/* Card header */}
                                            <div
                                                className={cx(
                                                    "flex items-center justify-between px-5 py-4 transition-colors duration-300",
                                                    isCdo ? "bg-gradient-to-r from-teal/5 to-teal/10" : "bg-gradient-to-r from-warm/20 to-warm/5"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div
                                                        className={cx(
                                                            "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 group-hover/card:scale-110",
                                                            isCdo
                                                                ? "bg-teal/10 text-teal ring-1 ring-teal/20"
                                                                : "bg-warm/30 text-ink-muted ring-1 ring-warm/40"
                                                        )}
                                                    >
                                                        <Building2 className="h-4 w-4" />
                                                    </div>
                                                    <h3 className="text-sm font-bold text-ink">{area.area}</h3>
                                                </div>
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/50 px-2.5 py-1 text-[11px] font-semibold text-ink-muted ring-1 ring-white/30">
                                                    <Sparkles className="h-3 w-3 text-teal/60" />
                                                    {areaTotal}
                                                </span>
                                            </div>

                                            {/* Metrics grid */}
                                            <div className="grid grid-cols-4 divide-x divide-white/20">
                                                <div className="relative p-3.5 text-center transition-all duration-200 hover:bg-emerald-50/30">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                                        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted/60">Appr.</span>
                                                    </div>
                                                    <AnimatedNumber
                                                        value={area.approved}
                                                        className="mt-1.5 text-lg font-bold text-emerald-600"
                                                    />
                                                </div>
                                                <div className="relative p-3.5 text-center transition-all duration-200 hover:bg-red-50/30">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <XCircle className="h-3 w-3 text-red-400" />
                                                        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted/60">Denied</span>
                                                    </div>
                                                    <AnimatedNumber
                                                        value={area.denied}
                                                        className="mt-1.5 text-lg font-bold text-red-600"
                                                    />
                                                </div>
                                                <div className="relative p-3.5 text-center transition-all duration-200 hover:bg-orange-50/30">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <AlertTriangle className="h-3 w-3 text-orange-400" />
                                                        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted/60">Force</span>
                                                    </div>
                                                    <AnimatedNumber
                                                        value={area.force_cancel}
                                                        className="mt-1.5 text-lg font-bold text-orange-600"
                                                    />
                                                </div>
                                                <div className="relative p-3.5 text-center transition-all duration-200 hover:bg-purple-50/30">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <UserX className="h-3 w-3 text-purple-400" />
                                                        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted/60">Human</span>
                                                    </div>
                                                    <AnimatedNumber
                                                        value={area.human_error}
                                                        className="mt-1.5 text-lg font-bold text-purple-600"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/30 bg-white/30 p-10 shadow-sm backdrop-blur-sm">
                                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal/10 to-teal-light/10 ring-1 ring-teal/20">
                                    <AreaChart className="h-7 w-7 text-teal/60" />
                                </div>
                                <p className="text-sm font-medium text-ink-muted">No data available for this date.</p>
                                <p className="mt-1 text-xs text-ink-subtle/60">Select a different date or sync the sheet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ─────────────── Force Cancel / Human Error Table ─────────────── */}
            <section>
                <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/40 via-white/20 to-white/5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:shadow-2xl">
                    <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-orange-500/5 blur-3xl transition-all duration-700 group-hover:scale-110" />
                    <div className="pointer-events-none absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-purple-500/5 blur-3xl transition-all duration-700 group-hover:scale-110" />
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.02]"
                        style={{
                            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                            backgroundSize: "20px 20px",
                        }}
                    />

                    <div className="relative px-6 pt-6 sm:px-7 sm:pt-7">
                        <div className="mb-4 flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/10 to-purple-500/10 ring-1 ring-orange-500/20">
                                <AlertTriangle className="h-4 w-4 text-orange-500/70" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70">
                                Force Cancel / Human Error
                            </span>
                            {!loading && (
                                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/40 px-3 py-1 text-[11px] font-semibold text-ink-muted ring-1 ring-white/30">
                                    <Ticket className="h-3 w-3 text-teal/60" />
                                    <AnimatedNumber value={humanForce.length} /> record{humanForce.length === 1 ? "" : "s"}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto px-0 pb-0">
                        <table className="min-w-full text-left text-xs">
                            <thead>
                                <tr className="border-y border-white/20 bg-gradient-to-r from-white/30 to-white/10">
                                    <th className="px-6 py-4 font-bold uppercase tracking-[0.1em] text-ink-muted/70">Ticket Number</th>
                                    <th className="px-4 py-4 font-bold uppercase tracking-[0.1em] text-ink-muted/70">Area</th>
                                    <th className="px-4 py-4 font-bold uppercase tracking-[0.1em] text-ink-muted/70">Booth</th>
                                    <th className="px-6 py-4 font-bold uppercase tracking-[0.1em] text-ink-muted/70">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/15 text-ink">
                                {humanForce.map((item, idx) => {
                                    const reason = (item.reaseon_for_deny || "").toUpperCase();
                                    const isForce = reason.includes("FORCE CANCEL");
                                    return (
                                        <tr
                                            key={item.id}
                                            className={cx(
                                                "transition-all duration-200",
                                                idx % 2 === 0 ? "bg-white/20" : "bg-white/5",
                                                "hover:bg-teal/5 hover:backdrop-blur-sm"
                                            )}
                                            style={{
                                                animation: `fadeIn 0.3s ease-out ${idx * 30}ms both`,
                                            }}
                                        >
                                            <td className="px-6 py-4 font-medium text-ink">
                                                <span className="inline-flex items-center gap-2">
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/40 ring-1 ring-white/30">
                                                        <Ticket className="h-3 w-3 text-ink-subtle" />
                                                    </span>
                                                    {item.ticket_number || "-"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={cx(
                                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                                    item.area?.toUpperCase() === "CDO"
                                                        ? "bg-teal/10 text-teal-dark ring-1 ring-teal/20"
                                                        : "bg-warm/30 text-ink-muted ring-1 ring-warm/40"
                                                )}>
                                                    {item.area}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 font-medium">{item.booth_code || item.booth_id || "-"}</td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={cx(
                                                        "inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-medium shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
                                                        isForce
                                                            ? "bg-gradient-to-r from-orange-50/90 to-orange-50/50 text-orange-700 ring-1 ring-orange-200/50"
                                                            : "bg-gradient-to-r from-purple-50/90 to-purple-50/50 text-purple-700 ring-1 ring-purple-200/50"
                                                    )}
                                                >
                                                    <span
                                                        className={cx(
                                                            "flex h-5 w-5 items-center justify-center rounded-full",
                                                            isForce ? "bg-orange-100/80" : "bg-purple-100/80"
                                                        )}
                                                    >
                                                        {isForce ? (
                                                            <AlertTriangle className="h-3 w-3" />
                                                        ) : (
                                                            <UserX className="h-3 w-3" />
                                                        )}
                                                    </span>
                                                    {item.reaseon_for_deny}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!loading && humanForce.length === 0 && (
                                    <tr>
                                        <td className="px-6 py-12 text-center text-ink-subtle" colSpan={4}>
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/30 ring-1 ring-white/20">
                                                    <AlertTriangle className="h-6 w-6 text-ink-subtle/50" />
                                                </div>
                                                <p className="text-sm font-medium text-ink-muted/70">
                                                    No FORCE CANCEL or HUMAN ERROR tickets for this date.
                                                </p>
                                                <p className="mt-1 text-xs text-ink-subtle/50">
                                                    All clear! No denied tickets with these reasons stored.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {loading && (
                                    <tr>
                                        <td className="px-6 py-12 text-center text-ink-subtle" colSpan={4}>
                                            <div className="flex items-center justify-center gap-2">
                                                <RefreshCw className="h-4 w-4 animate-spin text-teal" />
                                                <span className="text-sm text-ink-muted/70">Loading ticket reasons…</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Inject keyframe for fadeIn */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}