import { Link } from "react-router-dom";
import {
    Activity,
    BarChart3,
    CheckCircle,
    ClipboardList,
    Cpu,
    FileSearch,
    MapPin,
    Repeat,
    Repeat2,
    ShieldCheck,
    Users,
    Wrench,
} from "lucide-react";

const summaryCards = [
    {
        label: "Active POS",
        value: "128",
        icon: Cpu,
        accent: "from-cyan-400 to-sky-500",
    },
    {
        label: "Offline Devices",
        value: "12",
        icon: ShieldCheck,
        accent: "from-rose-400 to-pink-500",
    },
    {
        label: "Operators",
        value: "23",
        icon: Users,
        accent: "from-orange-400 to-amber-500",
    },
    {
        label: "Outlets",
        value: "18",
        icon: MapPin,
        accent: "from-emerald-400 to-lime-500",
    },
];

const quickLinks = [
    { label: "POS Status", to: "/app/pos/status", icon: Activity },
    { label: "All Operators", to: "/app/pos/operators", icon: Users },
    { label: "All Outlets", to: "/app/pos/outlets", icon: MapPin },
    { label: "Request Reset", to: "/app/pos/request-reset", icon: Repeat },
];

const sectionCards = [
    {
        title: "Repair Monitoring",
        description: "Track requests, logs, and released devices in a unified workflow.",
        items: [
            { name: "POS Repair Request", to: "/app/pos/repair-request", icon: Wrench },
            { name: "POS Repair Log", to: "/app/pos/repair-log", icon: ClipboardList },
            { name: "POS Released Log", to: "/app/pos/released-log", icon: CheckCircle },
            { name: "List of Diagnosis", to: "/app/pos/diagnosis", icon: FileSearch },
        ],
    },
    {
        title: "Reports",
        description: "Quickly review device audits, transfers, and status reports.",
        items: [
            { name: "Convert Area Logs", to: "/app/pos/reports/convert-area-logs", icon: BarChart3 },
            { name: "Change Device Logs", to: "/app/pos/reports/change-device-logs", icon: Repeat2 },
            { name: "Change Device Monitoring", to: "/app/pos/reports/change-device-monitoring", icon: Activity },
            { name: "POS Status Logs", to: "/app/pos/reports/pos-status-logs", icon: ShieldCheck },
        ],
    },
];

export default function ProductsPage() {
    return (
        <div className="space-y-8">
            <header className="rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-sky-600">POS Inventory</p>
                        <h1 className="mt-3 text-4xl font-semibold text-slate-900">Modern POS operations dashboard</h1>
                        <p className="mt-4 max-w-2xl text-slate-600">
                            Manage POS devices, operators, outlets, repairs, and audit reports from one central, modern interface.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <Link
                            to="/app/pos/all-pos"
                            className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-900"
                        >
                            View all POS
                        </Link>
                        <Link
                            to="/app/pos/status"
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-50"
                        >
                            Check status
                        </Link>
                        <Link
                            to="/app/pos/repair-request"
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-50"
                        >
                            New repair request
                        </Link>
                    </div>
                </div>
            </header>

            <section className="grid gap-4 xl:grid-cols-4">
                {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.label}
                            className="rounded-3xl border border-slate-200 bg-gradient-to-br p-1 shadow-lg shadow-slate-200/40"
                        >
                            <div className="flex h-full flex-col justify-between gap-4 rounded-3xl bg-white p-6">
                                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 shadow-sm">
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">{card.label}</p>
                                    <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
                                </div>
                                <div className={`h-1 rounded-full bg-gradient-to-r ${card.accent}`} />
                            </div>
                        </div>
                    );
                })}
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/30">
                    <h2 className="text-xl font-semibold text-slate-900">Quick actions</h2>
                    <p className="mt-2 text-sm text-slate-500">Jump straight to the most important POS Inventory sections.</p>
                    <div className="mt-5 grid gap-3">
                        {quickLinks.map((link) => {
                            const Icon = link.icon;
                            return (
                                <Link
                                    key={link.label}
                                    to={link.to}
                                    className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100"
                                >
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <span className="font-medium">{link.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/30">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900">Inventory overview</h2>
                            <p className="mt-2 text-sm text-slate-500">The latest status of devices, operators, and repair queues.</p>
                        </div>
                        <div className="inline-flex rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                            <span className="mr-2 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                            Live updates enabled
                        </div>
                    </div>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            <p className="text-sm text-slate-500">Pending repair requests</p>
                            <p className="mt-3 text-3xl font-semibold text-slate-900">8</p>
                            <p className="mt-3 text-sm text-slate-500">Average resolution time: 3.2 days</p>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            <p className="text-sm text-slate-500">Devices pending reset</p>
                            <p className="mt-3 text-3xl font-semibold text-slate-900">5</p>
                            <p className="mt-3 text-sm text-slate-500">Operator verification required</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
                {sectionCards.map((section) => (
                    <div key={section.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/30">
                        <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                        <p className="mt-2 text-sm text-slate-500">{section.description}</p>
                        <div className="mt-5 grid gap-3">
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.to}
                                        className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100"
                                    >
                                        <span className="flex items-center gap-3">
                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <span className="font-medium">{item.name}</span>
                                        </span>
                                        <span className="text-slate-400">→</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
}
