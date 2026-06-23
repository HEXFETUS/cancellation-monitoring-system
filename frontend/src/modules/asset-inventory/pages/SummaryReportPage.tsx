import { useEffect, useMemo, useState } from "react";
import { listAllAssets, type AssetLocation } from "../services";
import { Pagination } from "../../../shared/components";

const LOCATIONS = [
    { key: "office", label: "Main Office" },
    { key: "drawcourt", label: "Drawcourt" },
    { key: "pcso", label: "PCSO" },
    { key: "payout", label: "Payout Station" },
    { key: "obs", label: "OBS Office" },
    { key: "staffhouse", label: "Staffhouse" },
    { key: "vehicle", label: "Vehicle" },
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

    const totalPages = Math.max(1, Math.ceil(displayNames.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PAGE_SIZE;
    const pageEnd = pageStart + PAGE_SIZE;
    const pagedNames = useMemo(
        () => displayNames.slice(pageStart, pageEnd),
        [displayNames, pageStart, pageEnd]
    );

    // When real data is showing, the rowTotal is meaningful.
    // When the SAMPLE fallback is showing, the totals would be 0 — hide
    // them so the empty-DB state matches the original screenshot exactly.
    const isShowingFallback = assetNames.length === 0;

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* Distribution matrix */}
            <div className="overflow-x-auto rounded-2xl border border-warm bg-card shadow-sm">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr>
                            <th className="bg-cream px-4 py-3 text-left font-bold text-ink uppercase tracking-wider text-xs border-b border-warm min-w-45">
                                Asset Name
                            </th>
                            {LOCATIONS.map((loc) => (
                                <th
                                    key={loc.key}
                                    className="bg-cream px-3 py-3 text-center font-bold text-ink uppercase tracking-wider text-xs border-b border-warm min-w-22.5"
                                >
                                    {loc.label}
                                </th>
                            ))}
                            <th className="bg-teal/10 px-3 py-3 text-center font-bold text-teal-dark uppercase tracking-wider text-xs border-b border-warm min-w-20">
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
                                        className="hover:bg-cream transition"
                                    >
                                        <td className="px-4 py-3 text-ink font-medium border-b border-warm/50">
                                            {name}
                                        </td>
                                        {LOCATIONS.map((loc) => {
                                            const value = isShowingFallback
                                                ? 0
                                                : cellValue(name, loc.key);
                                            return (
                                                <td
                                                    key={loc.key}
                                                    className="px-3 py-3 text-center text-ink border-b border-warm/50"
                                                >
                                                    {value > 0 ? value : ""}
                                                </td>
                                            );
                                        })}
                                        <td className="bg-teal/5 px-3 py-3 text-center text-ink font-semibold border-b border-warm/50">
                                            {total > 0 ? total : ""}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* Shared pagination */}
                <Pagination
                    currentPage={safePage}
                    totalPages={totalPages}
                    totalItems={displayNames.length}
                    onPageChange={setPage}
                    pageSize={PAGE_SIZE}
                />
            </div>
        </div>
    );
}