import {
    Wrench,
    BarChart3,
    ArrowUpRight,
    Clock,
    CheckCircle2,
    Headset,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useAuth } from "../../../context/AuthContext";
import { listRepairRecords } from "../services/repairRecords";
import type { RepairRecord } from "../services/repairRecords";

/* ---------------- Glow & gradient helpers ---------------- */
const teal = "#92C7CF";
const tealLight = "#AAD7D9";
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
type DashboardIcon = ComponentType<{ className?: string }>;

const repairStatuses = [
    { id: "request", status: "For Request", label: "For Request", icon: Wrench, color: "#E8B4B8" },
    { id: "for-repair", status: "For Repair", label: "For Repair", icon: Package, color: "#F2D7B5" },
    { id: "pending", status: "Pending", label: "Pending", icon: Clock, color: "#F2D7B5" },
    { id: "undergoing-repair", status: "Undergoing Repair", label: "Undergoing Repair", icon: BarChart3, color: teal },
    { id: "for-release", status: "For Release", label: "For Release", icon: CheckCircle2, color: "#6BBF6B" },
    { id: "released", status: "Released", label: "Released Today", icon: ArrowUpRight, color: tealLight },
];

const quickActions = [
    { label: "Log POS Issue", icon: Wrench, href: "/app/csr-pos-repair" },
];

/* ---------------- Components ---------------- */

