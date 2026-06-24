import {
    Monitor,
    Activity,
    RotateCcw,
    UserCircle,
    Users,
    Store,
    Wrench,
    BarChart3,
    FileText,
    Calendar,
    PieChart,
    ArrowUpRight,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Smartphone,
    ClipboardList,
    Settings,
    RefreshCw,
    TrendingUp,
    Loader2,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { useAuth } from "../../context/AuthContext";
import OperatorDashboard from "../../modules/operator/pages/OperatorDashboard";
import CsrDashboard from "../../modules/csr/pages/CsrDashboard";

const teal = "#92C7CF";
const tealLight = "#AAD7D9";
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

interface DashboardStats {
    pos: {
        total: number;
        active: number;
        offline: number;
        pendingReset: number;
        operatorsCount: number;
        outletsCount: number;
    };
    repairs: {
        totalRequests: number;
        repairLogs: number;
        completed: number;
        released: number;
        pendingRepairs: number;
        inProgress: number;
    };
    cancellations: {
        totalRecords: number;
        todayCount: number;
        thisMonth: number;
        thisYear: number;
        pending: number;
    };
    users: {
        total: number;
        admins: number;
        csrs: number;
        operators: number;
        purchasers: number;
    };
    recentActivity: Array<{
        action: string;
        entity: string;
        summary: string | null;
        user_name: string;
        created_at: string;
    }>;
    overview: {
        systemStatus: string;
    };
}

function resolveAvatarUrl(p?: string | null) {
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    return `${API_BASE_URL}${p}`;
}

function KpiCard({
    label,
    value,
    change,
    icon: Icon,
    gradient,
}: {
    label: string;
    value: string;
    change: string;
    icon: ComponentType<{ className?: string }>;
    gradient: string;
}) {
    return (
        <div className="group relative rounded-2xl p-px bg-linear-to-br from-white/40 to-transparent transition-all duration-500 hover:scale-[1.02]">
            <div className="relative rounded-2xl p-5 h-full overflow-hidden backdrop-blur-xl border border-white/30 bg-white/25 shadow-lg transition-all duration-500 hover:shadow-xl">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${gradient} opacity-60`} />
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-gray-800">{value}</p>
                    </div>
                    <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl shadow-md transition-transform duration-300 group-hover:scale-110"
                        style={{ background: `linear-gradient(135deg, ${teal}15, ${tealLight}25)`, color: teal }}
                    >
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100/70 text-emerald-700">
                        <TrendingUp className="h-3 w-3" />
                        {change}
                    </span>
                    <span className="text-xs text-gray-400">live</span>
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
    icon: ComponentType<{ className?: string }>;
    color: string;
}) {
    return (
        <div className="group relative rounded-xl p-px bg-linear-to-br from-white/30 to-transparent transition-all duration-300 hover:scale-[1.03]">
            <div className="relative rounded-xl p-4 backdrop-blur-sm border border-white/20 bg-white/10 transition-all duration-300">
                <div
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg mb-2.5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md"
                    style={{ background: `linear-gradient(135deg, ${color}20, ${color}10)`, color }}
                >
                    <Icon className="h-4.5 w-4.5" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
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
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={className}>
            <div className="relative rounded-3xl p-6 border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg transition-all duration-300 hover:shadow-xl">
                <div
                    className="absolute top-0 left-6 right-6 h-0.5 rounded-full opacity-40"
                    style={{ background: `linear-gradient(90deg, ${teal}, ${tealLight}, transparent)` }}
                />
                <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                    <span className="inline-block w-1.5 h-5 rounded-full" style={{ background: teal }} />
                    {title}
                </h3>
                {children}
            </div>
        </div>
    );
}

function ActivityItem({
    action,
    summary,
    user_name,
    created_at,
}: {
    action: string;
    summary: string;
    user_name: string;
    created_at: string;
}) {
    const timeAgo = getRelativeTime(created_at);
    const display = summary ? `${action}: ${summary}` : action;
    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-white/20 last:border-b-0">
            <span className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: teal }} />
            <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{display}</p>
                <p className="text-xs text-gray-400 truncate">{user_name}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                <Clock className="h-3 w-3" />
                {timeAgo}
            </div>
        </div>
    );
}

function getRelativeTime(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
}

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

export default function DashboardHome() {
    const { user } = useAuth();

    if (user?.usertype === "operator") {
        return <OperatorDashboard />;
    }
    if (user?.usertype === "csr") {
        return <CsrDashboard />;
    }
    return <AdminDashboardHome />;
}

function AdminDashboardHome() {
    const { user } = useAuth();
    const [currentUser, setCurrentUser] = useState(user);
    const [lastLogin, setLastLogin] = useState<string | null>(null);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    const displayName = currentUser?.name || user?.name || "User";
    const displayPosition = currentUser?.position?.trim() || user?.position?.trim();
    const avatarUrl = resolveAvatarUrl(currentUser?.profile_picture ?? user?.profile_picture);

    useEffect(() => {
        setCurrentUser(user);
        if (!user?.id) return;

        let ignored = false;

        fetch(`${API_BASE_URL}/api/users/me?id=${user.id}`)
            .then((r) => r.ok ? r.json() : Promise.reject())
            .then((d) => { if (!ignored) setCurrentUser({ ...user, ...d }); })
            .catch(() => {});

        fetch(`${API_BASE_URL}/api/users/${user.id}/latest-login`)
            .then((r) => r.ok ? r.json() : Promise.reject())
            .then((d) => { if (!ignored) setLastLogin(d.login_at ?? null); })
            .catch(() => { if (!ignored) setLastLogin(null); });

        fetch(`${API_BASE_URL}/api/dashboard/admin-stats`)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (!ignored) {
                    setStats(data);
                    setLoading(false);
                }
            })
            .catch((err) => {
                console.error("[dashboard] fetch error:", err);
                if (!ignored) {
                    setStats({
                        pos: { total: 0, active: 0, offline: 0, pendingReset: 0, operatorsCount: 0, outletsCount: 0 },
                        repairs: { totalRequests: 0, repairLogs: 0, completed: 0, released: 0, pendingRepairs: 0, inProgress: 0 },
                        cancellations: { totalRecords: 0, todayCount: 0, thisMonth: 0, thisYear: 0, pending: 0 },
                        users: { total: 0, admins: 0, csrs: 0, operators: 0, purchasers: 0 },
                        recentActivity: [],
                        overview: { systemStatus: `API Error: ${err.message}` },
                    });
                    setLoading(false);
                }
            });

        return () => { ignored = true; };
    }, [user]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3 text-gray-500">
                    <Loader2 className="h-10 w-10 animate-spin" style={{ color: teal }} />
                    <p className="text-sm font-medium">Loading dashboard data...</p>
                </div>
            </div>
        );
    }

    const s = stats ?? {
        pos: { total: 0, active: 0, offline: 0, pendingReset: 0, operatorsCount: 0, outletsCount: 0 },
        repairs: { totalRequests: 0, repairLogs: 0, completed: 0, released: 0, pendingRepairs: 0, inProgress: 0 },
        cancellations: { totalRecords: 0, todayCount: 0, thisMonth: 0, thisYear: 0, pending: 0 },
        users: { total: 0, admins: 0, csrs: 0, operators: 0, purchasers: 0 },
        recentActivity: [],
        overview: { systemStatus: "All Systems Normal" },
    };

    const kpiCards = [
        {
            label: "Total POS Units",
            value: String(s.pos.total),
            change: `Active: ${s.pos.active}`,
            icon: Monitor,
            gradient: "from-[#92C7CF] to-[#AAD7D9]",
        },
        {
            label: "Active Repairs",
            value: String(s.repairs.totalRequests),
            change: `${s.repairs.pendingRepairs} pending`,
            icon: Wrench,
            gradient: "from-[#E8B4B8] to-[#D69CA0]",
        },
        {
            label: "Cancellation Records",
            value: String(s.cancellations.totalRecords),
            change: `${s.cancellations.thisMonth} this month`,
            icon: FileText,
            gradient: "from-[#F2D7B5] to-[#E5C599]",
        },
        {
            label: "System Users",
            value: String(s.users.total),
            change: `${s.users.operators} operators`,
            icon: Activity,
            gradient: "from-[#92C7CF] to-[#AAD7D9]",
        },
    ];

    const posInventoryItems = [
        { label: "Active POS", value: String(s.pos.active), icon: Monitor, color: teal },
        { label: "Offline Devices", value: String(s.pos.offline), icon: Activity, color: "#E8B4B8" },
        { label: "Pending Reset", value: String(s.pos.pendingReset), icon: RotateCcw, color: "#F2D7B5" },
        { label: "Operators", value: String(s.pos.operatorsCount), icon: Users, color: teal },
        { label: "Outlets", value: String(s.pos.outletsCount), icon: Store, color: tealLight },
    ];

    const posRepairItems = [
        { label: "Repair Requests", value: String(s.repairs.totalRequests), icon: Wrench, color: "#E8B4B8" },
        { label: "Completed", value: String(s.repairs.completed), icon: CheckCircle2, color: "#6BBF6B" },
        { label: "Pending", value: String(s.repairs.pendingRepairs), icon: BarChart3, color: teal },
        { label: "Released", value: String(s.repairs.released), icon: ArrowUpRight, color: tealLight },
    ];

    const cancellationItems = [
        { label: "Total Records", value: String(s.cancellations.totalRecords), icon: FileText, color: teal },
        { label: "This Month", value: String(s.cancellations.thisMonth), icon: Calendar, color: tealLight },
        { label: "Pending", value: String(s.cancellations.pending), icon: BarChart3, color: "#F2D7B5" },
        { label: "All Users", value: String(s.users.total), icon: PieChart, color: "#E8B4B8" },
    ];

    const quickActions = [
        { label: "New POS Entry", icon: Smartphone, href: "/app/pos" },
        { label: "Report Issue", icon: AlertTriangle, href: "/app/pos-repair" },
        { label: "View Cancellations", icon: ClipboardList, href: "/app/cancellation" },
        { label: "Manage Settings", icon: Settings, href: "/app/settings" },
    ];

    return (
        <div className="space-y-7">
            <div className="relative rounded-3xl p-6 sm:p-8 border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: teal }} />
                <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: tealLight }} />
                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-2xl blur-md opacity-40" style={{ background: `linear-gradient(135deg, ${teal}, ${tealLight})` }} />
                            {avatarUrl ? (
                                <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-lg ring-1 ring-white/40">
                                    <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                                </div>
                            ) : (
                                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${teal} 0%, ${tealLight} 100%)` }}>
                                    <UserCircle className="h-7 w-7" />
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Welcome back,</p>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-800">{displayName}</h1>
                            <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                                <span>{displayPosition ? `${displayPosition} \u2022 ` : ""}Hexaprime Inc.</span>
                                <span className="inline-block w-1 h-1 rounded-full bg-gray-300" />
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#6BBF6B" }} />
                                    Online
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl px-4 py-2.5 backdrop-blur-sm border border-white/30 bg-white/15 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Last Login</p>
                            <p className="mt-0.5 text-sm font-semibold text-gray-800">{formatLoginTime(lastLogin)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {kpiCards.map((kpi) => (
                    <KpiCard key={kpi.label} {...kpi} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title="POS Inventory Overview">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {posInventoryItems.map((item) => (
                            <StatCard key={item.label} {...item} />
                        ))}
                    </div>
                </SectionCard>
                <SectionCard title="POS Repair Overview">
                    <div className="grid grid-cols-2 gap-3">
                        {posRepairItems.map((item) => (
                            <StatCard key={item.label} {...item} />
                        ))}
                    </div>
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectionCard title="Cancellation Overview">
                    <div className="grid grid-cols-2 gap-3">
                        {cancellationItems.map((item) => (
                            <StatCard key={item.label} {...item} />
                        ))}
                    </div>
                </SectionCard>
                <SectionCard title="Recent Activity">
                    <div className="divide-y divide-white/20">
                        {s.recentActivity.length === 0 ? (
                            <p className="text-sm text-gray-400 py-3">No recent activity</p>
                        ) : (
                            s.recentActivity.map((act, idx) => (
                                <ActivityItem key={idx} action={act.action} summary={act.summary ?? ""} user_name={act.user_name} created_at={act.created_at} />
                            ))
                        )}
                    </div>
                </SectionCard>
                <SectionCard title="Quick Actions">
                    <div className="flex flex-col gap-2.5">
                        {quickActions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <a
                                    key={action.label}
                                    href={action.href}
                                    className="group flex items-center gap-3 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/20 bg-white/10 transition-all duration-300 hover:bg-white/25 hover:shadow-md hover:scale-[1.01]"
                                >
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${teal}20, ${tealLight}20)`, color: teal }}>
                                        <Icon className="h-4.5 w-4.5" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{action.label}</span>
                                    <ArrowUpRight className="ml-auto h-4 w-4 text-gray-400 opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
                                </a>
                            );
                        })}
                    </div>
                </SectionCard>
            </div>

            <div className="relative rounded-3xl p-6 sm:p-8 border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
                <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: `linear-gradient(135deg, ${teal}, ${tealLight})` }} />
                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl shadow-md" style={{ background: `linear-gradient(135deg, ${teal}20, ${tealLight}20)`, color: teal }}>
                            <RefreshCw className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-gray-800">System Overview</h3>
                            <p className="mt-1 text-sm text-gray-600 leading-relaxed max-w-2xl">
                                Monitoring POS terminals, repair requests, cancellation records, and overall system health.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm border border-white/20 bg-emerald-100/30 text-emerald-700 shadow-sm">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {s.overview.systemStatus}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}