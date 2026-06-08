import { useEffect, useMemo, useState } from "react";
import { Grid3x3, ChevronLeft, ChevronRight } from "lucide-react";
import { listAllAssets, type AssetLocation } from "../services";

const LOCATIONS = [
    { key: "office", label: "Main Office", headerBg: "bg-yellow-100", headerText: "text-ink" },
    { key: "drawcourt", label: "Drawcourt", headerBg: "bg-green-100", headerText: "text-ink" },
    { key: "pcso", label: "PCSO", headerBg: "bg-blue-100", headerText: "text-ink" },
    { key: "payout", label: "Payout Station", headerBg: "bg-pink-100", headerText: "text-ink" },
    { key: "obs", label: "OBS Office", headerBg: "bg-indigo-100", headerText: "text-ink" },
    { key: "staffhouse", label: "Staffhouse", headerBg: "bg-slate-200", headerText: "text-ink" },
    { key: "vehicle", label: "Vehicle", headerBg: "bg-emerald-200", headerText: "text-ink" },
] as const;

// Fallback list used when the DB has no asset rows yet. Keeps the
// spreadsheet look-and-feel on first-load / empty-DB scenarios.
const SAMPLE_ASSETS = [
    "ACJU",
    "CONTROL CABLE",
    "BILL COUNTER",
    "FACIAL BIOMETRIC",
    "CALCULATOR",
    "CCTV",
    "CHAIR: MONOBLOCK CHAIR",
    "CHAIR: MONOBLOCK HIGH CHAIR",
    "CHAIR: ARMREST, LIGHT BROWN",
    "CHAIR: OFFICE CHAIR",
    "CHAIR: DINING CHAIR",
    "CHAIR: FOLDING ARM CHAIR",
    "CHAIR: FOLDABLE CAMPING CHAIR",
    "DRAWER: PLASTIC SLIDING DRAWER",
    "DRAWBALL MACHINE",
    "DRBC - DRAWBALL CASE",
    "EMERGENCY LIGHT",
    "FIRE EXTINGUISHER",
    "GENERATOR",
    "MOBILE PHONE",
    "MONEY DETECTOR",
    "SAFETY VAULT",
    "TABLET",
    "PRINTER",
    "ROUTER",
    "SWITCH",
    "UPS",
    "STABILIZER",
    "WALKIE TALKIE",
    "WHITEBOARD",
    "BULLETIN BOARD",
    "FILING CABINET",
    "OFFICE DESK",
    "OFFICE CHAIR (EXECUTIVE)",
    "SOFA SET",
    "COFFEE TABLE",
    "BOOKSHELF",
    "STANDING FAN",
    "DESK LAMP",
    "EXTENSION CORD",
    "POWER STRIP",
    "DOOR LOCK",
    "KEY CABINET",
    "SAFE BOX",
    "FIRST AID KIT",
    "FIRE EXTINGUISHER (SMALL)",
    "EMERGENCY LIGHT (LED)",
    "BATTERY PACK",
    "CABLE TRAY",
    "PATCH CORD",
    "SERVER RACK",
    "TOOLS SET",
];

const PAGE_SIZE = 20;
type LocationKey = (typeof LOCATIONS)[number]["key"];

interface MatrixAssetRow {
    id: string | number;
    name: string;
    location: AssetLocation;
    quantity: number;
}