function KpiCard({
    label,
    value,
    icon: Icon,
    gradient,
}: {
    label: string;
    value: string;
    icon: DashboardIcon;
    gradient: string;
}) {
    return (
        <div className="group relative rounded-2xl p-px bg-linear-to-br from-white/40 to-transparent transition-all duration-500 hover:scale-[1.02]">
            <div className="relative rounded-2xl p-5 h-full overflow-hidden backdrop-blur-xl border border-white/30 bg-white/25 shadow-lg transition-all duration-500 hover:shadow-xl">
                {/* Gradient accent bar */}
                <div
                    className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${gradient} opacity-60`}
                />

                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                            {label}
                        </p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-gray-800">
                            {value}
                        </p>
                    </div>
                    <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl shadow-md transition-transform duration-300 group-hover:scale-110"
                        style={{
                            background: `linear-gradient(135deg, ${teal}15, ${tealLight}25)`,
                            color: teal,
                        }}
                    >
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: string;
    icon: DashboardIcon;
    color: string;
}) {
    return (
        <div className="group relative rounded-xl p-px bg-linear-to-br from-white/30 to-transparent transition-all duration-300 hover:scale-[1.03]">
            <div className="relative rounded-xl p-4 backdrop-blur-sm border border-white/20 bg-white/10 transition-all duration-300">
                <div
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg mb-2.5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md"
                    style={{
                        background: `linear-gradient(135deg, ${color}20, ${color}10)`,
                        color: color,
                    }}
                >
                    <Icon className="h-4.5 w-4.5" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {label}
                </p>
                <p className="mt-1 text-xl font-bold text-gray-800">{value}</p>
            </div>
        </div>
    );
}

function SectionCard({
    title,
    children,
    className = "",
}: {
    title: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={className}>
            <div className="relative rounded-3xl p-6 border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg transition-all duration-300 hover:shadow-xl">
                {/* Subtle top accent */}
                <div
                    className="absolute top-0 left-6 right-6 h-0.5 rounded-full opacity-40"
                    style={{
                        background: `linear-gradient(90deg, ${teal}, ${tealLight}, transparent)`,
                    }}
                />
                <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                    <span
                        className="inline-block w-1.5 h-5 rounded-full"
                        style={{ background: teal }}
                    />
                    {title}
                </h3>
                {children}
            </div>
        </div>
    );
}

function ActivityItem({
    action,
    time,
    type,
}: {
    action: string;
    time: string;
    type: "success" | "warning" | "info";
}) {
    const dotColors: Record<string, string> = {
        success: "#6BBF6B",
        warning: "#F2D7B5",
        info: teal,
    };
    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-white/20 last:border-b-0">
            <span
                className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: dotColors[type] }}
            />
            <p className="flex-1 text-sm text-gray-700 truncate">{action}</p>
            <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                <Clock className="h-3 w-3" />
                {time}
            </div>
        </div>
    );
}

/* ---------------- Helper ---------------- */
function formatLoginTime(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Manila",
    });
}

function isToday(value: string) {
    if (!value) return false;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

function filterRecordsByDashboardStatus(records: RepairRecord[], statusId: string): RepairRecord[] {
    const target = repairStatuses.find((item) => item.id === statusId)?.status;
    if (!target) return [];

    if (statusId === "released") {
        return records.filter((record) => record.status === target && isToday(record.date));
    }

    if (statusId === "request") {
        return records.filter(
            (record) =>
                record.status === target &&
                record.forwarded === false &&
                record.released === false
        );
    }

    return records.filter((record) => record.status === target);
}

function formatRelativeTime(value: string) {
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();

    if (Number.isNaN(diffMs) || diffMs < 0) return "just now";

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

    return date.toLocaleDateString("en-PH", { month: "short", day: "2-digit" });
}

function activityType(status: string): "success" | "warning" | "info" {
    if (status === "Released" || status === "For Release") return "success";
    if (status === "Pending" || status === "Undergoing Repair") return "warning";
    return "info";
}

/* ---------------- SVG icons (not in lucide) ---------------- */
function Package({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M16.5 9.4 7.55 4.24" />
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.29 7 12 12 20.71 7" />
            <line x1="12" y1="22" x2="12" y2="12" />
        </svg>
    );
}

/* ---------------- Main CSR Dashboard (POS Repair only) ---------------- */
export default function CsrDashboard() {
    const { user } = useAuth();
    const [currentUser, setCurrentUser] = useState(user);
    const [lastLogin, setLastLogin] = useState<string | null>(null);
    const [repairRecords, setRepairRecords] = useState<RepairRecord[]>([]);
    const [repairLoading, setRepairLoading] = useState(true);
    const [repairError, setRepairError] = useState<string | null>(null);
    const displayName = currentUser?.id === user?.id ? currentUser?.name || user?.name || "CSR" : user?.name || "CSR";

    const counts = useMemo(
        () =>
            Object.fromEntries(
                repairStatuses.map((status) => [
                    status.id,
                    filterRecordsByDashboardStatus(repairRecords, status.id).length,
                ])
            ) as Record<string, number>,
        [repairRecords]
    );

    const kpiCards = [
        {
            label: "For Request",
            value: repairLoading ? "..." : String(counts.request ?? 0),
            icon: Wrench,
            gradient: "from-[#92C7CF] to-[#AAD7D9]",
        },
        {
            label: "Pending",
            value: repairLoading ? "..." : String(counts.pending ?? 0),
            icon: Clock,
            gradient: "from-[#F2D7B5] to-[#E5C599]",
        },
        {
            label: "For Release",
            value: repairLoading ? "..." : String(counts["for-release"] ?? 0),
            icon: CheckCircle2,
            gradient: "from-[#92C7CF] to-[#AAD7D9]",
        },
        {
            label: "Released Today",
            value: repairLoading ? "..." : String(counts.released ?? 0),
            icon: ArrowUpRight,
            gradient: "from-[#E8B4B8] to-[#D69CA0]",
        },
    ];

    const repairStatusItems = repairStatuses.map((status) => ({
        ...status,
        value: repairLoading ? "..." : String(counts[status.id] ?? 0),
    }));

    const recentActivity = useMemo(
        () =>
            [...repairRecords]
                .sort(
                    (a, b) =>
                        new Date(b.updated_at || b.created_at || b.date).getTime() -
                        new Date(a.updated_at || a.created_at || a.date).getTime()
                )
                .slice(0, 5)
                .map((record) => {
                    const timestamp = record.updated_at || record.created_at || record.date;
                    return {
                        action: `POS #${record.device_no || record.id} is ${record.status}`,
                        time: formatRelativeTime(timestamp),
                        type: activityType(record.status),
                    };
                }),
        [repairRecords]
    );

    useEffect(() => {
        if (!user?.id) return;

        let ignored = false;

        fetch(`${API_BASE_URL}/api/users/me?id=${user.id}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch current user");
                return res.json();
            })
            .then((data) => {
                if (!ignored) setCurrentUser({ ...user, ...data });
            })
            .catch(() => { });

        fetch(`${API_BASE_URL}/api/users/${user.id}/latest-login`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch latest login");
                return res.json();
            })
            .then((data) => {
                if (!ignored) setLastLogin(data.login_at ?? null);
            })
            .catch(() => {
                if (!ignored) setLastLogin(null);
            });

        return () => {
            ignored = true;
        };
    }, [user]);

    useEffect(() => {
        let ignored = false;

        listRepairRecords()
            .then((records) => {
                if (!ignored) setRepairRecords(records);
            })
            .catch((err) => {
                if (!ignored) {
                    setRepairError(err instanceof Error ? err.message : "Failed to load repair records");
                    setRepairRecords([]);
                }
            })
            .finally(() => {
                if (!ignored) setRepairLoading(false);
            });

        return () => {
            ignored = true;
        };
    }, []);

    return (
        <div className="space-y-7">
            {/* ===== Header / Welcome ===== */}
            <div className="relative rounded-3xl p-6 sm:p-8 border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg overflow-hidden">
                {/* Decorative blurred blobs */}
                <div
                    className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15 blur-3xl pointer-events-none"
                    style={{ background: teal }}
                />
                <div
                    className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full opacity-10 blur-3xl pointer-events-none"
                    style={{ background: tealLight }}
                />

                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                    <div className="flex items-center gap-4">
                        {/* Avatar with glow */}
                        <div className="relative">
                            <div
                                className="absolute inset-0 rounded-2xl blur-md opacity-40"
                                style={{
                                    background: `linear-gradient(135deg, ${teal}, ${tealLight})`,
                                }}
                            />
                            <div
                                className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg"
                                style={{
                                    background: `linear-gradient(135deg, ${teal} 0%, ${tealLight} 100%)`,
                                }}
                            >
                                <Headset className="h-7 w-7" />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                                Welcome back,
                            </p>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-800">
                                {displayName}
                            </h1>
                            <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-teal-100/50 text-teal-700">
                                    <Headset className="h-3 w-3" />
                                    CSR Support
                                </span>
                                <span className="inline-block w-1 h-1 rounded-full bg-gray-300" />
                                <span className="inline-flex items-center gap-1">
                                    <span
                                        className="inline-block w-2 h-2 rounded-full animate-pulse"
                                        style={{ backgroundColor: "#6BBF6B" }}
                                    />
                                    Online
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick badges */}
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl px-4 py-2.5 backdrop-blur-sm border border-white/30 bg-white/15 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                                Last Login
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-gray-800">
                                {formatLoginTime(lastLogin)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== KPI Cards Row ===== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {kpiCards.map((kpi) => (
                    <KpiCard key={kpi.label} {...kpi} />
                ))}
            </div>

            {/* ===== POS Repair Sections ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title="Repair Status Overview">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {repairStatusItems.map((item) => (
                            <StatCard key={item.label} {...item} />
                        ))}
                    </div>
                </SectionCard>

                <SectionCard title="Recent Activity">
                    {repairError ? (
                        <p className="py-8 text-center text-sm text-rose-500">{repairError}</p>
                    ) : recentActivity.length === 0 && !repairLoading ? (
                        <p className="py-8 text-center text-sm text-gray-400">No repair activity yet.</p>
                    ) : (
                        <div className="divide-y divide-white/20">
                            {recentActivity.map((act, idx) => (
                                <ActivityItem key={idx} {...act} />
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* ===== Quick Actions ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                <SectionCard title="Quick Actions">
                    <div className="flex flex-col gap-2.5 max-w-md">
                        {quickActions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <a
                                    key={action.label}
                                    href={action.href}
                                    className="group flex items-center gap-3 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/20 bg-white/10 transition-all duration-300 hover:bg-white/25 hover:shadow-md hover:scale-[1.01]"
                                >
                                    <div
                                        className="flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110"
                                        style={{
                                            background: `linear-gradient(135deg, ${teal}20, ${tealLight}20)`,
                                            color: teal,
                                        }}
                                    >
                                        <Icon className="h-4.5 w-4.5" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                                        {action.label}
                                    </span>
                                    <ArrowUpRight className="ml-auto h-4 w-4 text-gray-400 opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
                                </a>
                            );
                        })}
                    </div>
                </SectionCard>
            </div>

            {/* ===== POS Repair Info Panel ===== */}
            <div className="relative rounded-3xl p-6 sm:p-8 border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
                {/* Decorative gradient blob */}
                <div
                    className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none"
                    style={{ background: `linear-gradient(135deg, ${teal}, ${tealLight})` }}
                />

                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div
                            className="flex h-12 w-12 items-center justify-center rounded-xl shadow-md"
                            style={{
                                background: `linear-gradient(135deg, ${teal}20, ${tealLight}20)`,
                                color: teal,
                            }}
                        >
                            <Wrench className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-gray-800">
                                POS Repair Management
                            </h3>
                            <p className="mt-1 text-sm text-gray-600 leading-relaxed max-w-2xl">
                                Log and track POS repair requests. Monitor repair status,
                                manage parts, and coordinate with the repair team.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href="/app/csr-pos-repair"
                            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 hover:shadow-md"
                            style={{
                                background: `linear-gradient(135deg, ${teal}, ${tealLight})`,
                                color: "white",
                            }}
                        >
                            Open POS Repair
                            <ArrowUpRight className="h-3 w-3" />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
