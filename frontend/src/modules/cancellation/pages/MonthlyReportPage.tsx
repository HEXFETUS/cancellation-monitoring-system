import { useEffect, useMemo, useState } from "react";
import {
    CalendarDays,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    UserX,
    X,
    TrendingUp,
    Building2,
} from "lucide-react";
import { fetchMonthlyHumanErrorBooths, fetchMonthlySummary } from "../services";
import type { CancellationHumanErrorBooth } from "../types";

/* ---------- helpers ---------- */
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function cx(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(" ");
}

/* ---------- types ---------- */
type DayData = {
    day: number;
    approved: number;
    denied: number;
    force_cancel: number;
    human_error: number;
    areas?: AreaData[];
};

type AreaData = {
    area: string;
    approved: number;
    denied: number;
    force_cancel: number;
    human_error: number;
};

/* ---------- sub-components ---------- */
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

function CalendarSkeleton() {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/25 p-6 shadow-lg backdrop-blur-xl">
            <div className="mb-3 grid grid-cols-7 gap-1.5">
                {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 rounded" />
                ))}
            </div>
            {Array.from({ length: 5 }).map((_, row) => (
                <div key={row} className="mb-1.5 grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 7 }).map((_, col) => (
                        <Skeleton key={col} className="h-28 rounded-xl" />
                    ))}
                </div>
            ))}
        </div>
    );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-warm/30">
            <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
            />
        </div>
    );
}

type CellProps = {
    day: number | null;
    data?: DayData;
    isToday: boolean;
    onSelect?: (data: DayData) => void;
};

function getTotal(data?: Pick<DayData, "approved" | "denied" | "force_cancel" | "human_error">) {
    if (!data) return 0;
    return data.approved + data.denied + data.force_cancel + data.human_error;
}

