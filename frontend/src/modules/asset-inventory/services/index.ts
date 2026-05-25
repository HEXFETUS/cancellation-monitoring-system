import type { AssetRow } from "../components/AssetTable";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type AssetLocation = "office" | "payout" | "drawcourt" | "obs";

/**
 * Wire-format used by the backend (snake_case + ISO dates).
 * Frontend uses camelCase (AssetRow), so we translate at the boundary.
 */
interface AssetWire {
    id: number;
    location: AssetLocation;
    item_description: string;
    type: string | null;
    serial_number: string | null;
    department: string | null;
    space: string | null;
    date_purchase: string | null;
    vendor: string | null;
    purchase_price: string | number;
    warranty_date: string | null;
    quantity: number;
    discount: string | number;
    asset_value: string | number;
    total_value: string | number;
    color: string | null;
    remarks: string | null;
}

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

async function getErrorMessage(res: Response, fallback: string) {
    try {
        const data = await res.json();
        return data.error || data.message || fallback;
    } catch {
        return fallback;
    }
}

function toIsoDate(value: string | null): string {
    if (!value) return "";
    // Postgres returns "2024-03-12T00:00:00.000Z"; we want "2024-03-12".
    return value.slice(0, 10);
}

function fromWire(w: AssetWire): AssetRow & { location: AssetLocation } {
    return {
        id: w.id,
        location: w.location,
        itemDescription: w.item_description,
        type: w.type ?? "",
        serialNumber: w.serial_number ?? "",
        department: w.department ?? "",
        space: w.space ?? "",
        datePurchase: toIsoDate(w.date_purchase),
        vendor: w.vendor ?? "",
        purchasePrice: Number(w.purchase_price ?? 0),
        warrantyDate: toIsoDate(w.warranty_date),
        quantity: Number(w.quantity ?? 1),
        discount: Number(w.discount ?? 0),
        assetValue: Number(w.asset_value ?? 0),
        totalValue: Number(w.total_value ?? 0),
        color: w.color ?? "",
        remarks: w.remarks ?? "",
    };
}

export type AssetInput = Omit<AssetRow, "id" | "totalValue"> & {
    location: AssetLocation;
};

export async function listAssets(location: AssetLocation): Promise<AssetRow[]> {
    const res = await fetch(apiUrl(`/api/assets?location=${location}`));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load assets"));
    const data: AssetWire[] = await res.json();
    return data.map(fromWire);
}

/** All assets across every location, plus the row's location for grouping. */
export async function listAllAssets(): Promise<Array<AssetRow & { location: AssetLocation }>> {
    const res = await fetch(apiUrl("/api/assets"));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load assets"));
    const data: AssetWire[] = await res.json();
    return data.map(fromWire);
}

export async function createAsset(input: AssetInput): Promise<AssetRow> {
    const res = await fetch(apiUrl("/api/assets"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to create asset"));
    return fromWire(await res.json());
}

export async function updateAsset(id: number, input: AssetInput): Promise<AssetRow> {
    const res = await fetch(apiUrl(`/api/assets/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to update asset"));
    return fromWire(await res.json());
}

export async function deleteAsset(id: number): Promise<void> {
    const res = await fetch(apiUrl(`/api/assets/${id}`), { method: "DELETE" });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to delete asset"));
}
