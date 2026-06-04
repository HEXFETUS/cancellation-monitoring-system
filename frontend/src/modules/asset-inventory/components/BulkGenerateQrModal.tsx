import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search, X } from "lucide-react";
import {
    type AssetCode,
    type AssetCodeInput,
    createAssetCode,
} from "../services/assetCodes";
import { listAllAssets, type AssetLocation } from "../services";
import {
    listPayoutStations,
    type PayoutStation,
} from "../services/payoutStations";
import type { AssetRow } from "./AssetTable";

type AssetWithLocation = AssetRow & { location: AssetLocation };

interface Props {
    open: boolean;
    existingCodes: AssetCode[];
    onClose: () => void;
    onGenerated: () => Promise<void>;
}

const LOCATION_CODE: Record<AssetLocation, string> = {
    office: "OFC",
    payout: "PAY",
    drawcourt: "DRW",
    obs: "OBS",
    staffhouse: "STH",
    vehicle: "VEH",
};

function buildPrefix(asset: AssetWithLocation, stations: PayoutStation[]): string {
    const loc = LOCATION_CODE[asset.location] ?? "AST";
    if (asset.location === "payout") {
        const station =
            stations.find((s) => s.id === asset.payoutStationId)?.stationCode ??
            (asset.space || "").toUpperCase();
        return `${station || "STN"}-${loc}`;
    }
    return loc;
}

/** Walk existing codes for the same prefix and return the next sequence number. */
function nextSequence(existing: AssetCode[], prefix: string, alreadyAssigned: number): string {
    const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
    let max = 0;
    for (const c of existing) {
        const m = re.exec(c.itemCode || "");
        if (m) {
            const n = Number(m[1]);
            if (Number.isFinite(n) && n > max) max = n;
        }
    }
    return String(max + 1 + alreadyAssigned).padStart(3, "0");
}

