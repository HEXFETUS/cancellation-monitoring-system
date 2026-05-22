import { Cpu, ShieldCheck, Users, MapPin } from "lucide-react";

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

            <section className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/30">
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
        </div>
    );
}
