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

export default function AllPosPage() {
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-slate-900">All POS Devices</h1>
                <p className="mt-1 text-sm text-slate-500">Overview of all POS terminals.</p>
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
        </div>
    );
}