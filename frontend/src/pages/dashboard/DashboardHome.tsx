import {
    Monitor,
    Activity,
    RotateCcw,
    Users,
    Store,
    Wrench,
    BarChart3,
    FileSearch,
    FileText,
    Calendar,
    PieChart,
} from "lucide-react";

const pastelBg = "rgba(146, 199, 207, 0.10)";
const pastelBorder = "rgba(146, 199, 207, 0.25)";
const pastelAccent = "#92C7CF";

const posInventoryItems = [
    { label: "Active POS", value: "128", icon: Monitor },
    { label: "Offline Devices", value: "12", icon: Activity },
    { label: "Pending Reset", value: "5", icon: RotateCcw },
    { label: "Operators", value: "23", icon: Users },
    { label: "Outlets", value: "18", icon: Store },
];

const posRepairItems = [
    { label: "Repair Requests", value: "8", icon: Wrench },
    { label: "Repair Logs", value: "156", icon: BarChart3 },
    { label: "Completed", value: "142", icon: FileSearch },
    { label: "Released", value: "138", icon: FileSearch },
];

const cancellationItems = [
    { label: "Total Records", value: "128", icon: FileText },
    { label: "Daily Report", value: "12", icon: Calendar },
    { label: "Monthly Report", value: "45", icon: BarChart3 },
    { label: "Yearly Report", value: "520", icon: PieChart },
];

function OverviewGroup({ title, items }: { title: string; items: { label: string; value: string; icon: any }[] }) {
    return (
        <div
            className="rounded-3xl p-6 border shadow-2xl backdrop-blur-xl"
            style={{
                background: pastelBg,
                border: `1px solid ${pastelBorder}`,
                boxShadow: "0 8px 32px rgba(31, 38, 135, 0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
            }}
        >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.label}
                            className="rounded-2xl p-4 border"
                            style={{
                                background: "rgba(255, 255, 255, 0.25)",
                                border: `1px solid ${pastelBorder}`,
                            }}
                        >
                            <div
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-3"
                                style={{
                                    background: "rgba(146, 199, 207, 0.20)",
                                    color: pastelAccent,
                                }}
                            >
                                <Icon className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                {item.label}
                            </p>
                            <p
                                className="mt-2 text-2xl font-bold"
                                style={{ color: pastelAccent }}
                            >
                                {item.value}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function DashboardHome() {
    return (
        <div className="space-y-8">
            {/* User Header */}
            <div
                className="rounded-3xl p-6 border shadow-2xl backdrop-blur-xl"
                style={{
                    background: pastelBg,
                    border: `1px solid ${pastelBorder}`,
                    boxShadow: "0 8px 32px rgba(31, 38, 135, 0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                }}
            >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                            style={{
                                background: "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                            }}
                        >
                            KB
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Welcome back,</p>
                            <h1 className="text-2xl font-semibold tracking-tight text-gray-800">KhedBoo</h1>
                            <p className="mt-1 text-sm text-gray-600">IT Manager • Hexaprime Inc.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 min-w-[280px]">
                        <div
                            className="rounded-2xl px-4 py-3 border"
                            style={{
                                background: "rgba(255,255,255,0.25)",
                                border: `1px solid ${pastelBorder}`,
                            }}
                        >
                            <p className="text-xs uppercase tracking-wider text-gray-500">Role</p>
                            <p className="mt-1 font-semibold text-gray-800">Administrator</p>
                        </div>
                        <div
                            className="rounded-2xl px-4 py-3 border"
                            style={{
                                background: "rgba(255,255,255,0.25)",
                                border: `1px solid ${pastelBorder}`,
                            }}
                        >
                            <p className="text-xs uppercase tracking-wider text-gray-500">Status</p>
                            <p className="mt-1 font-semibold text-emerald-600">● Online</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overview Groups */}
            <OverviewGroup title="POS Inventory Overview" items={posInventoryItems} />
            <OverviewGroup title="POS Repair Overview" items={posRepairItems} />
            <OverviewGroup title="Cancellation Overview" items={cancellationItems} />

            {/* System Overview Panel */}
            <div
                className="rounded-3xl p-6 border shadow-2xl backdrop-blur-xl"
                style={{
                    background: pastelBg,
                    border: `1px solid ${pastelBorder}`,
                    boxShadow: "0 8px 32px rgba(31, 38, 135, 0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                }}
            >
                <h3 className="text-xl font-semibold text-gray-800">System Overview</h3>
                <p className="mt-3 text-gray-600 leading-relaxed">
                    Real-time monitoring of POS terminals, repair requests, cancellation records,
                    automation services, and overall system health across all active booths.
                </p>
            </div>
        </div>
    );
}