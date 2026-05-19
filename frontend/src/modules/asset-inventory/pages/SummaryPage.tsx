import { Building2, Car, Home, MapPin, Monitor, Users } from "lucide-react";
import type { ComponentType } from "react";

interface Section {
    name: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    /** Optional list of sub-locations under this section. */
    children?: string[];
    /** Placeholder asset counts. Wire to real data once backend exists. */
    count?: number;
}

const sections: Section[] = [
    {
        name: "Main Office",
        icon: Building2,
        count: 0,
        children: [
            "Receptions",
            "OPS/Admin",
            "Accounting",
            "IT",
            "Conference",
            "Showroom",
        ],
    },
    {
        name: "Drawcourt",
        icon: Monitor,
        count: 0,
    },
    {
        name: "PCSO",
        icon: Users,
        count: 0,
    },
    {
        name: "Payout Station",
        icon: MapPin,
        count: 0,
        children: ["CDO", "WEST", "EAST"],
    },
    {
        name: "Staffhouse",
        icon: Home,
        count: 0,
    },
    {
        name: "Vehicle",
        icon: Car,
        count: 0,
    },
];

export default function SummaryPage() {
    const totalSections = sections.length;
    const totalSubLocations = sections.reduce(
        (sum, s) => sum + (s.children?.length ?? 0),
        0
    );

    return (
        <div>
            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-ink">Asset Inventory Summary</h1>
                <p className="mt-1 text-sm text-ink-muted">
                    Overview of all asset locations and their sub-areas.
                </p>
            </div>

            {/* Top stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
                <StatCard label="Locations" value={totalSections} />
                <StatCard label="Sub-Locations" value={totalSubLocations} />
                <StatCard label="Total Assets" value={0} />
            </div>

            {/* Sections grid */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sections.map((section) => (
                    <SectionCard key={section.name} section={section} />
                ))}
            </div>
        </div>
    );
}

/* ---------------- subcomponents ---------------- */

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-teal/20 bg-teal/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {label}
            </p>
            <p className="mt-1 text-2xl font-bold text-teal">{value}</p>
        </div>
    );
}

function SectionCard({ section }: { section: Section }) {
    const Icon = section.icon;

    return (
        <div className="rounded-2xl border border-warm bg-card p-5 shadow-sm transition hover:border-teal hover:shadow-md">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream text-teal">
                        <Icon size={20} />
                    </div>
                    <h2 className="text-base font-semibold text-ink">{section.name}</h2>
                </div>

                <span className="rounded-full bg-teal-light/40 px-2.5 py-0.5 text-xs font-semibold text-ink">
                    {section.count ?? 0}
                </span>
            </div>

            {/* Sub-locations */}
            {section.children && section.children.length > 0 && (
                <div className="mt-4 border-t border-warm pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                        Sub-Locations
                    </p>
                    <ul className="space-y-1">
                        {section.children.map((child) => (
                            <li
                                key={child}
                                className="flex items-center justify-between rounded-lg px-2 py-1 text-sm text-ink-muted transition hover:bg-cream"
                            >
                                <span className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                                    {child}
                                </span>
                                <span className="text-xs text-ink-subtle">0</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
