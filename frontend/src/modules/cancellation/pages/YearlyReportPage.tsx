import { useEffect, useMemo, useState } from "react";
import {
    CalendarDays,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    UserX,
    X,
    TrendingUp,
    Sparkles,
    BarChart3,
} from "lucide-react";
import { fetchYearlySummary, fetchMonthlySummary } from "../services";

/* ---------- helpers ---------- */
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBREV = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function cx(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(" ");
}

/* ---------- types ---------- */
type MonthData = {
    month: number;
    approved: number;
    denied: number;
    force_cancel: number;
    human_error: number;
};

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

/* ---------- Animated counter ---------- */
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        const start = display;
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

function GridSkeleton() {
    return (
        <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/25 p-6 shadow-xl backdrop-blur-xl">
            <div className="mb-3 grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 rounded" />
                ))}
            </div>
            {Array.from({ length: 3 }).map((_, row) => (
                <div key={row} className="mb-3 grid grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, col) => (
                        <Skeleton key={col} className="h-36 rounded-xl" />
                    ))}
                </div>
            ))}
        </div>
    );
}

function getTotal(data?: Pick<MonthData, "approved" | "denied" | "force_cancel" | "human_error">) {
    if (!data) return 0;
    return data.approved + data.denied + data.force_cancel + data.human_error;
}

type MonthCellProps = {
    month: number;
    data?: MonthData;
    isCurrent: boolean;
    onSelect?: (data: MonthData) => void;
};

function MonthCell({ month, data, isCurrent, onSelect }: MonthCellProps) {
    const label = MONTH_ABBREV[month - 1];
    const total = getTotal(data);
    const hasData = total > 0;

    return (
        <button
            type="button"
            onClick={() => data && onSelect?.(data)}
            disabled={!data}
            className={cx(
                "group relative flex flex-col rounded-2xl border p-3.5 text-left text-xs transition-all duration-300",
                "hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] active:translate-y-0 active:scale-[1]",
                data && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal/30",
                !data && "cursor-default opacity-40",
                isCurrent
                    ? "border-teal/40 bg-gradient-to-br from-teal/8 to-teal/5 ring-2 ring-teal/25 shadow-lg shadow-teal/10"
                    : hasData
                        ? "border-white/50 bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-sm shadow-sm"
                        : "border-white/30 bg-white/20"
            )}
        >
            {/* Decorative blob on hover */}
            <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-gradient-to-br from-teal/5 to-transparent opacity-0 blur-2xl transition-all duration-500 group-hover:opacity-100" />

            <div className="relative flex h-full flex-col">
                {/* Month label */}
                <div
                    className={cx(
                        "mb-3 flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 text-xs font-bold transition-all duration-300",
                        isCurrent
                            ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-md shadow-teal/30"
                            : hasData
                                ? "bg-white/45 text-ink ring-1 ring-white/40 group-hover:bg-teal/15 group-hover:text-teal-dark"
                                : "bg-white/20 text-ink-subtle/50 ring-1 ring-white/20"
                    )}
                >
                    <span className="text-sm">{label}</span>
                    {data && hasData && (
                        <span className={cx(
                            "inline-flex min-w-8 items-center justify-center rounded-lg px-2 py-1 text-[10px] font-bold",
                            isCurrent
                                ? "bg-white/20 text-white/90"
                                : "bg-white/50 text-ink-muted"
                        )}>
                            {total}
                        </span>
                    )}
                </div>

                {/* Category details */}
                {data && hasData && (
                    <div className="grid grid-cols-2 gap-2">
                        <span className="flex min-h-8 items-center justify-between gap-2 rounded-lg bg-white/35 px-2.5 text-xs font-bold text-emerald-600 ring-1 ring-white/25 transition-all duration-200 group-hover:bg-white/55">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="tabular-nums">
                                {data.approved}
                            </span>
                        </span>
                        <span className="flex min-h-8 items-center justify-between gap-2 rounded-lg bg-white/35 px-2.5 text-xs font-bold text-red-500 ring-1 ring-white/25 transition-all duration-200 group-hover:bg-white/55">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span className="tabular-nums">
                                {data.denied}
                            </span>
                        </span>
                        <span className="flex min-h-8 items-center justify-between gap-2 rounded-lg bg-white/35 px-2.5 text-xs font-bold text-orange-500 ring-1 ring-white/25 transition-all duration-200 group-hover:bg-white/55">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span className="tabular-nums">
                                {data.force_cancel}
                            </span>
                        </span>
                        <span className="flex min-h-8 items-center justify-between gap-2 rounded-lg bg-white/35 px-2.5 text-xs font-bold text-purple-500 ring-1 ring-white/25 transition-all duration-200 group-hover:bg-white/55">
                            <UserX className="h-3.5 w-3.5 shrink-0" />
                            <span className="tabular-nums">
                                {data.human_error}
                            </span>
                        </span>
                    </div>
                )}

                {/* Empty state */}
                {(!data || !hasData) && (
                    <div className="flex flex-1 items-center justify-center text-center text-[10px] text-ink-subtle/20">
                        No data
                    </div>
                )}
            </div>
        </button>
    );
}

