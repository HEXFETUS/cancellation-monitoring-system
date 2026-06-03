import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Building2,
    Camera,
    Car,
    Home,
    MapPin,
    Monitor,
    RefreshCw,
    Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "../../../context/AuthContext";
import {
    listAllAssets,
    syncAssetInventoryFromGoogleSheets,
    type AssetLocation,
} from "../services";
import type { AssetRow } from "../components/AssetTable";

type AssetWithLocation = AssetRow & { location: AssetLocation };

interface SectionDef {
    name: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    /** Backend location this section maps to. Sections without a mapping stay at 0. */
    location: AssetLocation | null;
    /** Optional sub-locations. Each one matches by `space` (case-insensitive). */
    children?: string[];
}

const SECTIONS: SectionDef[] = [
    {
        name: "Main Office",
        icon: Building2,
        location: "office",
        // Physical spaces inside the office. Departments (Admin/IT/HR/etc.)
        // are tracked separately via office_departments and aren't broken
        // out here.
        children: ["Reception", "Showroom", "Conference"],
    },
    { name: "Drawcourt", icon: Monitor, location: "drawcourt" },
    { name: "PCSO", icon: Users, location: null },
    {
        name: "Payout Station",
        icon: MapPin,
        location: "payout",
        children: ["CDO", "WEST", "EAST"],
    },
    { name: "OBS", icon: Camera, location: "obs" },
    { name: "Staffhouse", icon: Home, location: "staffhouse" },
    { name: "Vehicle", icon: Car, location: "vehicle" },
];

const PHP = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

interface SectionStats {
    section: SectionDef;
    /** Sum of asset_value × quantity = total monetary value of this section. */
    totalValue: number;
    /** Total quantity across all rows in this section. */
    quantity: number;
    /** Per-sub-location quantity, keyed by the sub-location name. */
    childCounts: Record<string, number>;
}

function computeStats(
    assets: AssetWithLocation[],
    sections: SectionDef[]
): SectionStats[] {
    return sections.map((section) => {
        if (!section.location) {
            return {
                section,
                totalValue: 0,
                quantity: 0,
                childCounts: Object.fromEntries(
                    (section.children ?? []).map((c) => [c, 0])
                ),
            };
        }

        const rows = assets.filter((a) => a.location === section.location);
        const totalValue = rows.reduce((sum, r) => sum + (r.totalValue || 0), 0);
        const quantity = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);

        const childCounts: Record<string, number> = {};
        for (const child of section.children ?? []) {
            const target = child.toLowerCase();
            childCounts[child] = rows
                .filter((r) => (r.space || "").toLowerCase() === target)
                .reduce((sum, r) => sum + (r.quantity || 0), 0);
        }

        return { section, totalValue, quantity, childCounts };
    });
}

export default function SummaryPage() {
    const { user } = useAuth();
    const [assets, setAssets] = useState<AssetWithLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState("");
    const [syncMessage, setSyncMessage] = useState("");

    const loadAssets = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const data = await listAllAssets();
            setAssets(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not load assets");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError("");
                const data = await listAllAssets();
                if (!cancelled) setAssets(data);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Could not load assets");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const canSync = user?.usertype === "purchaser" || user?.usertype === "admin";

    const handleSyncGoogleSheets = async () => {
        try {
            setSyncing(true);
            setError("");
            setSyncMessage("");

            const summary = await syncAssetInventoryFromGoogleSheets();
            const tabTotals = Object.values(summary.from_google_sheets.tabs).reduce(
                (acc, tab) => ({
                    scanned: acc.scanned + tab.scanned,
                    inserted: acc.inserted + tab.inserted,
                    updated: acc.updated + tab.updated,
                    skipped: acc.skipped + tab.skipped,
                }),
                { scanned: 0, inserted: 0, updated: 0, skipped: 0 }
            );

            await loadAssets();
            // Sync is read-only for now; backend always returns
            // write_configured=false. The banner just summarises the import.
            setSyncMessage(
                `Synced ${tabTotals.scanned} sheet rows into the database: ${tabTotals.inserted} new, ${tabTotals.updated} updated, ${tabTotals.skipped} skipped. Write-back is disabled.`
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not sync Google Sheets");
        } finally {
            setSyncing(false);
        }
    };

    const stats = useMemo(() => computeStats(assets, SECTIONS), [assets]);

    const totals = useMemo(() => {
        const totalAssets = assets.reduce((sum, r) => sum + (r.quantity || 0), 0);
        const totalValue = assets.reduce((sum, r) => sum + (r.totalValue || 0), 0);
        return { totalAssets, totalValue };
    }, [assets]);

    const totalSubLocations = SECTIONS.reduce(
        (sum, s) => sum + (s.children?.length ?? 0),
        0
    );

    return (
        <div>
            {/* Page header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-ink">Asset Inventory Summary</h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Live counts and total value across every asset location.
                    </p>
                </div>

                {canSync && (
                    <button
                        type="button"
                        onClick={handleSyncGoogleSheets}
                        disabled={syncing || loading}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-teal/30 bg-teal px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw
                            size={16}
                            className={syncing ? "animate-spin" : ""}
                        />
                        {syncing ? "Syncing" : "Sync GSheet"}
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            {syncMessage && (
                <div className="mb-4 rounded-lg border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-ink">
                    {syncMessage}
                </div>
            )}

            {/* Top stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard label="Locations" value={SECTIONS.length} />
                <StatCard label="Sub-Locations" value={totalSubLocations} />
                <StatCard
                    label="Total Assets"
                    value={loading ? "—" : totals.totalAssets.toLocaleString()}
                />
                <StatCard
                    label="Total Value"
                    value={loading ? "—" : PHP.format(totals.totalValue)}
                />
            </div>

            {/* Sections grid */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {stats.map((s) => (
                    <SectionCard key={s.section.name} stats={s} loading={loading} />
                ))}
            </div>
        </div>
    );
}

/* ---------------- subcomponents ---------------- */

function StatCard({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="rounded-xl border border-teal/20 bg-teal/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {label}
            </p>
            <p className="mt-1 text-2xl font-bold text-teal">{value}</p>
        </div>
    );
}

function SectionCard({
    stats,
    loading,
}: {
    stats: SectionStats;
    loading: boolean;
}) {
    const { section, totalValue, quantity, childCounts } = stats;
    const Icon = section.icon;
    const tracked = Boolean(section.location);

    return (
        <div className="rounded-2xl border border-warm bg-card p-5 shadow-sm transition hover:border-teal hover:shadow-md">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream text-teal">
                        <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-ink">
                            {section.name}
                        </h2>
                        {!tracked && (
                            <span className="text-[11px] uppercase tracking-wider text-ink-subtle">
                                Not yet tracked
                            </span>
                        )}
                    </div>
                </div>

                <span className="rounded-full bg-teal-light/40 px-2.5 py-0.5 text-xs font-semibold text-ink">
                    {loading ? "…" : quantity}
                </span>
            </div>

            {/* Total value */}
            {tracked && (
                <p className="mt-3 text-xs text-ink-muted">
                    Total value{" "}
                    <span className="font-semibold text-ink">
                        {loading ? "…" : PHP.format(totalValue)}
                    </span>
                </p>
            )}

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
                                <span className="text-xs text-ink-subtle">
                                    {loading ? "…" : (childCounts[child] ?? 0)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