export default function SummaryReportPage() {
    const [rows, setRows] = useState<MatrixAssetRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);

    // Fetch live asset data once on mount.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError("");
                const data = await listAllAssets();
                if (cancelled) return;
                setRows(
                    data.map((a) => ({
                        id: a.id,
                        name: (a.itemDescription ?? "").trim(),
                        location: a.location,
                        quantity: Number(a.quantity ?? 0),
                    }))
                );
            } catch (err) {
                if (cancelled) return;
                setError(
                    err instanceof Error
                        ? err.message
                        : "Could not load distribution data"
                );
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    /**
     * Build the pivot: unique asset names × locations.
     *  - rows: deduplicated + sorted `itemDescription` values
     *  - cells: sum of `quantity` for that (name, location) pair
     *  - totals: row sum across all locations
     */
    const { assetNames, cellValue, rowTotal } = useMemo(() => {
        const names = new Set<string>();
        const cells = new Map<string, Map<LocationKey, number>>();

        for (const r of rows) {
            if (!r.name) continue;
            // Skip "PCSO" cells — that location isn't a real AssetLocation value.
            // Users may still want to see the column header, but the data
            // simply doesn't exist for it in the backend today.
            if (r.location === ("pcso" as unknown as AssetLocation)) continue;

            names.add(r.name);
            const locKey = r.location as LocationKey;
            const rowMap = cells.get(r.name) ?? new Map<LocationKey, number>();
            rowMap.set(locKey, (rowMap.get(locKey) ?? 0) + r.quantity);
            cells.set(r.name, rowMap);
        }

        const sortedNames = Array.from(names).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" })
        );

        const lookupCell = (name: string, loc: LocationKey): number =>
            cells.get(name)?.get(loc) ?? 0;

        const lookupRowTotal = (name: string): number => {
            const rowMap = cells.get(name);
            if (!rowMap) return 0;
            let total = 0;
            for (const v of rowMap.values()) total += v;
            return total;
        };

        return {
            assetNames: sortedNames,
            cellValue: lookupCell,
            rowTotal: lookupRowTotal,
        };
    }, [rows]);

    /**
     * If the DB is empty, fall back to the SAMPLE_ASSETS placeholder list
     * so the page still renders a sensible spreadsheet shape on first load.
     */
    const displayNames = useMemo(
        () => (assetNames.length > 0 ? assetNames : SAMPLE_ASSETS),
        [assetNames]
    );

    // Note: we intentionally do NOT reset `page` to 1 via a set-state
    // effect when the underlying data changes. The `Math.min(page,
    // totalPages)` clamp below keeps the user on a valid page after
    // the data shrinks, and is the React-idiomatic pattern. Resetting
    // via useEffect triggers the `react-hooks/set-state-in-effect`
    // linter rule and causes a cascading render.

    const totalPages = Math.max(1, Math.ceil(displayNames.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PAGE_SIZE;
    const pageEnd = pageStart + PAGE_SIZE;
    const pagedNames = useMemo(
        () => displayNames.slice(pageStart, pageEnd),
        [displayNames, pageStart, pageEnd]
    );

    const goPrev = () => setPage((p) => Math.max(1, p - 1));
    const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

    // When real data is showing, the rowTotal is meaningful.
    // When the SAMPLE fallback is showing, the totals would be 0 — hide
    // them so the empty-DB state matches the original screenshot exactly.
    const isShowingFallback = assetNames.length === 0;

    return (
        <div className="space-y-4">
            {/* Title bar */}
            <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-3 text-white">
                <Grid3x3 size={18} className="text-white" />
                <h2 className="text-sm font-semibold tracking-wide uppercase">
                    Actual Distribution
                </h2>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* Distribution matrix */}
            <div className="overflow-x-auto rounded-lg border border-warm bg-white">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr>
                            <th className="bg-slate-50 px-4 py-3 text-left font-bold text-ink uppercase tracking-wider text-xs border border-slate-200 min-w-45">
                                Asset Name
                            </th>
                            {LOCATIONS.map((loc) => (
                                <th
                                    key={loc.key}
                                    className={`${loc.headerBg} ${loc.headerText} px-3 py-3 text-center font-bold uppercase tracking-wider text-xs border border-slate-200 min-w-22.5`}
                                >
                                    {loc.label}
                                </th>
                            ))}
                            <th className="bg-blue-600 px-3 py-3 text-center font-bold text-white uppercase tracking-wider text-xs border border-slate-200 min-w-20">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={LOCATIONS.length + 2}
                                    className="px-4 py-10 text-center text-ink-muted"
                                >
                                    Loading distribution data…
                                </td>
                            </tr>
                        ) : pagedNames.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={LOCATIONS.length + 2}
                                    className="px-4 py-10 text-center text-ink-subtle italic"
                                >
                                    No asset data available yet.
                                </td>
                            </tr>
                        ) : (
                            pagedNames.map((name, idx) => {
                                const total = isShowingFallback ? 0 : rowTotal(name);
                                return (
                                    <tr
                                        key={`${pageStart + idx}-${name}`}
                                        className="hover:bg-slate-50"
                                    >
                                        <td className="px-4 py-3 text-ink font-medium border border-slate-200">
                                            {name}
                                        </td>
                                        {LOCATIONS.map((loc) => {
                                            const value = isShowingFallback
                                                ? 0
                                                : cellValue(name, loc.key);
                                            return (
                                                <td
                                                    key={loc.key}
                                                    className="px-3 py-3 text-center text-ink border border-slate-200"
                                                >
                                                    {value > 0 ? value : ""}
                                                </td>
                                            );
                                        })}
                                        <td className="bg-blue-50 px-3 py-3 text-center text-ink font-semibold border border-slate-200">
                                            {total > 0 ? total : ""}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination footer */}
            <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                <p className="text-xs text-ink-subtle italic">
                    {isShowingFallback
                        ? "Showing placeholder list — connect the summary report data source to populate real counts."
                        : "Live distribution data — totals and counts reflect the current asset inventory."}
                </p>
                <div className="flex items-center gap-3 text-sm text-ink-muted">
                    <span className="text-xs">
                        Showing{" "}
                        <span className="font-semibold text-ink">
                            {pagedNames.length === 0
                                ? 0
                                : pageStart + 1}
                            –
                            <span className="font-semibold text-ink">
                                {Math.min(pageEnd, displayNames.length)}
                            </span>
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-ink">
                            {displayNames.length}
                        </span>
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={goPrev}
                            disabled={safePage <= 1}
                            aria-label="Previous page"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-warm bg-card text-ink transition hover:bg-warm/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-2 text-xs font-semibold text-ink">
                            Page {safePage} / {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={safePage >= totalPages}
                            aria-label="Next page"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-warm bg-card text-ink transition hover:bg-warm/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