/* ─────────────── Area Breakdown Modal (reused from daily details) ─────────────── */
function DailyBreakdownModal({
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
            <div className="max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/40 bg-white/90 shadow-2xl backdrop-blur-2xl animate-[slideDown_0.35s_cubic-bezier(0.16,1,0.3,1)]">
                <div className="flex items-center justify-between border-b border-white/30 px-6 py-5">
                    <div>
                        <h2 className="text-lg font-bold text-ink">{dateLabel}</h2>
                        <p className="mt-0.5 text-xs text-ink-muted">Area breakdown</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-all duration-200 hover:bg-rose/10 hover:text-rose-dark hover:scale-110 active:scale-95"
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
                                {areas.map((area, idx) => (
                                    <tr
                                        key={area.area}
                                        className="transition-all duration-200 hover:bg-teal/5"
                                        style={{ animation: `fadeIn 0.3s ease-out ${idx * 40}ms both` }}
                                    >
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
                        <div className="rounded-2xl border border-white/30 bg-white/30 px-4 py-10 text-center text-sm text-ink-muted shadow-sm backdrop-blur-sm">
                            No area totals available for this date.
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

/* ─────────────── Calendar Modal (daily view for a selected month) ─────────────── */
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DayCellProps = {
    day: number | null;
    data?: DayData;
    isToday: boolean;
    onSelect?: (data: DayData) => void;
};

function DayCell({ day, data, isToday, onSelect }: DayCellProps) {
    if (day === null) {
        return <div className="min-h-[6rem] rounded-xl bg-warm/5" />;
    }

    const total = data ? data.approved + data.denied + data.force_cancel + data.human_error : 0;
    const hasData = total > 0;

    return (
        <button
            type="button"
            onClick={() => data && onSelect?.(data)}
            disabled={!data}
            className={cx(
                "group relative min-h-[6rem] rounded-2xl border p-2 text-left text-xs transition-all duration-300",
                "hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] active:translate-y-0 active:scale-[1]",
                data && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal/30",
                !data && "cursor-default opacity-40",
                isToday
                    ? "border-teal/40 bg-gradient-to-br from-teal/8 to-teal/5 ring-2 ring-teal/25 shadow-lg shadow-teal/10"
                    : hasData
                        ? "border-white/50 bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-sm shadow-sm"
                        : "border-white/30 bg-white/20"
            )}
        >
            {/* Decorative blob on hover */}
            <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br from-teal/5 to-transparent opacity-0 blur-2xl transition-all duration-500 group-hover:opacity-100" />

            <div className="relative">
                <div
                    className={cx(
                        "mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300",
                        isToday
                            ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-md shadow-teal/30 scale-110"
                            : hasData
                                ? "bg-warm/30 text-ink group-hover:bg-teal/20 group-hover:text-teal-dark group-hover:scale-110"
                                : "text-ink-subtle/50"
                    )}
                >
                    {day}
                </div>

                {data && hasData && (
                    <div className="space-y-1">
                        <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 transition-all duration-200 group-hover:scale-105">
                                <CheckCircle2 className="h-2 w-2 shrink-0" />
                                {data.approved}
                            </span>
                            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-red-500 transition-all duration-200 group-hover:scale-105">
                                <XCircle className="h-2 w-2 shrink-0" />
                                {data.denied}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-orange-500 transition-all duration-200 group-hover:scale-105">
                                <AlertTriangle className="h-2 w-2 shrink-0" />
                                {data.force_cancel}
                            </span>
                            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-purple-500 transition-all duration-200 group-hover:scale-105">
                                <UserX className="h-2 w-2 shrink-0" />
                                {data.human_error}
                            </span>
                        </div>
                    </div>
                )}

                {(!data || !hasData) && (
                    <div className="mt-1 text-center text-[9px] text-ink-subtle/20">—</div>
                )}
            </div>
        </button>
    );
}

function MonthDetailModal({
    month,
    year,
    onClose,
}: {
    month: number;
    year: number;
    onClose: () => void;
}) {
    const [dailyData, setDailyData] = useState<DayData[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

    useEffect(() => {
        let ignore = false;
        async function load() {
            setLoading(true);
            try {
                const result = await fetchMonthlySummary(year, month);
                if (!ignore) {
                    setDailyData(result.daily);
                }
            } catch {
                if (!ignore) setDailyData([]);
            } finally {
                if (!ignore) setLoading(false);
            }
        }
        load();
        return () => { ignore = true; };
    }, [year, month]);

    const calendarGrid = useMemo(() => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

        const dataByDay = new Map<number, DayData>();
        for (const d of dailyData) {
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
    }, [year, month, dailyData]);

    const todayStr = new Date().toISOString().split("T")[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/30 px-4 py-6 backdrop-blur-sm">
            <div className="max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/40 bg-white/90 shadow-2xl backdrop-blur-2xl animate-[slideDown_0.35s_cubic-bezier(0.16,1,0.3,1)]">
                <div className="flex items-center justify-between border-b border-white/30 px-6 py-5">
                    <div>
                        <h2 className="text-lg font-bold text-ink">
                            {MONTH_NAMES[month - 1]} {year}
                        </h2>
                        <p className="mt-0.5 text-xs text-ink-muted">Daily breakdown</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-all duration-200 hover:bg-rose/10 hover:text-rose-dark hover:scale-110 active:scale-95"
                        title="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="max-h-[calc(100vh-11rem)] overflow-auto p-6">
                    {loading ? (
                        <div className="rounded-2xl border border-white/30 bg-white/30 p-8 text-center shadow-sm backdrop-blur-sm">
                            <div className="flex items-center justify-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                                <span className="text-sm text-ink-muted">Loading daily data...</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Day-of-week header */}
                            <div className="grid grid-cols-7 border-b border-white/20 bg-gradient-to-r from-white/30 to-white/10 rounded-t-xl">
                                {DAY_LABELS.map((label) => (
                                    <div
                                        key={label}
                                        className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted/70"
                                    >
                                        {label}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar grid */}
                            <div className="p-2 bg-white/10 rounded-b-xl">
                                {calendarGrid.grid.map((row, rowIdx) => (
                                    <div key={rowIdx} className="mb-1.5 grid grid-cols-7 gap-1.5">
                                        {row.map((day, colIdx) => {
                                            const cellDate =
                                                day !== null
                                                    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                                                    : null;
                                            const isToday = cellDate === todayStr;

                                            return (
                                                <DayCell
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

                            {calendarGrid.grid.length === 0 && (
                                <div className="rounded-2xl border border-white/30 bg-white/30 p-8 text-center shadow-sm backdrop-blur-sm">
                                    <CalendarDays className="mx-auto mb-2 h-8 w-8 text-ink-subtle/50" />
                                    <p className="text-sm text-ink-muted">No data available for this month.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {selectedDay && (
                    <DailyBreakdownModal
                        dayData={selectedDay}
                        month={month}
                        year={year}
                        onClose={() => setSelectedDay(null)}
                    />
                )}
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

/* ─────────────── Main Component ─────────────── */
export default function YearlyReportPage() {
    const now = new Date();
    const [year, setYear] = useState<number | "">(now.getFullYear());
    const [data, setData] = useState<MonthData[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<MonthData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!year) return;
        const selectedYear = year;
        let ignore = false;

        async function load() {
            setLoading(true);
            setError("");
            try {
                const result = await fetchYearlySummary(selectedYear);
                if (!ignore) {
                    setData(result.monthly);
                }
            } catch (err) {
                if (!ignore) {
                    setError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Unable to load yearly report");
                    setData([]);
                }
            } finally {
                if (!ignore) setLoading(false);
            }
        }

        load();
        return () => {
            ignore = true;
        };
    }, [year]);

    const dataByMonth = useMemo(() => {
        const map = new Map<number, MonthData>();
        for (const d of data) {
            map.set(d.month, d);
        }
        return map;
    }, [data]);

    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

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

    /* 4x3 grid layout (Q1, Q2, Q3, Q4) */
    const quarters = useMemo(() => {
        const q: number[][] = [];
        for (let i = 0; i < 4; i++) {
            q.push([1 + i * 3, 2 + i * 3, 3 + i * 3]);
        }
        return q;
    }, []);

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
                            <CalendarDays className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-ink sm:text-3xl">{year || "Select a year"}</h1>
                            <p className="mt-1 flex items-center gap-2 text-xs text-ink-muted/80">
                                <span className="inline-flex items-center gap-1">
                                    <BarChart3 className="h-3.5 w-3.5" />
                                    Yearly Cancellation Summary
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Year Filter */}
                    <div className="flex items-center gap-2">
                        <select
                            value={year || ""}
                            onChange={(event) => {
                                const val = event.target.value;
                                setYear(val ? parseInt(val, 10) : "");
                            }}
                            className="h-11 w-28 rounded-2xl border border-white/30 bg-white/50 px-3 text-xs font-semibold text-ink-muted shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/70 hover:text-ink hover:shadow-md focus:border-teal/50 focus:bg-white/70 focus:ring-2 focus:ring-teal/20 outline-none appearance-none cursor-pointer"
                        >
                            <option value="">Year</option>
                            {Array.from({ length: 50 }, (_, i) => {
                                const y = new Date().getFullYear() - 10 + i;
                                return (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>
            </div>

            {/* ─────────────── Error banner ─────────────── */}
            {error && (
                <div className="animate-[slideDown_0.4s_cubic-bezier(0.16,1,0.3,1)] rounded-2xl border border-rose/30 bg-gradient-to-r from-rose/10 to-rose/5 px-5 py-3.5 text-sm font-medium text-rose-dark shadow-lg backdrop-blur-md ring-1 ring-rose/20">
                    <span className="inline-flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose/15">
                            <XCircle className="h-4 w-4 shrink-0" />
                        </span>
                        {error}
                    </span>
                </div>
            )}

            {/* ─────────────── Grand Totals Bar ─────────────── */}
            {!loading && !error && data.length > 0 && (
                <section>
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
                                    Year Summary
                                </span>
                                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/40 px-3 py-1 text-[11px] font-semibold text-ink-muted ring-1 ring-white/30">
                                    <Sparkles className="h-3 w-3 text-teal" />
                                    <AnimatedNumber value={grandTotal} /> cancellation{grandTotal === 1 ? "" : "s"}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-emerald-50/30 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:from-white/60 hover:to-emerald-50/40 hover:border-emerald-200/40 hover:-translate-y-0.5">
                                    <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-400/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                                    <div className="relative">
                                        <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">Approved</span>
                                        </div>
                                        <AnimatedNumber
                                            value={totals.approved}
                                            className="mt-1.5 text-2xl font-bold tracking-tight text-emerald-600"
                                        />
                                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100/60">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all duration-1000 ease-out"
                                                style={{
                                                    width: grandTotal > 0 ? `${(totals.approved / grandTotal) * 100}%` : "0%",
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-red-50/30 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:from-white/60 hover:to-red-50/40 hover:border-red-200/40 hover:-translate-y-0.5">
                                    <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-red-400/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                                    <div className="relative">
                                        <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">Denied</span>
                                        </div>
                                        <AnimatedNumber
                                            value={totals.denied}
                                            className="mt-1.5 text-2xl font-bold tracking-tight text-red-500"
                                        />
                                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-red-100/60">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-300 transition-all duration-1000 ease-out"
                                                style={{
                                                    width: grandTotal > 0 ? `${(totals.denied / grandTotal) * 100}%` : "0%",
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-orange-50/30 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:from-white/60 hover:to-orange-50/40 hover:border-orange-200/40 hover:-translate-y-0.5">
                                    <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-orange-400/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                                    <div className="relative">
                                        <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                                            <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">Force Cancel</span>
                                        </div>
                                        <AnimatedNumber
                                            value={totals.force_cancel}
                                            className="mt-1.5 text-2xl font-bold tracking-tight text-orange-500"
                                        />
                                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-orange-100/60">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-300 transition-all duration-1000 ease-out"
                                                style={{
                                                    width: grandTotal > 0 ? `${(totals.force_cancel / grandTotal) * 100}%` : "0%",
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-purple-50/30 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:from-white/60 hover:to-purple-50/40 hover:border-purple-200/40 hover:-translate-y-0.5">
                                    <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-purple-400/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                                    <div className="relative">
                                        <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                                            <UserX className="h-3.5 w-3.5 text-purple-400" />
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">Human Error</span>
                                        </div>
                                        <AnimatedNumber
                                            value={totals.human_error}
                                            className="mt-1.5 text-2xl font-bold tracking-tight text-purple-500"
                                        />
                                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-purple-100/60">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-300 transition-all duration-1000 ease-out"
                                                style={{
                                                    width: grandTotal > 0 ? `${(totals.human_error / grandTotal) * 100}%` : "0%",
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ─────────────── Monthly Grid ─────────────── */}
            <section>
                {loading ? (
                    <GridSkeleton />
                ) : (
                    <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/40 via-white/20 to-white/5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:shadow-2xl">
                        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-teal/5 blur-3xl transition-all duration-700 group-hover:scale-110" />
                        <div className="pointer-events-none absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-warm/10 blur-3xl transition-all duration-700 group-hover:scale-110" />
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.02]"
                            style={{
                                backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                                backgroundSize: "20px 20px",
                            }}
                        />

                        {/* Quarter labels */}
                        <div className="grid grid-cols-4 border-b border-white/20 bg-gradient-to-r from-white/30 to-white/10">
                            {["Q1", "Q2", "Q3", "Q4"].map((label) => (
                                <div
                                    key={label}
                                    className="px-2 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70"
                                >
                                    {label}
                                </div>
                            ))}
                        </div>

                        {/* Month grid */}
                        <div className="p-3">
                            {quarters.map((quarterMonths, qIdx) => (
                                <div key={qIdx} className="mb-3 grid grid-cols-3 gap-3 last:mb-0">
                                    {quarterMonths.map((m) => {
                                        const monthData = dataByMonth.get(m);
                                        const isCurrent =
                                            year !== "" && year === currentYear && m === currentMonth;

                                        return (
                                            <MonthCell
                                                key={m}
                                                month={m}
                                                data={monthData}
                                                isCurrent={isCurrent}
                                                onSelect={setSelectedMonth}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !error && data.length === 0 && (
                    <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/40 via-white/20 to-white/5 p-12 text-center shadow-xl backdrop-blur-xl">
                        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-teal/5 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-teal-light/5 blur-3xl" />
                        <CalendarDays className="mx-auto mb-4 h-12 w-12 text-ink-subtle/50" />
                        <p className="text-sm font-medium text-ink-muted">No data available for this year.</p>
                        <p className="mt-1 text-xs text-ink-subtle/60">Try selecting a different year.</p>
                    </div>
                )}
            </section>

            {/* ─────────────── Legend ─────────────── */}
            {!loading && !error && (
                <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/40 via-white/20 to-white/5 px-6 py-4 shadow-xl backdrop-blur-xl transition-all duration-300 hover:shadow-2xl">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                        <span className="font-bold text-ink">Legend:</span>
                        <span className="inline-flex items-center gap-1.5 transition-all duration-200 hover:scale-105">
                            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-400">
                                <CheckCircle2 className="h-2 w-2 text-white" />
                            </span>
                            Approved
                        </span>
                        <span className="inline-flex items-center gap-1.5 transition-all duration-200 hover:scale-105">
                            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-red-400">
                                <XCircle className="h-2 w-2 text-white" />
                            </span>
                            Denied
                        </span>
                        <span className="inline-flex items-center gap-1.5 transition-all duration-200 hover:scale-105">
                            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-orange-400">
                                <AlertTriangle className="h-2 w-2 text-white" />
                            </span>
                            Force Cancel
                        </span>
                        <span className="inline-flex items-center gap-1.5 transition-all duration-200 hover:scale-105">
                            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-purple-400">
                                <UserX className="h-2 w-2 text-white" />
                            </span>
                            Human Error
                        </span>
                    </div>
                </div>
            )}

            {/* Month detail modal */}
            {selectedMonth && year && (
                <MonthDetailModal
                    month={selectedMonth.month}
                    year={year}
                    onClose={() => setSelectedMonth(null)}
                />
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
