import { useEffect, useMemo, useState } from "react";
import { Search, X, Plus, Pencil, CheckCircle2, Info } from "lucide-react";
import {
    type AssetCode,
    type AssetCodeInput,
    listAssetCodes,
} from "../services/assetCodes";
import type { AssetRow } from "./AssetTable";
import { listAllAssets, type AssetLocation } from "../services";
import ConfirmationModal from "../../../shared/components/ConfirmationModal";

type AssetWithLocation = AssetRow & { location: AssetLocation };

interface Props {
    open: boolean;
    initial?: AssetCode | null;
    locationFilter?: AssetLocation | null;
    onClose: () => void;
    onSubmit: (values: AssetCodeInput) => Promise<void>;
}

/** Short location code used in the middle of an item code (e.g. PAY for Payout). */
const LOCATION_CODE: Record<AssetLocation, string> = {
    office: "OFC",
    payout: "PAY",
    drawcourt: "DRW",
    obs: "OBS",
    staffhouse: "STH",
    vehicle: "VEH",
};

/**
 * Map a payout asset's `space` (CDO / WEST / EAST) to a station prefix.
 * Returns null when the space doesn't map cleanly so the caller can fall back.
 */
function payoutStationCode(space: string | null | undefined): string | null {
    const s = (space || "").trim().toUpperCase();
    if (s === "CDO") return "CDO";
    if (s === "WEST" || s === "MOW") return "MOW"; // Misamis Oriental West
    if (s === "EAST" || s === "MOE") return "MOE"; // Misamis Oriental East
    return null;
}

/**
 * Build an item code prefix string. For payout, includes the station:
 *   CDO-PAY, MOE-PAY, MOW-PAY
 * For all other locations, just the location code:
 *   OFC, DRW, OBS
 */
function buildPrefix(asset: AssetWithLocation): string {
    const loc = LOCATION_CODE[asset.location] ?? "AST";
    if (asset.location === "payout") {
        const station = payoutStationCode(asset.space) ?? "STN";
        return `${station}-${loc}`;
    }
    return loc;
}

/**
 * Find the next sequence number for a given prefix by scanning existing
 * item codes. Falls back to `001` when nothing matches.
 */
function nextSequence(existing: AssetCode[], prefix: string): string {
    const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
    let max = 0;
    for (const c of existing) {
        const m = re.exec(c.itemCode || "");
        if (m) {
            const n = Number(m[1]);
            if (Number.isFinite(n) && n > max) max = n;
        }
    }
    return String(max + 1).padStart(3, "0");
}

function suggestItemCode(asset: AssetWithLocation, existing: AssetCode[]): string {
    const prefix = buildPrefix(asset);
    return `${prefix}-${nextSequence(existing, prefix)}`;
}

const EMPTY: AssetCodeInput = {
    itemCode: "",
    description: "",
    type: "",
    department: "",
    careOf: "",
    space: "",
    assetId: null,
};