function CalendarCell({ day, data, isToday, onSelect }: CellProps) {
    if (day === null) {
        return <div className="min-h-[7rem] rounded-xl bg-warm/5" />;
    }

    const total = getTotal(data);
    const hasData = total > 0;
    const maxVal = data ? Math.max(data.approved, data.denied, data.force_cancel, data.human_error, 1) : 1;

    return (
        <button
            type="button"
            onClick={() => data && onSelect?.(data)}
            disabled={!data}
            className={cx(
                "group relative min-h-[7rem] rounded-xl border p-2.5 text-left text-xs transition-all duration-200",
                "hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
                data && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal/40",
                !data && "cursor-default opacity-50",
                isToday
                    ? "border-teal bg-gradient-to-br from-teal/5 to-teal/10 ring-2 ring-teal/30 shadow-sm"
                    : hasData
                        ? "border-white/60 bg-white/40 backdrop-blur-sm shadow-sm"
                        : "border-white/30 bg-white/20"
            )}
        >
            {/* Day number */}
            <div
                className={cx(
                    "mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                    isToday
                        ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-md shadow-teal/30"
                        : hasData
                            ? "bg-warm/30 text-ink group-hover:bg-teal/20 group-hover:text-teal-dark"
                            : "text-ink-subtle/50"
                )}
            >
                {day}
            </div>

            {/* Daily category badges */}
            {data && hasData && (
                <div className="space-y-1.5">
                    <Bar value={data.approved} max={maxVal} color="#92C7CF" />
                    <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                            <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                            {data.approved}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-500">
                            <XCircle className="h-2.5 w-2.5 shrink-0" />
                            {data.denied}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-orange-500">
                            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                            {data.force_cancel}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-purple-500">
                            <UserX className="h-2.5 w-2.5 shrink-0" />
                            {data.human_error}
                        </span>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {(!data || !hasData) && (
                <div className="mt-2 text-center text-[10px] text-ink-subtle/30">No data</div>
            )}
        </button>
    );
}

function AreaBreakdownModal({
    dayData,
    month,
    year,
    onClose,
}: {
    dayData: DayData;
    month: number;
    year: number;
    onClose: () => void;
}) {
    const dateLabel = `${MONTH_NAMES[month - 1]} ${dayData.day}, ${year}`;
    const areas = dayData.areas ?? [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/30 px-4 py-6 backdrop-blur-sm">
            <div className="max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/50 bg-white/80 shadow-2xl backdrop-blur-2xl animate-[slideDown_0.25s_ease-out]">
                <div className="flex items-center justify-between border-b border-white/40 px-6 py-5">
                    <div>
                        <h2 className="text-lg font-bold text-ink">{dateLabel}</h2>
                        <p className="mt-0.5 text-xs text-ink-muted">Area breakdown</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition hover:bg-rose/10 hover:text-rose-dark"
                        title="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="max-h-[calc(100vh-11rem)] overflow-auto p-6">
                    {areas.length > 0 ? (
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/30 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                    <th className="px-3 py-2.5">Area</th>
                                    <th className="px-3 py-2.5 text-right">Approved</th>
                                    <th className="px-3 py-2.5 text-right">Denied</th>
                                    <th className="px-3 py-2.5 text-right">Force Cancel</th>
                                    <th className="px-3 py-2.5 text-right">Human Error</th>
                                    <th className="px-3 py-2.5 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/20">
                                {areas.map((area) => (
                                    <tr key={area.area} className="transition hover:bg-teal/5">
                                        <td className="px-3 py-3.5 font-semibold text-ink">{area.area}</td>
                                        <td className="px-3 py-3.5 text-right font-medium text-emerald-600">{area.approved}</td>
                                        <td className="px-3 py-3.5 text-right font-medium text-red-500">{area.denied}</td>
                                        <td className="px-3 py-3.5 text-right font-medium text-orange-500">{area.force_cancel}</td>
                                        <td className="px-3 py-3.5 text-right font-medium text-purple-500">{area.human_error}</td>
                                        <td className="px-3 py-3.5 text-right font-bold text-ink">
                                            {area.approved + area.denied}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="rounded-xl border border-white/30 bg-white/20 px-4 py-10 text-center text-sm text-ink-muted">
                            No area totals available for this date.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ---------- main component ---------- */
export default function MonthlyReportPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
    const [data, setData] = useState<DayData[]>([]);
    const [humanErrorBooths, setHumanErrorBooths] = useState<CancellationHumanErrorBooth[]>([]);
    const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    /* Fetch data on mount & when year/month changes */
    useEffect(() => {
        let ignore = false;

        async function load() {
            setLoading(true);
            setError("");
            try {
                const [result, boothRows] = await Promise.all([
                    fetchMonthlySummary(year, month),
                    fetchMonthlyHumanErrorBooths(year, month),
                ]);
                if (!ignore) {
                    setData(result.daily);
                    setHumanErrorBooths(boothRows);
                }
            } catch (err) {
                if (!ignore) {
                    setError(err instanceof Error ? err.message : "Unable to load monthly report");
                    setData([]);
                    setHumanErrorBooths([]);
                }
            } finally {
                if (!ignore) setLoading(false);
            }
        }

        load();
        return () => {
            ignore = true;
        };
    }, [year, month]);

    /* Calendar grid computation */
    const calendarGrid = useMemo(() => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

        const dataByDay = new Map<number, DayData>();
        for (const d of data) {
            dataByDay.set(d.day, d);
        }

        const grid: (number | null)[][] = [];
        let currentRow: (number | null)[] = [];

        for (let i = 0; i < firstDayOfWeek; i++) {
            currentRow.push(null);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            currentRow.push(day);
            if (currentRow.length === 7) {
                grid.push(currentRow);
                currentRow = [];
            }
        }

        if (currentRow.length > 0) {
            while (currentRow.length < 7) {
                currentRow.push(null);
            }
            grid.push(currentRow);
        }

        return { grid, daysInMonth, firstDayOfWeek, dataByDay };
    }, [year, month, data]);

    const todayStr = new Date().toISOString().split("T")[0];

    /* Totals */
    const totals = useMemo(
        () =>
            data.reduce(
                (acc, d) => ({
                    approved: acc.approved + d.approved,
                    denied: acc.denied + d.denied,
                    force_cancel: acc.force_cancel + d.force_cancel,
                    human_error: acc.human_error + d.human_error,
                }),
                { approved: 0, denied: 0, force_cancel: 0, human_error: 0 }
            ),
        [data]
    );

    const grandTotal = totals.approved + totals.denied + totals.force_cancel + totals.human_error;

    const topHumanErrorBoothsByArea = useMemo(() => {
        const sorted = [...humanErrorBooths].sort((a, b) => {
            const totalDiff = b.human_error - a.human_error;
            return totalDiff || a.booth_code.localeCompare(b.booth_code, undefined, { numeric: true });
        });

        return {
            cdo: sorted.filter((b) => b.area.toUpperCase() === "CDO").slice(0, 10),
            misor: sorted.filter((b) => b.area.toUpperCase() === "MISOR").slice(0, 10),
        };
    }, [humanErrorBooths]);

    const monthFilterValue = `${year}-${String(month).padStart(2, "0")}`;

    function handleMonthFilterChange(value: string) {
        const [nextYear, nextMonth] = value.split("-").map(Number);
        if (!nextYear || !nextMonth) return;
        setYear(nextYear);
        setMonth(nextMonth);
    }

    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
                            <CalendarDays className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-ink">
                                {MONTH_NAMES[month - 1]} {year}
                            </h1>
                            <p className="mt-0.5 text-xs text-ink-muted">
                                Monthly Cancellation Summary
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="month"
                            value={monthFilterValue}
                            onChange={(event) => handleMonthFilterChange(event.target.value)}
                            className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-white/40 bg-white/40 px-3 text-xs font-semibold text-ink-muted shadow-sm backdrop-blur-sm transition hover:bg-white/70 hover:text-ink hover:shadow-md"
                        />
                    </div>
                </div>
            </div>

            {/* ─────────────── Error banner ─────────────── */}
            {error && (
                <div className="animate-[slideDown_0.3s_ease-out] rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm font-medium text-rose-dark shadow-sm backdrop-blur-sm">
                    <span className="inline-flex items-center gap-2">
                        <XCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </span>
                </div>
            )}

            {/* ─────────────── Grand Totals Bar ─────────────── */}
            {!loading && !error && data.length > 0 && (
                <section>
                    <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-br from-white/30 to-white/10 p-5 shadow-lg backdrop-blur-xl sm:p-6">
                        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/5 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-amber-500/5 blur-3xl" />

                        <div className="relative">
                            <div className="mb-4 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-ink-muted" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                    Month Summary
                                </span>
                                <span className="ml-auto text-xs text-ink-muted">
                                    Total: <strong className="text-ink">{grandTotal}</strong> cancellations
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="group rounded-xl border border-white/30 bg-white/40 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md hover:bg-white/60">
                                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                        Approved
                                    </div>
                                    <div className="mt-1 text-2xl font-bold text-emerald-600">
                                        {totals.approved}
                                    </div>
                                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-emerald-100">
                                        <div
                                            className="h-full rounded-full bg-emerald-400 transition-all"
                                            style={{
                                                width: grandTotal > 0 ? `${(totals.approved / grandTotal) * 100}%` : "0%",
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="group rounded-xl border border-white/30 bg-white/40 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md hover:bg-white/60">
                                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                                        Denied
                                    </div>
                                    <div className="mt-1 text-2xl font-bold text-red-500">
                                        {totals.denied}
                                    </div>
                                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-red-100">
                                        <div
                                            className="h-full rounded-full bg-red-400 transition-all"
                                            style={{
                                                width: grandTotal > 0 ? `${(totals.denied / grandTotal) * 100}%` : "0%",
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="group rounded-xl border border-white/30 bg-white/40 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md hover:bg-white/60">
                                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                                        <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                                        Force Cancel
                                    </div>
                                    <div className="mt-1 text-2xl font-bold text-orange-500">
                                        {totals.force_cancel}
                                    </div>
                                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-orange-100">
                                        <div
                                            className="h-full rounded-full bg-orange-400 transition-all"
                                            style={{
                                                width: grandTotal > 0 ? `${(totals.force_cancel / grandTotal) * 100}%` : "0%",
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="group rounded-xl border border-white/30 bg-white/40 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md hover:bg-white/60">
                                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                                        <UserX className="h-3.5 w-3.5 text-purple-400" />
                                        Human Error
                                    </div>
                                    <div className="mt-1 text-2xl font-bold text-purple-500">
                                        {totals.human_error}
                                    </div>
                                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-purple-100">
                                        <div
                                            className="h-full rounded-full bg-purple-400 transition-all"
                                            style={{
                                                width: grandTotal > 0 ? `${(totals.human_error / grandTotal) * 100}%` : "0%",
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ─────────────── Top Human Error Booths by Area ─────────────── */}
            {!error && (
                <section>
                    <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-br from-white/30 to-white/10 p-5 shadow-lg backdrop-blur-xl sm:p-6">
                        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-purple-500/5 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-teal/5 blur-3xl" />

                        <div className="relative">
                            <div className="mb-4 flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-ink-muted" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                    Top 10 Booths with Highest Human Error
                                </span>
                                {!loading && (
                                    <span className="ml-auto text-xs text-ink-muted">
                                        Total human errors: <strong className="text-ink">{totals.human_error}</strong>
                                    </span>
                                )}
                            </div>

                            {loading ? (
                                <div className="rounded-xl border border-white/30 bg-white/20 p-8 text-center shadow-sm backdrop-blur-sm">
                                    <p className="text-sm text-ink-muted">Loading booth data...</p>
                                </div>
                            ) : (
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <div className="rounded-xl border border-white/30 bg-white/40 shadow-sm backdrop-blur-sm">
                                        <div className="flex items-center justify-between bg-teal/5 px-5 py-3.5">
                                            <span className="text-sm font-bold text-teal-dark">CDO</span>
                                            <span className="text-xs text-ink-muted">
                                                <strong className="text-ink">{topHumanErrorBoothsByArea.cdo.length}</strong> booth{topHumanErrorBoothsByArea.cdo.length === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                        {topHumanErrorBoothsByArea.cdo.length > 0 ? (
                                            <table className="min-w-full text-left text-xs">
                                                <thead>
                                                    <tr className="border-y border-white/30 bg-white/20">
                                                        <th className="w-10 px-4 py-3 font-bold uppercase tracking-wider text-ink-muted">#</th>
                                                        <th className="px-3 py-3 font-bold uppercase tracking-wider text-ink-muted">Booth</th>
                                                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider text-ink-muted">Human Error</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/20 text-ink">
                                                    {topHumanErrorBoothsByArea.cdo.map((booth, idx) => (
                                                        <tr key={`${booth.area}-${booth.booth_code}`} className={cx("transition hover:bg-teal/5", idx % 2 === 0 ? "bg-white/30" : "bg-white/10")}>
                                                            <td className="px-4 py-2.5 font-bold text-ink-muted">{idx + 1}</td>
                                                            <td className="px-3 py-2.5 font-medium">{booth.booth_code}</td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-purple-50/80 px-2.5 py-0.5 text-sm font-bold text-purple-700 ring-1 ring-purple-200/60">
                                                                    {booth.human_error}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-6 text-center text-xs text-ink-muted">No CDO human error booth data</div>
                                        )}
                                    </div>

                                    <div className="rounded-xl border border-white/30 bg-white/40 shadow-sm backdrop-blur-sm">
                                        <div className="flex items-center justify-between bg-warm/20 px-5 py-3.5">
                                            <span className="text-sm font-bold text-ink">MISOR</span>
                                            <span className="text-xs text-ink-muted">
                                                <strong className="text-ink">{topHumanErrorBoothsByArea.misor.length}</strong> booth{topHumanErrorBoothsByArea.misor.length === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                        {topHumanErrorBoothsByArea.misor.length > 0 ? (
                                            <table className="min-w-full text-left text-xs">
                                                <thead>
                                                    <tr className="border-y border-white/30 bg-white/20">
                                                        <th className="w-10 px-4 py-3 font-bold uppercase tracking-wider text-ink-muted">#</th>
                                                        <th className="px-3 py-3 font-bold uppercase tracking-wider text-ink-muted">Booth</th>
                                                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider text-ink-muted">Human Error</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/20 text-ink">
                                                    {topHumanErrorBoothsByArea.misor.map((booth, idx) => (
                                                        <tr key={`${booth.area}-${booth.booth_code}`} className={cx("transition hover:bg-teal/5", idx % 2 === 0 ? "bg-white/30" : "bg-white/10")}>
                                                            <td className="px-4 py-2.5 font-bold text-ink-muted">{idx + 1}</td>
                                                            <td className="px-3 py-2.5 font-medium">{booth.booth_code}</td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-purple-50/80 px-2.5 py-0.5 text-sm font-bold text-purple-700 ring-1 ring-purple-200/60">
                                                                    {booth.human_error}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-6 text-center text-xs text-ink-muted">No MISOR human error booth data</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* ─────────────── Calendar ─────────────── */}
            <section>
                {loading ? (
                    <CalendarSkeleton />
                ) : (
                    <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-br from-white/30 to-white/10 shadow-lg backdrop-blur-xl">
                        {/* Day-of-week header */}
                        <div className="grid grid-cols-7 border-b border-white/30 bg-white/20">
                            {DAY_LABELS.map((label) => (
                                <div
                                    key={label}
                                    className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wide text-ink-muted"
                                >
                                    {label}
                                </div>
                            ))}
                        </div>

                        {/* Calendar grid */}
                        <div className="p-2.5">
                            {calendarGrid.grid.map((row, rowIdx) => (
                                <div key={rowIdx} className="mb-1.5 grid grid-cols-7 gap-1.5">
                                    {row.map((day, colIdx) => {
                                        const cellDate =
                                            day !== null
                                                ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                                                : null;
                                        const isToday = cellDate === todayStr;

                                        return (
                                            <CalendarCell
                                                key={`${rowIdx}-${colIdx}`}
                                                day={day}
                                                data={day !== null ? calendarGrid.dataByDay.get(day) : undefined}
                                                isToday={isToday}
                                                onSelect={setSelectedDay}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !error && calendarGrid.grid.length === 0 && (
                    <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/20 p-12 text-center shadow-lg backdrop-blur-xl">
                        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-teal/5 blur-3xl" />
                        <CalendarDays className="mx-auto mb-3 h-12 w-12 text-ink-subtle" />
                        <p className="text-sm text-ink-muted">No data available for this month.</p>
                    </div>
                )}
            </section>

            {/* ─────────────── Legend ─────────────── */}
            {!loading && !error && (
                <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/20 px-6 py-3.5 shadow-lg backdrop-blur-xl">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                        <span className="font-bold text-ink">Legend:</span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-400">
                                <CheckCircle2 className="h-2 w-2 text-white" />
                            </span>
                            Approved
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-red-400">
                                <XCircle className="h-2 w-2 text-white" />
                            </span>
                            Denied
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-orange-400">
                                <AlertTriangle className="h-2 w-2 text-white" />
                            </span>
                            Force Cancel
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-purple-400">
                                <UserX className="h-2 w-2 text-white" />
                            </span>
                            Human Error
                        </span>
                    </div>
                </div>
            )}

            {selectedDay && (
                <AreaBreakdownModal
                    dayData={selectedDay}
                    month={month}
                    year={year}
                    onClose={() => setSelectedDay(null)}
                />
            )}
        </div>
    );
}