export default function BulkGenerateQrModal({
    open,
    existingCodes,
    onClose,
    onGenerated,
}: Props) {
    const [assets, setAssets] = useState<AssetWithLocation[]>([]);
    const [stations, setStations] = useState<PayoutStation[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [locationFilter, setLocationFilter] = useState<"all" | AssetLocation>("all");
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [error, setError] = useState("");
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!open) return;
        setSelected(new Set());
        setSearch("");
        setLocationFilter("all");
        setError("");
        setProgress(0);
        setLoading(true);
        Promise.all([listAllAssets(), listPayoutStations()])
            .then(([a, s]) => {
                setAssets(a);
                setStations(s);
            })
            .catch((e) => setError(e.message || "Could not load data"))
            .finally(() => setLoading(false));
    }, [open]);

    /** Set of asset IDs that already have at least one QR code. */
    const codedAssetIds = useMemo(() => {
        const s = new Set<number>();
        for (const c of existingCodes) {
            if (c.assetId !== null && c.assetId !== undefined) s.add(c.assetId);
        }
        return s;
    }, [existingCodes]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return assets.filter((a) => {
            if (locationFilter !== "all" && a.location !== locationFilter) return false;
            if (!q) return true;
            return [
                a.itemDescription,
                a.serialNumber,
                a.department,
                a.space,
                a.location,
                a.type,
            ]
                .join(" ")
                .toLowerCase()
                .includes(q);
        });
    }, [assets, search, locationFilter]);

    const toggle = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllVisible = () => {
        const allVisible = filtered.every((a) => selected.has(a.id as number));
        setSelected((prev) => {
            const next = new Set(prev);
            if (allVisible) {
                filtered.forEach((a) => next.delete(a.id as number));
            } else {
                filtered.forEach((a) => next.add(a.id as number));
            }
            return next;
        });
    };

    const handleGenerate = async () => {
        if (selected.size === 0) {
            setError("Pick at least one asset");
            return;
        }
        setRunning(true);
        setError("");
        setProgress(0);

        // Track how many codes we've assigned for each prefix in this batch so
        // sequence numbers don't collide.
        const perPrefixAssigned = new Map<string, number>();
        const errors: string[] = [];
        let done = 0;

        const picks = assets.filter((a) => selected.has(a.id as number));
        for (const asset of picks) {
            const prefix = buildPrefix(asset, stations);
            const used = perPrefixAssigned.get(prefix) ?? 0;
            const seq = nextSequence(existingCodes, prefix, used);
            const itemCode = `${prefix}-${seq}`;

            const codeDept =
                asset.location === "payout"
                    ? (asset.space || "").trim()
                    : (asset.department || "").trim();
            const input: AssetCodeInput = {
                itemCode,
                description: asset.itemDescription,
                type: asset.type || "",
                department: codeDept,
                careOf: "",
                space: asset.space || "",
                assetId: asset.id as number,
            };

            try {
                await createAssetCode(input);
                perPrefixAssigned.set(prefix, used + 1);
            } catch (e) {
                errors.push(`${asset.itemDescription}: ${(e instanceof Error ? e.message : String(e)) ?? "failed"}`);
            }
            done += 1;
            setProgress(done);
        }

        if (errors.length) {
            setError(`Done with ${errors.length} error(s):\n${errors.join("\n")}`);
        }
        await onGenerated();
        setRunning(false);
        if (errors.length === 0) onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="flex w-full max-w-3xl flex-col rounded-2xl border border-warm bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-warm px-6 py-4">
                    <h3 className="text-lg font-semibold text-ink">Generate QR Codes</h3>
                    <button
                        onClick={onClose}
                        disabled={running}
                        className="rounded-lg p-1 text-ink-subtle transition hover:bg-cream hover:text-ink disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-col gap-3 border-b border-warm px-6 py-4">
                    {error && (
                        <div className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle dark:text-gray-500"
                                size={16}
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search items..."
                                disabled={running}
                                className="w-full rounded-lg border border-warm dark:border-gray-700 bg-card dark:bg-gray-800/70 pl-9 pr-3 py-2 text-sm text-ink dark:text-gray-100 placeholder:text-ink-subtle dark:placeholder:text-gray-400 focus:border-teal dark:focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal dark:focus:ring-teal/50 disabled:opacity-50"
                            />
                        </div>

                        <select
                            value={locationFilter}
                            onChange={(e) =>
                                setLocationFilter(
                                    e.target.value as "all" | AssetLocation
                                )
                            }
                            disabled={running}
                            className="rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal disabled:opacity-50"
                        >
                            <option value="all">All locations</option>
                            <option value="office">Office</option>
                            <option value="payout">Payout</option>
                            <option value="drawcourt">Drawcourt</option>
                            <option value="obs">OBS</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between text-xs text-ink-muted">
                        <button
                            type="button"
                            onClick={toggleAllVisible}
                            disabled={running || filtered.length === 0}
                            className="rounded-md px-2 py-0.5 hover:bg-cream disabled:opacity-50"
                        >
                            Toggle all visible ({filtered.length})
                        </button>
                        <span>
                            {selected.size} selected · {assets.length} total assets
                        </span>
                    </div>
                </div>

                <div className="max-h-[50vh] flex-1 overflow-y-auto px-2 py-2">
                    {loading ? (
                        <p className="px-3 py-6 text-center text-sm text-ink-subtle">
                            Loading assets...
                        </p>
                    ) : filtered.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-ink-subtle">
                            {assets.length === 0
                                ? "No assets exist yet. Create some under Office/Payout/Drawcourt/OBS first."
                                : "No assets match your search."}
                        </p>
                    ) : (
                        <ul className="divide-y divide-warm/60">
                            {filtered.map((a) => {
                                const id = a.id as number;
                                const isPicked = selected.has(id);
                                const alreadyCoded = codedAssetIds.has(id);
                                const station =
                                    a.location === "payout"
                                        ? stations.find((s) => s.id === a.payoutStationId)?.stationCode
                                        : null;
                                return (
                                    <li key={id}>
                                        <label
                                            className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition ${isPicked ? "bg-teal/10" : "hover:bg-cream"
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isPicked}
                                                onChange={() => toggle(id)}
                                                disabled={running}
                                                className="h-4 w-4 cursor-pointer accent-teal"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-ink">
                                                    {a.itemDescription}
                                                </span>
                                                <span className="block truncate text-xs text-ink-muted">
                                                    {a.location.toUpperCase()}
                                                    {station ? ` · ${station}` : ""}
                                                    {a.serialNumber ? ` · ${a.serialNumber}` : ""}
                                                    {a.space ? ` · ${a.space}` : ""}
                                                </span>
                                            </span>
                                            {alreadyCoded && (
                                                <span
                                                    className="inline-flex items-center gap-1 rounded-full bg-peach/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink"
                                                    title="This asset already has a QR code. Generating another will create a duplicate code linked to the same asset."
                                                >
                                                    <CheckCircle2 size={10} /> coded
                                                </span>
                                            )}
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-warm bg-cream px-6 py-4">
                    {running ? (
                        <span className="text-xs text-ink-muted">
                            Generating {progress} of {selected.size}...
                        </span>
                    ) : (
                        <span className="text-xs text-ink-muted">
                            QR codes will use prefixes like CDO-PAY-001 / OFC-001.
                        </span>
                    )}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={running}
                            className="rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={running || selected.size === 0}
                            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                        >
                            {running
                                ? `Generating ${progress}/${selected.size}...`
                                : `Generate ${selected.size} QR Code${selected.size === 1 ? "" : "s"}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