export default function AssetCodeFormModal({ open, initial, locationFilter, onClose, onSubmit }: Props) {
    const [v, setV] = useState<AssetCodeInput>(EMPTY);
    const [initialValues, setInitialValues] = useState<AssetCodeInput | null>(null);
    const [err, setErr] = useState("");
    const [saving, setSaving] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Asset picker state
    const [assets, setAssets] = useState<AssetWithLocation[]>([]);
    const [existingCodes, setExistingCodes] = useState<AssetCode[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [assetSearch, setAssetSearch] = useState("");
    const [pickedAssetId, setPickedAssetId] = useState<number | null>(null);
    const [pickerLocation, setPickerLocation] = useState<AssetLocation | null>(null);

    // Load assets and existing codes every time the modal opens
    useEffect(() => {
        if (!open) return;

        setErr("");
        setShowConfirm(false);
        if (initial) {
            const initV: AssetCodeInput = {
                itemCode: initial.itemCode,
                description: initial.description,
                type: initial.type,
                department: initial.department,
                careOf: initial.careOf,
                space: initial.space,
                assetId: initial.assetId,
            };
            setV(initV);
            setInitialValues(initV);
            setPickedAssetId(initial.assetId);
        } else {
            setV(EMPTY);
            setInitialValues(null);
            setPickedAssetId(null);
        }
        setPickerLocation(locationFilter ?? null);

        setAssetsLoading(true);
        Promise.all([listAllAssets(), listAssetCodes()])
            .then(([a, c]) => {
                setAssets(a);
                setExistingCodes(c);
            })
            .catch((e) => setErr(e.message || "Could not load assets"))
            .finally(() => setAssetsLoading(false));
    }, [open, initial, locationFilter]);

    const filteredAssets = useMemo(() => {
        const q = assetSearch.trim().toLowerCase();
        let list = assets;
        // Pre-filter by location when a filter is selected
        if (pickerLocation) {
            if (pickerLocation === "vehicle") {
                // Vehicle: match by type column instead of location
                list = list.filter((a) => (a.type ?? "").trim().toLowerCase() === "vehicle");
            } else {
                list = list.filter((a) => a.location === pickerLocation);
            }
        }
        if (!q) return list;
        return list.filter((a) =>
            [a.itemDescription, a.serialNumber, a.department, a.space, a.location, a.type]
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assets, assetSearch, pickerLocation]);

    // Derive matching asset codes from the asset_coding table for OBS filter
    // (asset_coding has its own department column independent of asset_inv.location)
    const matchingAssetCodes = useMemo(() => {
        if (!pickerLocation || pickerLocation !== "obs") return [];
        const q = assetSearch.trim().toLowerCase();
        return existingCodes.filter((c) => {
            const dept = (c.department ?? "").trim().toLowerCase();
            const matchesDept = dept === "obs" || dept === "obs office";
            if (!matchesDept) return false;
            if (!q) return true;
            return [c.itemCode, c.description, c.type, c.department, c.careOf, c.space]
                .join(" ")
                .toLowerCase()
                .includes(q);
        });
    }, [pickerLocation, existingCodes, assetSearch]);

    const handlePickAsset = (asset: AssetWithLocation) => {
        setPickedAssetId(asset.id as number);
        // For payout, the "department" we want to record on the code is the
        // station code (CDO-001, MOE, etc.), which the asset stores in `space`.
        // For everything else, use the asset's department as-is (role name).
        const codeDept =
            asset.location === "payout"
                ? (asset.space || "").trim()
                : (asset.department || "").trim();
        setV({
            itemCode: suggestItemCode(asset, existingCodes),
            description: asset.itemDescription,
            type: asset.type || "",
            department: codeDept,
            careOf: "",
            space: asset.space || "",
            assetId: Number(asset.id),
        });
    };

    /**
     * Edit-mode helper: regenerate the item code based on the currently linked asset
     * using the new station-aware convention. Useful when migrating older codes.
     */
    const handleSyncCode = () => {
        const linked = assets.find((a) => a.id === v.assetId);
        if (!linked) {
            setErr("This code has no linked asset, can't sync.");
            return;
        }
        // Pretend the current code doesn't exist so the sequence is correct.
        const codesWithoutSelf = initial
            ? existingCodes.filter((c) => c.id !== initial.id)
            : existingCodes;
        setV((prev) => {
            const codeDept =
                linked.location === "payout"
                    ? (linked.space || "").trim() || prev.department
                    : (linked.department || "").trim() || prev.department;
            return {
                ...prev,
                itemCode: suggestItemCode(linked, codesWithoutSelf),
                space: linked.space || prev.space,
                department: codeDept,
            };
        });
        setErr("");
    };

    const set = <K extends keyof AssetCodeInput>(k: K, val: AssetCodeInput[K]) =>
        setV((prev) => ({ ...prev, [k]: val }));

    // Check if required fields are filled
    const isMissingRequired = !v.itemCode.trim() || !v.type.trim() || !v.department.trim() || !v.space.trim();

    // Check if any changes were made (for edit mode)
    const hasChanges: boolean = initialValues
        ? JSON.stringify(v) !== JSON.stringify(initialValues)
        : true;

    // Step 1: Validate and show confirmation
    const handleSubmitClick = (e: React.FormEvent) => {
        e.preventDefault();
        if (!v.itemCode.trim() || !v.type.trim() || !v.department.trim() || !v.space.trim()) {
            setErr("Item code, type, department, and space are required");
            return;
        }
        setErr("");
        setShowConfirm(true);
    };

    // Step 2: Actually save after confirmation
    const handleConfirmSave = async () => {
        setSaving(true);
        setErr("");
        try {
            await onSubmit(v);
            setShowConfirm(false);
            onClose();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Save failed");
            setShowConfirm(false);
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const pickedAsset = pickedAssetId ? assets.find((a) => Number(a.id) === pickedAssetId) : null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-sm pt-8 pb-8">
                <div className="w-full max-w-3xl rounded-2xl border border-warm bg-white shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-warm bg-linear-to-r from-teal-50 to-white px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-teal-200">
                                {initial ? (
                                    <Pencil size={18} className="text-teal" />
                                ) : (
                                    <Plus size={18} className="text-teal" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-ink">
                                    {initial ? "Edit Asset Code" : "Add Asset Code"}
                                </h3>
                                {!initial && (
                                    <p className="text-xs text-ink-muted">Generate a new item code from an existing asset</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-ink-subtle transition hover:bg-cream hover:text-ink"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmitClick} className="max-h-[70vh] space-y-5 overflow-y-auto bg-slate-50/50 px-6 py-5">
                        {err && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">!</span>
                                {err}
                            </div>
                        )}

                        {/* Asset picker (only for new codes) */}
                        {!initial && (
                            <section className="rounded-xl border border-warm bg-white p-4 shadow-sm">
                                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">
                                    Pick the asset
                                </h4>

                                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <select
                                        value={pickerLocation ?? ""}
                                        onChange={(e) => setPickerLocation((e.target.value as AssetLocation) || null)}
                                        className="rounded-lg border border-warm bg-white px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                                    >
                                        <option value="">All locations</option>
                                        <option value="office">Office</option>
                                        <option value="payout">Payout</option>
                                        <option value="drawcourt">Drawcourt</option>
                                        <option value="obs">OBS</option>
                                        <option value="staffhouse">Staffhouse</option>
                                        <option value="vehicle">Vehicle</option>
                                    </select>
                                    <div className="relative flex-1">
                                        <Search
                                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
                                            size={16}
                                        />
                                        <input
                                            type="text"
                                            value={assetSearch}
                                            onChange={(e) => setAssetSearch(e.target.value)}
                                            placeholder="Search assets by description, serial, location..."
                                            className="w-full rounded-lg border border-warm bg-white pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                                        />
                                    </div>
                                </div>

                                <div className="max-h-56 overflow-y-auto rounded-xl border border-warm bg-white shadow-inner">
                                    {assetsLoading ? (
                                        <div className="flex items-center justify-center gap-2 px-3 py-6">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                                            <p className="text-sm text-ink-subtle">Loading assets…</p>
                                        </div>
                                    ) : filteredAssets.length === 0 && matchingAssetCodes.length === 0 ? (
                                        <div className="px-4 py-6 text-center">
                                            <p className="text-sm font-medium text-ink">
                                                {assets.length === 0
                                                    ? "No assets in the system yet."
                                                    : "No assets match your search."}
                                            </p>
                                            <p className="mt-1 text-xs text-ink-muted">
                                                {assets.length === 0
                                                    ? "Create an asset first under Office / Payout / Drawcourt / OBS."
                                                    : "Try a different search term."}
                                            </p>
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-warm/60">
                                            {filteredAssets.map((a) => {
                                                const picked = pickedAssetId === a.id;
                                                return (
                                                    <li key={a.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePickAsset(a)}
                                                            className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition ${picked
                                                                ? "border-l-4 border-l-teal bg-teal/10"
                                                                : "border-l-4 border-l-transparent hover:bg-cream"
                                                                }`}
                                                        >
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate font-medium text-ink">
                                                                    {a.itemDescription}
                                                                </span>
                                                                <span className="block truncate text-xs text-ink-muted">
                                                                    {(a.location ?? "").toUpperCase()} ·{" "}
                                                                    {a.serialNumber || "no serial"} ·{" "}
                                                                    {a.space || "—"}
                                                                </span>
                                                            </span>
                                                            {picked && (
                                                                <span className="flex items-center gap-1 rounded-full bg-teal px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
                                                                    <CheckCircle2 size={12} />
                                                                    Selected
                                                                </span>
                                                            )}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                            {/* Show matching asset codes from asset_coding when OBS filter is active */}
                                            {matchingAssetCodes.map((c) => (
                                                <li key={`code-${c.id}`}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPickedAssetId(null);
                                                            setV({
                                                                itemCode: c.itemCode,
                                                                description: c.description,
                                                                type: c.type,
                                                                department: c.department,
                                                                careOf: c.careOf,
                                                                space: c.space,
                                                                assetId: c.assetId,
                                                            });
                                                        }}
                                                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition border-l-4 border-l-transparent hover:bg-cream"
                                                    >
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate font-medium text-ink">
                                                                {c.description}
                                                            </span>
                                                            <span className="block truncate text-xs text-ink-muted">
                                                                OBS · {c.itemCode} · {c.department || "—"}
                                                            </span>
                                                        </span>
                                                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                                                            Existing code
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </section>
                        )}

                        <section className="rounded-xl border border-warm bg-white p-4 shadow-sm">
                            {initial && v.assetId && (
                                <div className="mb-4 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSyncCode}
                                        className="rounded-lg border border-teal/40 bg-teal/10 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-teal/20"
                                        title="Regenerate item code using station-aware convention"
                                    >
                                        Sync to station code
                                    </button>
                                </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Item Code" required>
                                    <Input
                                        value={v.itemCode}
                                        onChange={(s) => set("itemCode", s)}
                                        placeholder="e.g. OFC-001"
                                        required
                                    />
                                </Field>
                                <Field label="Description">
                                    <Input
                                        value={v.description}
                                        onChange={(s) => set("description", s)}
                                    />
                                </Field>
                                <Field label="Type" required>
                                    <Input value={v.type} onChange={(s) => set("type", s)} required />
                                </Field>
                                <Field label="Department" required>
                                    <Input
                                        value={v.department}
                                        onChange={(s) => set("department", s)}
                                        required
                                    />
                                </Field>
                                <Field label="Care Of">
                                    <Input value={v.careOf} onChange={(s) => set("careOf", s)} />
                                </Field>
                                <Field label="Space" required>
                                    <Input value={v.space} onChange={(s) => set("space", s)} required />
                                </Field>
                            </div>
                        </section>

                        {!initial && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                                <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
                                <span>A unique QR code will be auto-generated for the picked asset on save.</span>
                            </div>
                        )}
                    </form>

                    {/* Footer */}
                    <div className="flex justify-end gap-2.5 border-t border-warm bg-slate-50 px-6 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmitClick}
                            disabled={!!(saving || isMissingRequired || (initial && !hasChanges))}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-5 py-2 text-sm font-bold text-ink shadow-sm transition hover:bg-teal-dark disabled:opacity-50 disabled:cursor-not-allowed"
                            title={
                                isMissingRequired
                                    ? "Please fill in all required fields"
                                    : initial && !hasChanges
                                        ? "No changes to update"
                                        : ""
                            }
                        >
                            {saving ? (
                                <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                                    Saving…
                                </>
                            ) : initial ? "Update Code" : "Add Code"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                open={showConfirm}
                variant="save"
                title={initial ? "Update Asset Code?" : "Add Asset Code?"}
                message={`Please review the details below before ${initial ? "updating" : "adding"} this asset code.`}
                confirmLabel={initial ? "Yes, Update" : "Yes, Add"}
                cancelLabel="Go Back"
                isLoading={saving}
                loadingLabel={initial ? "Updating..." : "Adding..."}
                onCancel={() => setShowConfirm(false)}
                onConfirm={handleConfirmSave}
            >
                <div className="divide-y divide-warm/60 text-sm">
                    <SummaryRow label="Item Code" value={v.itemCode || "—"} />
                    <SummaryRow label="Description" value={v.description || "—"} />
                    <SummaryRow label="Type" value={v.type || "—"} />
                    <SummaryRow label="Department" value={v.department || "—"} />
                    <SummaryRow label="Care Of" value={v.careOf || "—"} />
                    <SummaryRow label="Space" value={v.space || "—"} />
                    {pickedAsset && (
                        <SummaryRow label="Linked Asset" value={pickedAsset.itemDescription} />
                    )}
                </div>
            </ConfirmationModal>
        </>
    );
}

/* ---------------- helpers ---------------- */

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between px-3 py-2">
            <span className="text-ink-muted font-medium">{label}</span>
            <span className="text-ink text-right max-w-[55%] truncate font-medium">{value}</span>
        </div>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
                {required && <span className="ml-0.5 text-rose-500">*</span>}
            </span>
            {children}
        </label>
    );
}

function Input({
    value,
    onChange,
    placeholder,
    required,
}: {
    value: string;
    onChange: (s: string) => void;
    placeholder?: string;
    required?: boolean;
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal transition-all"
        />
    );
}