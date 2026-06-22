import { useEffect, useMemo, useState } from "react";
import {
    Building2,
    Camera,
    Car,
    Home,
    MapPin,
    Monitor,
    RefreshCw,
    Users,
    Sparkles,
    Eye,
    Code,
    FileText,
    ChevronRight,
    QrCode,
    Hash,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ComponentType } from "react";
import { useAuth } from "../../../context/AuthContext";
import {
    listAllAssets,
    type AssetLocation,
} from "../services";
import { listAssetCodes } from "../services/assetCodes";
import type { AssetRow } from "../components/AssetTable";

type AssetWithLocation = AssetRow & { location: AssetLocation };

interface SectionDef {
    name: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    location: AssetLocation | null;
    children?: string[];
}

const SECTIONS: SectionDef[] = [
    {
        name: "Main Office",
        icon: Building2,
        location: "office",
        children: ["Reception", "Showroom", "Conference"],
    },
    { name: "Drawcourt", icon: Monitor, location: "drawcourt" },
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

function cx(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(" ");
}

interface SectionStats {
    section: SectionDef;
    totalValue: number;
    quantity: number;
    childCounts: Record<string, number>;
}

function computeStats(assets: AssetWithLocation[], sections: SectionDef[]): SectionStats[] {
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

function StatCardSkeleton() {
    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/30 bg-white/30 p-5 shadow-sm backdrop-blur-sm">
            <Skeleton className="mb-3 h-4 w-20" />
            <Skeleton className="h-8 w-16" />
        </div>
    );
}

function SectionCardSkeleton() {
    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/30 bg-white/30 p-5 shadow-sm backdrop-blur-sm">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-4 w-32" />
        </div>
    );
}

const SECTION_LINKS = [
    { id: "summary-report", label: "Summary Report", icon: FileText, description: "Full asset distribution matrix by location" },
    { id: "office", label: "Office", icon: Building2, description: "Main Office & department assets" },
    { id: "payout", label: "Payout", icon: MapPin, description: "Payout station assets" },
    { id: "drawcourt", label: "Drawcourt", icon: Monitor, description: "Drawcourt equipment" },
    { id: "obs", label: "OBS", icon: Eye, description: "OBS office assets" },
    { id: "staffhouse", label: "Staffhouse", icon: Home, description: "Staffhouse assets" },
    { id: "vehicle", label: "Vehicle", icon: Car, description: "Vehicle assets" },
    { id: "asset-coding", label: "Asset Coding", icon: Code, description: "Asset codes & QR management" },
];

