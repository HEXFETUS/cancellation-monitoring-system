import { useEffect, useMemo, useRef, useState } from "react";
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    UserX,
    AreaChart,
    Ticket,
    Building2,
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
                "animate-pulse rounded-md bg-gradient-to-r from-warm/40 via-warm/60 to-warm/40 bg-[length:200%_100%]",
                className
            )}
        />
    );
}

function StatCardSkeleton() {
    return (
        <div className="rounded-xl border border-warm bg-white p-5">
            <Skeleton className="mb-3 h-4 w-20" />
            <Skeleton className="h-8 w-16" />
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
    const todayStr = new Date().toISOString().split("T")[0];
    const isManualSync = useRef(false);

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
        isManualSync.current = manual;
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

    /* ---------- stat card config ---------- */
    const statCards = [
        {
            label: "Approved",
            value: totals.approved,
            icon: CheckCircle2,
            valueClass: "text-emerald-600",
            iconClass: "text-emerald-400",
            bgClass: "bg-emerald-50/60",
        },
        {
            label: "Denied",
            value: totals.denied,
            icon: XCircle,
            valueClass: "text-red-600",
            iconClass: "text-red-400",
            bgClass: "bg-red-50/60",
        },
        {
            label: "Force Cancel",
            value: humanForceCounts.force,
            icon: AlertTriangle,
            valueClass: "text-orange-600",
            iconClass: "text-orange-400",
            bgClass: "bg-orange-50/60",
        },
        {
            label: "Human Error",
            value: humanForceCounts.human,
            icon: UserX,
            valueClass: "text-purple-600",
            iconClass: "text-purple-400",
            bgClass: "bg-purple-50/60",
        },
    ];

    /* ---------- render ---------- */
    return (
        <div className="space-y-6">
            {/* ─────────────── Header ─────────────── */}
            <div className="flex flex-col gap-4 border-b border-warm pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-ink">
                        {date ? formatDisplayDate(date) : formatDisplayDate(new Date().toISOString().split("T")[0])}
                    </h1>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                        {syncing && !isManualSync.current && (
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
                            </span>
                        )}
                        {lastSynced ? `Last synced: ${formatTime(lastSynced)}` : "Not synced yet"}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <input
                            type="date"
                            value={date}
                            onChange={(event) => setDate(event.target.value)}
                            className="h-10 rounded-lg border border-warm bg-white pl-3 pr-3 text-sm text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => doSync(true)}
                        disabled={syncing}
                        className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-teal px-4 text-sm font-medium text-white shadow-sm transition hover:bg-teal-dark focus:ring-2 focus:ring-teal/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Syncing…" : "Sync Sheet"}
                    </button>
                </div>
            </div>

            {/* ─────────────── Message Banner ─────────────── */}
            {(message || error) && (
                <div
                    className={cx(
                        "animate-[slideDown_0.3s_ease-out] rounded-xl border px-4 py-3 text-sm font-medium shadow-xs",
                        error
                            ? "border-rose/30 bg-rose/10 text-rose-dark"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
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

            {/* ─────────────── Grand Totals Cards ─────────────── */}
            <section>
                <div className="mb-3 flex items-center gap-2">
                    <AreaChart className="h-5 w-5 text-teal" />
                    <h2 className="text-base font-semibold text-ink">Overall Total</h2>
                </div>
                {loading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {statCards.map((card) => (
                            <div
                                key={card.label}
                                className="group rounded-xl border border-warm bg-white p-5 shadow-xs transition hover:shadow-md"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-ink-muted">{card.label}</span>
                                    <div className={cx("flex h-9 w-9 items-center justify-center rounded-lg", card.bgClass)}>
                                        <card.icon className={cx("h-5 w-5", card.iconClass)} />
                                    </div>
                                </div>
                                <div className={cx("mt-3 text-3xl font-bold tracking-tight", card.valueClass)}>
                                    {card.value}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ─────────────── Per-Area Overview Cards ─────────────── */}
            <section>
                <div className="mb-3 flex items-center gap-2">
                    <AreaChart className="h-5 w-5 text-teal" />
                    <h2 className="text-base font-semibold text-ink">Area Overview</h2>
                </div>
                {loading ? (
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="rounded-xl border border-warm bg-white p-6">
                            <Skeleton className="mb-3 h-5 w-32" />
                            <Skeleton className="mb-4 h-3 w-24" />
                            <div className="grid grid-cols-2 gap-3">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Skeleton key={i} className="h-16" />
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border border-warm bg-white p-6">
                            <Skeleton className="mb-3 h-5 w-32" />
                            <Skeleton className="mb-4 h-3 w-24" />
                            <div className="grid grid-cols-2 gap-3">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Skeleton key={i} className="h-16" />
                                ))}
                            </div>
                        </div>
                    </div>
                ) : areaOverview.length > 0 ? (
                    <div className="grid gap-6 sm:grid-cols-2">
                        {areaOverview.map((area) => {
                            /* pick a subtle accent colour per area */
                            const accent = area.area.toUpperCase() === "CDO" ? "teal" : "warm";
                            return (
                                <div
                                    key={area.area}
                                    className="group overflow-hidden rounded-xl border border-warm bg-white shadow-xs transition hover:shadow-md"
                                >
                                    {/* Card header */}
                                    <div
                                        className={cx(
                                            "flex items-center justify-between px-5 py-3.5",
                                            accent === "teal" ? "bg-teal/10" : "bg-warm/30"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Building2
                                                className={cx(
                                                    "h-4 w-4",
                                                    accent === "teal" ? "text-teal" : "text-ink-muted"
                                                )}
                                            />
                                            <h3 className="text-sm font-semibold text-ink">{area.area}</h3>
                                        </div>
                                    </div>
                                    {/* Metrics grid */}
                                    <div className="grid grid-cols-2 gap-px bg-warm">
                                        <div className="bg-white p-4">
                                            <div className="flex items-center gap-1.5">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                                <span className="text-xs text-ink-muted">Approved</span>
                                            </div>
                                            <div className="mt-1 text-xl font-bold text-emerald-600">
                                                {area.approved}
                                            </div>
                                        </div>
                                        <div className="bg-white p-4">
                                            <div className="flex items-center gap-1.5">
                                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                                                <span className="text-xs text-ink-muted">Denied</span>
                                            </div>
                                            <div className="mt-1 text-xl font-bold text-red-600">{area.denied}</div>
                                        </div>
                                        <div className="bg-white p-4">
                                            <div className="flex items-center gap-1.5">
                                                <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                                                <span className="text-xs text-ink-muted">Force Cancel</span>
                                            </div>
                                            <div className="mt-1 text-xl font-bold text-orange-600">
                                                {area.force_cancel}
                                            </div>
                                        </div>
                                        <div className="bg-white p-4">
                                            <div className="flex items-center gap-1.5">
                                                <UserX className="h-3.5 w-3.5 text-purple-400" />
                                                <span className="text-xs text-ink-muted">Human Error</span>
                                            </div>
                                            <div className="mt-1 text-xl font-bold text-purple-600">
                                                {area.human_error}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-xl border border-warm bg-white p-8 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warm/60">
                            <AreaChart className="h-6 w-6 text-ink-muted" />
                        </div>
                        <p className="text-sm text-ink-muted">No data available for this date.</p>
                    </div>
                )}
            </section>

            {/* ─────────────── Force Cancel / Human Error Table ─────────────── */}
            <section>
                <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-teal" />
                    <h2 className="text-base font-semibold text-ink">Force Cancel / Human Error</h2>
                </div>
                <div className="overflow-hidden rounded-xl border border-warm bg-white shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-warm bg-warm/30">
                                    <th className="px-4 py-3 font-semibold text-ink">Ticket Number</th>
                                    <th className="px-4 py-3 font-semibold text-ink">Area</th>
                                    <th className="px-4 py-3 font-semibold text-ink">Booth</th>
                                    <th className="px-4 py-3 font-semibold text-ink">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-warm/60 text-ink">
                                {humanForce.map((item, idx) => {
                                    const reason = (item.reaseon_for_deny || "").toUpperCase();
                                    const isForce = reason.includes("FORCE CANCEL");
                                    return (
                                        <tr
                                            key={item.id}
                                            className={cx(
                                                "transition hover:bg-teal/5",
                                                idx % 2 === 0 ? "bg-white" : "bg-warm/10"
                                            )}
                                        >
                                            <td className="px-4 py-3 font-medium text-ink">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Ticket className="h-3 w-3 text-ink-subtle" />
                                                    {item.ticket_number || "-"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">{item.area}</td>
                                            <td className="px-4 py-3">{item.booth_code || item.booth_id || "-"}</td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={cx(
                                                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                        isForce
                                                            ? "bg-orange-50 text-orange-700 ring-1 ring-orange-200"
                                                            : "bg-purple-50 text-purple-700 ring-1 ring-purple-200"
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
                                        <td
                                            className="px-4 py-8 text-center text-ink-subtle"
                                            colSpan={4}
                                        >
                                            No FORCE CANCEL or HUMAN ERROR denied tickets stored for this date.
                                        </td>
                                    </tr>
                                )}
                                {loading && (
                                    <tr>
                                        <td className="px-4 py-8 text-center text-ink-subtle" colSpan={4}>
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