import {
    Monitor,
    Activity,
    RotateCcw,
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
} from "lucide-react";

/* ---------------- Glow & gradient helpers ---------------- */
const teal = "#92C7CF";
const tealLight = "#AAD7D9";

/* ---------------- Data ---------------- */
const kpiCards = [
    {
        label: "Total POS Units",
        value: "140",
        change: "+4.2%",
        icon: Monitor,
        gradient: "from-[#92C7CF] to-[#AAD7D9]",
    },
    {
        label: "Active Repairs",
        value: "8",
        change: "-2.1%",
        icon: Wrench,
        gradient: "from-[#E8B4B8] to-[#D69CA0]",
    },
    {
        label: "Cancellation Records",
        value: "705",
        change: "+12.5%",
        icon: FileText,
        gradient: "from-[#F2D7B5] to-[#E5C599]",
    },
    {
        label: "System Uptime",
        value: "99.8%",
        change: "Last 30d",
        icon: Activity,
        gradient: "from-[#92C7CF] to-[#AAD7D9]",
    },
];

const posInventoryItems = [
    { label: "Active POS", value: "128", icon: Monitor, color: teal },
    { label: "Offline Devices", value: "12", icon: Activity, color: "#E8B4B8" },
    { label: "Pending Reset", value: "5", icon: RotateCcw, color: "#F2D7B5" },
    { label: "Operators", value: "23", icon: Users, color: teal },
    { label: "Outlets", value: "18", icon: Store, color: tealLight },
];

const posRepairItems = [
    { label: "Repair Requests", value: "8", icon: Wrench, color: "#E8B4B8" },
    { label: "Repair Logs", value: "156", icon: BarChart3, color: teal },
    { label: "Completed", value: "142", icon: CheckCircle2, color: "#6BBF6B" },
    { label: "Released", value: "138", icon: ArrowUpRight, color: tealLight },
];

const cancellationItems = [
    { label: "Total Records", value: "128", icon: FileText, color: teal },
    { label: "Daily Report", value: "12", icon: Calendar, color: tealLight },
    { label: "Monthly Report", value: "45", icon: BarChart3, color: "#F2D7B5" },
    { label: "Yearly Report", value: "520", icon: PieChart, color: "#E8B4B8" },
];

const quickActions = [
    { label: "New POS Entry", icon: Smartphone, href: "/app/pos" },
    { label: "Report Issue", icon: AlertTriangle, href: "/app/pos-repair" },
    { label: "View Cancellations", icon: ClipboardList, href: "/app/cancellation" },
    { label: "Manage Settings", icon: Settings, href: "/app/settings" },
];

const recentActivity: { action: string; time: string; type: "success" | "warning" | "info" }[] = [
    { action: "POS #A102 went offline", time: "2 min ago", type: "warning" },
    { action: "Repair #R045 completed", time: "15 min ago", type: "success" },
    { action: "New cancellation filed", time: "1 hr ago", type: "info" },
    { action: "Operator Jane added to Outlet 3", time: "2 hrs ago", type: "info" },
    { action: "Stock count updated", time: "4 hrs ago", type: "success" },
];

/* ---------------- Components ---------------- */

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
    icon: any;
    gradient: string;
}) {
    const isPositive = change.startsWith("+");
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

                <div className="mt-3 flex items-center gap-1.5">
                    <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isPositive
                                ? "bg-emerald-100/70 text-emerald-700"
                                : "bg-rose-100/70 text-rose-700"
                        }`}
                    >
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : null}
                        {change}
                    </span>
                    <span className="text-xs text-gray-400">vs last month</span>
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
    icon: any;
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
    children: React.ReactNode;
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

/* ---------------- Main Dashboard ---------------- */

export default function DashboardHome() {
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
                                className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg"
                                style={{
                                    background: `linear-gradient(135deg, ${teal} 0%, ${tealLight} 100%)`,
                                }}
                            >
                                KB
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                                Welcome back,
                            </p>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-800">
                                KhedBoo
                            </h1>
                            <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                                <span>IT Manager • Hexaprime Inc.</span>
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
                        <div
                            className="rounded-xl px-4 py-2.5 backdrop-blur-sm border border-white/30 bg-white/15 shadow-sm"
                        >
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                                Role
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-gray-800">
                                Administrator
                            </p>
                        </div>
                        <div
                            className="rounded-xl px-4 py-2.5 backdrop-blur-sm border border-white/30 bg-white/15 shadow-sm"
                        >
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                                Last Login
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-gray-800">
                                09:30 AM
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

            {/* ===== Overview Sections ===== */}
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

            {/* ===== Third Row: Cancellation + Activity + Quick Actions ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cancellation Overview */}
                <SectionCard title="Cancellation Overview">
                    <div className="grid grid-cols-2 gap-3">
                        {cancellationItems.map((item) => (
                            <StatCard key={item.label} {...item} />
                        ))}
                    </div>
                </SectionCard>

                {/* Recent Activity */}
                <SectionCard title="Recent Activity">
                    <div className="divide-y divide-white/20">
                        {recentActivity.map((act, idx) => (
                            <ActivityItem key={idx} {...act} />
                        ))}
                    </div>
                </SectionCard>

                {/* Quick Actions */}
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

            {/* ===== System Overview Panel ===== */}
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
                            <RefreshCw className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-gray-800">
                                System Overview
                            </h3>
                            <p className="mt-1 text-sm text-gray-600 leading-relaxed max-w-2xl">
                                Real-time monitoring of POS terminals, repair requests,
                                cancellation records, automation services, and overall system
                                health across all active booths.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm border border-white/20 bg-emerald-100/30 text-emerald-700 shadow-sm"
                        >
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            All Systems Normal
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