export default function AssetsDashboardPage({ syncMessage }: { syncMessage?: string } = {}) {
    const navigate = useNavigate();
    const { user: _user } = useAuth();
    const [assets, setAssets] = useState<AssetWithLocation[]>([]);
    const [obsCodes, setObsCodes] = useState<number>(0);
    const [totalAssetCodes, setTotalAssetCodes] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError("");
                const [assetData, allCodes] = await Promise.all([
                    listAllAssets(),
                    listAssetCodes(),
                ]);
                if (cancelled) return;
                setAssets(assetData);
                setTotalAssetCodes(allCodes.length);
                setObsCodes(allCodes.filter((c) =>
                    c.department?.toUpperCase() === "OBS" ||
                    c.itemCode?.toUpperCase().startsWith("OBS")
                ).length);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Could not load assets");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);


    const stats = useMemo(() => computeStats(assets, SECTIONS), [assets]);

    const totals = useMemo(() => {
        const totalAssets = assets.reduce((sum, r) => sum + (r.quantity || 0), 0);
        const totalValue = assets.reduce((sum, r) => sum + (r.totalValue || 0), 0);
        return { totalAssets, totalValue };
    }, [assets]);

    const totalSubLocations = SECTIONS.reduce(
        (sum, s) => sum + (s.children?.length ?? 0), 0
    );

    const uniqueAssetNames = useMemo(
        () => new Set(assets.map((a) => a.itemDescription).filter(Boolean)).size,
        [assets]
    );

    return (
        <div className="space-y-6">
            {/* ─────────────── Messages ─────────────── */}
            {(error || syncMessage) && (
                <div
                    className={cx(
                        "animate-[slideDown_0.4s_cubic-bezier(0.16,1,0.3,1)] rounded-2xl border px-5 py-3.5 text-sm font-medium shadow-lg backdrop-blur-md",
                        error
                            ? "border-rose/30 bg-gradient-to-r from-rose/10 to-rose/5 text-rose-dark ring-1 ring-rose/20"
                            : "border-teal/30 bg-gradient-to-r from-teal/10 to-teal/5 text-ink ring-1 ring-teal/20"
                    )}
                >
                    <span className="inline-flex items-center gap-2.5">
                        <span className={cx("flex h-7 w-7 items-center justify-center rounded-full", error ? "bg-rose/15" : "bg-teal/15")}>
                            {error ? (
                                <span className="h-4 w-4 shrink-0 text-rose">✕</span>
                            ) : (
                                <RefreshCw className="h-4 w-4 shrink-0 text-teal" />
                            )}
                        </span>
                        <span>{error || syncMessage || ""}</span>
                    </span>
                </div>
            )}

            {/* ─────────────── Overall Stats ─────────────── */}
            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
                </div>
            ) : (
                <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/40 via-white/20 to-white/5 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 sm:p-7 hover:shadow-2xl">
                    <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/5 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-teal/5 blur-3xl" />
                    <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`, backgroundSize: "20px 20px" }} />
                    <div className="relative">
                        <div className="mb-5 flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal/10 to-teal-light/10 ring-1 ring-teal/20">
                                <Sparkles className="h-4 w-4 text-teal" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70">Asset Inventory Overview</span>
                            {!loading && (
                                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/40 px-3 py-1 text-[11px] font-semibold text-ink-muted ring-1 ring-white/30">
                                    <Sparkles className="h-3 w-3 text-teal/60" />
                                    {totals.totalAssets.toLocaleString()} total assets
                                </span>
                            )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard label="Locations" value={SECTIONS.length} icon={MapPin} />
                            <StatCard label="Sub-Locations" value={totalSubLocations} icon={Building2} />
                            <StatCard label="Total Assets" value={totals.totalAssets.toLocaleString()} icon={Monitor} />
                            <StatCard label="Total Value" value={PHP.format(totals.totalValue)} icon={Users} />
                        </div>
                    </div>
                </div>
            )}

            {/* ─────────────── Inventory Insights Grid ─────────────── */}
            <div>
                <div className="mb-4 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal/10 to-teal-light/10 ring-1 ring-teal/20">
                        <Hash className="h-4 w-4 text-teal" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70">Inventory Insights</span>
                </div>
                {loading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {/* OBS Asset Codes */}
                        <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-white/30 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                            <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-violet-500/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                            <div className="relative">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">OBS Asset Codes</span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400/20 to-violet-400/5 ring-1 ring-violet-400/20">
                                        <Eye className="h-4 w-4 text-violet-400" />
                                    </div>
                                </div>
                                <p className="mt-2.5 text-2xl font-bold tracking-tight text-ink">{obsCodes}</p>
                                <p className="mt-1 text-[11px] text-ink-muted/70">Asset codes assigned to OBS department</p>
                            </div>
                        </div>

                        {/* Total Asset Codes */}
                        <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-white/30 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                            <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-amber-500/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                            <div className="relative">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">Asset Codes</span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-400/5 ring-1 ring-amber-400/20">
                                        <QrCode className="h-4 w-4 text-amber-400" />
                                    </div>
                                </div>
                                <p className="mt-2.5 text-2xl font-bold tracking-tight text-ink">{totalAssetCodes}</p>
                                <p className="mt-1 text-[11px] text-ink-muted/70">Total coded assets across all locations</p>
                            </div>
                        </div>

                        {/* Unique Asset Types */}
                        <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-white/30 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                            <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-500/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                            <div className="relative">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">Unique Items</span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-400/5 ring-1 ring-emerald-400/20">
                                        <Hash className="h-4 w-4 text-emerald-400" />
                                    </div>
                                </div>
                                <p className="mt-2.5 text-2xl font-bold tracking-tight text-ink">{uniqueAssetNames.toLocaleString()}</p>
                                <p className="mt-1 text-[11px] text-ink-muted/70">Distinct asset descriptions in inventory</p>
                            </div>
                        </div>

                        {/* Total Records */}
                        <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-white/30 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                            <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-teal/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                            <div className="relative">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">Total Records</span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal/20 to-teal/5 ring-1 ring-teal/20">
                                        <FileText className="h-4 w-4 text-teal" />
                                    </div>
                                </div>
                                <p className="mt-2.5 text-2xl font-bold tracking-tight text-ink">{assets.length.toLocaleString()}</p>
                                <p className="mt-1 text-[11px] text-ink-muted/70">Individual asset entries in database</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ─────────────── Location Overview Cards ─────────────── */}
            <div>
                <div className="mb-4 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal/10 to-teal-light/10 ring-1 ring-teal/20">
                        <Building2 className="h-4 w-4 text-teal" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70">Location Overview</span>
                    {!loading && (
                        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/40 px-3 py-1 text-[11px] font-semibold text-ink-muted ring-1 ring-white/30">
                            {SECTIONS.length} locations &middot; {totals.totalAssets.toLocaleString()} assets
                        </span>
                    )}
                </div>
                {loading ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <SectionCardSkeleton /><SectionCardSkeleton /><SectionCardSkeleton />
                        <SectionCardSkeleton /><SectionCardSkeleton /><SectionCardSkeleton /><SectionCardSkeleton />
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {stats.map((s, idx) => (
                            <SectionCard key={s.section.name} stats={s} loading={loading} index={idx} />
                        ))}
                    </div>
                )}
            </div>

            {/* ─────────────── Quick Links to Other Pages ─────────────── */}
            <div>
                <div className="mb-4 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal/10 to-teal-light/10 ring-1 ring-teal/20">
                        <Sparkles className="h-4 w-4 text-teal" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70">Manage Assets</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {SECTION_LINKS.map((link, idx) => (
                        <button
                            key={link.id}
                            type="button"
                            onClick={() => navigate(`/app/asset-inventory/${link.id}`)}
                            className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-white/30 p-4 shadow-sm backdrop-blur-sm text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                            style={{ animation: `fadeIn 0.3s ease-out ${idx * 50}ms both` }}
                        >
                            <div className="pointer-events-none absolute -right-4 -top-4 h-14 w-14 rounded-full bg-teal/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
                            <div className="relative flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal/20 to-teal/5 ring-1 ring-teal/20 transition-all duration-300 group-hover/card:scale-110">
                                    <link.icon className="h-4 w-4 text-teal" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-ink">{link.label}</p>
                                    <p className="text-[11px] text-ink-muted/70 truncate">{link.description}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle/50 transition-all duration-300 group-hover/card:translate-x-0.5" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Keyframes */}
            <style>{`
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

/* ---------------- subcomponents ---------------- */

function StatCard({ label, value, icon: Icon }: {
    label: string;
    value: number | string;
    icon: ComponentType<{ size?: number; className?: string }>;
}) {
    return (
        <div className="group/card relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-white/30 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-teal/5 blur-2xl transition-all duration-500 group-hover/card:scale-150" />
            <div className="relative">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/70">{label}</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal/20 to-teal/5 ring-1 ring-teal/20 transition-all duration-300 group-hover/card:scale-110 group-hover/card:shadow-lg group-hover/card:shadow-teal/20">
                        <Icon className="h-4.5 w-4.5 text-teal" />
                    </div>
                </div>
                <p className="mt-2.5 text-2xl font-bold tracking-tight text-ink">{value}</p>
            </div>
        </div>
    );
}

function SectionCard({ stats, loading, index = 0 }: {
    stats: SectionStats;
    loading: boolean;
    index?: number;
}) {
    const { section, totalValue, quantity, childCounts } = stats;
    const Icon = section.icon;
    const tracked = Boolean(section.location);

    return (
        <div
            className="group/card overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/50 to-white/30 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
            style={{ animation: `fadeIn 0.3s ease-out ${index * 60}ms both` }}
        >
            <div className={cx(
                "flex items-center justify-between px-5 py-4 transition-colors duration-300",
                tracked ? "bg-gradient-to-r from-teal/5 to-teal/10" : "bg-gradient-to-r from-warm/20 to-warm/5"
            )}>
                <div className="flex items-center gap-2.5">
                    <div className={cx(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 group-hover/card:scale-110",
                        tracked ? "bg-teal/10 text-teal ring-1 ring-teal/20" : "bg-warm/30 text-ink-muted ring-1 ring-warm/40"
                    )}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-ink">{section.name}</h3>
                </div>
                <span className={cx(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                    tracked ? "bg-white/50 text-teal-dark ring-teal/20" : "bg-white/50 text-ink-subtle ring-warm/30"
                )}>
                    <Sparkles className={cx("h-3 w-3", tracked ? "text-teal/60" : "text-ink-subtle/50")} />
                    {loading ? "…" : quantity}
                </span>
            </div>
            <div className="p-5 pt-4">
                {tracked && (
                    <div className="mb-3 flex items-center justify-between rounded-xl bg-white/40 px-3.5 py-2.5 ring-1 ring-white/30">
                        <span className="text-xs font-medium text-ink-muted">Total value</span>
                        <span className="text-sm font-bold text-ink">{loading ? "…" : PHP.format(totalValue)}</span>
                    </div>
                )}
                {tracked && (
                    <div className="flex items-center justify-between rounded-xl bg-white/40 px-3.5 py-2.5 ring-1 ring-white/30">
                        <span className="text-xs font-medium text-ink-muted">Total Assets</span>
                        <span className="text-sm font-bold text-ink">{loading ? "…" : quantity.toLocaleString()}</span>
                    </div>
                )}
                {!tracked && (
                    <div className="mb-3 flex flex-col items-center justify-center rounded-xl bg-white/30 px-3.5 py-4 ring-1 ring-white/20">
                        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-warm/30">
                            <Icon className="h-4 w-4 text-ink-subtle/50" />
                        </div>
                        <p className="text-xs text-ink-subtle">Not yet tracked</p>
                    </div>
                )}
                {section.children && section.children.length > 0 && (
                    <div className="border-t border-white/20 pt-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle/70">Sub-Locations</p>
                        <ul className="space-y-1">
                            {section.children.map((child) => (
                                <li key={child} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-ink-muted transition-all duration-200 hover:bg-white/40">
                                    <span className="flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-teal/60" />
                                        {child}
                                    </span>
                                    <span className="text-xs font-medium text-ink-subtle">
                                        {loading ? "…" : (childCounts[child] ?? 0)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}