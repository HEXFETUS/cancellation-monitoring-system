import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { AssetCode, AssetCodeInput } from "../services/assetCodes";
import type { AssetRow } from "./AssetTable";
import { listAllAssets, type AssetLocation } from "../services";

type AssetWithLocation = AssetRow & { location: AssetLocation };

interface Props {
    open: boolean;
    initial?: AssetCode | null;
    onClose: () => void;
    onSubmit: (values: AssetCodeInput) => Promise<void>;
}

const LOCATION_PREFIX: Record<AssetLocation, string> = {
    office: "OFC",
    payout: "PYO",
    drawcourt: "DRW",
    obs: "OBS",
};

const LOCATION_DEPT: Record<AssetLocation, string> = {
    office: "Office",
    payout: "Payout",
    drawcourt: "Drawcourt",
    obs: "OBS",
};

function suggestItemCode(asset: AssetWithLocation): string {
    const prefix = LOCATION_PREFIX[asset.location] ?? "AST";
    return `${prefix}-${String(asset.id).padStart(3, "0")}`;
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

export default function AssetCodeFormModal({ open, initial, onClose, onSubmit }: Props) {
    const [v, setV] = useState<AssetCodeInput>(EMPTY);
    const [err, setErr] = useState("");
    const [saving, setSaving] = useState(false);

    // Asset picker state
    const [assets, setAssets] = useState<AssetWithLocation[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [assetSearch, setAssetSearch] = useState("");
    const [pickedAssetId, setPickedAssetId] = useState<number | null>(null);

    // Load assets every time the modal opens
    useEffect(() => {
        if (!open) return;

        setErr("");
        if (initial) {
            setV({
                itemCode: initial.itemCode,
                description: initial.description,
                type: initial.type,
                department: initial.department,
                careOf: initial.careOf,
                space: initial.space,
                assetId: initial.assetId,
            });
            setPickedAssetId(initial.assetId);
        } else {
            setV(EMPTY);
            setPickedAssetId(null);
        }

        setAssetsLoading(true);
        listAllAssets()
            .then(setAssets)
            .catch((e) => setErr(e.message || "Could not load assets"))
            .finally(() => setAssetsLoading(false));
    }, [open, initial]);

    const filteredAssets = useMemo(() => {
        const q = assetSearch.trim().toLowerCase();
        if (!q) return assets;
        return assets.filter((a) =>
            [a.itemDescription, a.serialNumber, a.department, a.space, a.location, a.type]
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [assets, assetSearch]);

    const handlePickAsset = (asset: AssetWithLocation) => {
        setPickedAssetId(asset.id as number);
        setV({
            itemCode: suggestItemCode(asset),
            description: asset.itemDescription,
            type: asset.type || "",
            department: asset.department || LOCATION_DEPT[asset.location] || "",
            careOf: "",
            space: asset.space || "",
            assetId: Number(asset.id),
        });
    };

    const set = <K extends keyof AssetCodeInput>(k: K, val: AssetCodeInput[K]) =>
        setV((prev) => ({ ...prev, [k]: val }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!v.itemCode.trim() || !v.description.trim()) {
            setErr("Item code and description are required");
            return;
        }
        if (!initial && !v.assetId) {
            setErr("Pick an asset to link this QR code to");
            return;
        }
        setSaving(true);
        setErr("");
        try {
            await onSubmit(v);
            onClose();
        } catch (e: any) {
            setErr(e.message || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-warm bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-warm px-6 py-4">
                    <h3 className="text-lg font-semibold text-ink">
                        {initial ? "Edit Asset Code" : "Add Asset Code"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-ink-subtle transition hover:bg-cream hover:text-ink"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={submit} className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
                    {err && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {err}
                        </div>
                    )}

                    {/* Asset picker (only for new codes) */}
                    {!initial && (
                        <section>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                1. Pick the asset
                            </h4>

                            <div className="relative mb-2">
                                <Search
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
                                    size={16}
                                />
                                <input
                                    type="text"
                                    value={assetSearch}
                                    onChange={(e) => setAssetSearch(e.target.value)}
                                    placeholder="Search assets by description, serial, location..."
                                    className="w-full rounded-lg border border-warm bg-card pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                                />
                            </div>

                            <div className="max-h-56 overflow-y-auto rounded-lg border border-warm bg-cream/50">
                                {assetsLoading ? (
                                    <p className="px-3 py-4 text-center text-sm text-ink-subtle">
                                        Loading assets...
                                    </p>
                                ) : filteredAssets.length === 0 ? (
                                    <p className="px-3 py-4 text-center text-sm text-ink-subtle">
                                        {assets.length === 0
                                            ? "No assets in the system yet. Create one first under Office/Payout/Drawcourt/OBS."
                                            : "No assets match your search."}
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-warm/60">
                                        {filteredAssets.map((a) => {
                                            const picked = pickedAssetId === a.id;
                                            return (
                                                <li key={a.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePickAsset(a)}
                                                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${picked
                                                            ? "bg-teal/15"
                                                            : "hover:bg-card"
                                                            }`}
                                                    >
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate font-medium text-ink">
                                                                {a.itemDescription}
                                                            </span>
                                                            <span className="block truncate text-xs text-ink-muted">
                                                                {a.location.toUpperCase()} ·{" "}
                                                                {a.serialNumber || "no serial"} ·{" "}
                                                                {a.space || "—"}
                                                            </span>
                                                        </span>
                                                        {picked && (
                                                            <span className="rounded-full bg-teal px-2 py-0.5 text-xs font-semibold text-ink">
                                                                Selected
                                                            </span>
                                                        )}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </section>
                    )}

                    <section>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            {initial ? "Edit details" : "2. Confirm details"}
                        </h4>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Item Code *">
                                <Input
                                    value={v.itemCode}
                                    onChange={(s) => set("itemCode", s)}
                                    placeholder="e.g. OFC-001"
                                    required
                                />
                            </Field>
                            <Field label="Description *">
                                <Input
                                    value={v.description}
                                    onChange={(s) => set("description", s)}
                                    required
                                />
                            </Field>
                            <Field label="Type">
                                <Input value={v.type} onChange={(s) => set("type", s)} />
                            </Field>
                            <Field label="Department">
                                <Input
                                    value={v.department}
                                    onChange={(s) => set("department", s)}
                                />
                            </Field>
                            <Field label="Care Of">
                                <Input value={v.careOf} onChange={(s) => set("careOf", s)} />
                            </Field>
                            <Field label="Space">
                                <Input value={v.space} onChange={(s) => set("space", s)} />
                            </Field>
                        </div>
                    </section>

                    {!initial && (
                        <p className="rounded-lg border border-teal/30 bg-teal/5 px-3 py-2 text-xs text-ink-muted">
                            A unique QR code will be auto-generated for the picked asset on save.
                        </p>
                    )}
                </form>

                <div className="flex justify-end gap-3 border-t border-warm bg-cream px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={saving}
                        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
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
            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
        />
    );
}
