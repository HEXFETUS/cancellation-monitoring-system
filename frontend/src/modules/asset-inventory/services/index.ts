import type { AssetRow } from "../components/AssetTable";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type AssetLocation =
    | "office"
    | "payout"
    | "drawcourt"
    | "obs"
    | "staffhouse"
    | "vehicle";

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
    payout_station_id: number | null;
    office_department_id: number | null;
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
        payoutStationId: w.payout_station_id,
        officeDepartmentId: w.office_department_id,
    };
}

export type AssetInput = Omit<AssetRow, "id" | "totalValue"> & {
    location: AssetLocation;
};

export async function listAssets(location?: AssetLocation, type?: string): Promise<AssetRow[]> {
    const params = new URLSearchParams();
    if (location) params.set("location", location);
    if (type) params.set("type", type);
    const qs = params.toString();
    const res = await fetch(apiUrl(`/api/assets${qs ? `?${qs}` : ""}`));
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

export interface GoogleSheetsSyncSummary {
    spreadsheet_id: string;
    mode: "read-only" | "two-way";
    rule: string;
    write_configured: boolean;
    from_google_sheets: {
        spreadsheet_id: string;
        tabs: Record<
            string,
            {
                scanned: number;
                inserted: number;
                unchanged: number;
                skipped: number;
            }
        >;
    };
    to_google_sheets: unknown | null;
}

export async function syncAssetInventoryFromGoogleSheets(): Promise<GoogleSheetsSyncSummary> {
    const res = await fetch(apiUrl("/api/assets/sync-google-sheets"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to sync Google Sheets"));
    }
    return res.json();
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

export async function deleteAsset(id: number, userId?: number): Promise<void> {
    const url = userId
        ? `/api/assets/${id}?user_id=${userId}`
        : `/api/assets/${id}`;
    const res = await fetch(apiUrl(url), { method: "DELETE" });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to delete asset"));
}


// ─── Asset Media ─────────────────────────────────────────────────
// Photos and videos attached to a specific asset record (used by the
// QR-scan flow on the purchaser side).

export interface AssetMedia {
    id: number;
    assetId: number;
    url: string;
    mimeType: string | null;
    caption: string | null;
    uploadedBy: number | null;
    uploadedByName: string | null;
    createdAt: string;
}

interface AssetMediaWire {
    id: number;
    asset_id: number;
    url: string;
    mime_type: string | null;
    caption: string | null;
    uploaded_by: number | null;
    uploaded_by_name: string | null;
    created_at: string;
}

function mediaFromWire(w: AssetMediaWire): AssetMedia {
    return {
        id: w.id,
        assetId: w.asset_id,
        url: w.url,
        mimeType: w.mime_type,
        caption: w.caption,
        uploadedBy: w.uploaded_by,
        uploadedByName: w.uploaded_by_name,
        createdAt: w.created_at,
    };
}

export async function listAssetMedia(assetId: number): Promise<AssetMedia[]> {
    const res = await fetch(apiUrl(`/api/assets/${assetId}/media`));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load media"));
    const data: AssetMediaWire[] = await res.json();
    return data.map(mediaFromWire);
}

export async function uploadAssetMedia(
    assetId: number,
    files: File[],
    options?: { caption?: string; userId?: number }
): Promise<AssetMedia[]> {
    const fd = new FormData();
    for (const f of files) fd.append("media", f);
    if (options?.caption) fd.append("caption", options.caption);
    if (options?.userId !== undefined) fd.append("user_id", String(options.userId));

    const res = await fetch(apiUrl(`/api/assets/${assetId}/media`), {
        method: "POST",
        body: fd,
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to upload media"));
    const data: AssetMediaWire[] = await res.json();
    return data.map(mediaFromWire);
}

export async function deleteAssetMedia(
    assetId: number,
    mediaId: number
): Promise<void> {
    const res = await fetch(apiUrl(`/api/assets/${assetId}/media/${mediaId}`), {
        method: "DELETE",
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to delete media"));
}

export async function updateAssetRemarks(
    assetId: number,
    remarks: string
): Promise<AssetRow & { location: AssetLocation }> {
    const res = await fetch(apiUrl(`/api/assets/${assetId}/remarks`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to update remarks"));
    return fromWire(await res.json());
}

/** Fetch a single asset by id (used by the QR-scan flow). */
export async function getAssetById(
    id: number
): Promise<(AssetRow & { location: AssetLocation }) | null> {
    // The list endpoint doesn't have a single-id getter, so we fetch all and
    // pick. The collection is small enough for this UI; a dedicated GET
    // endpoint can replace this later if needed.
    const all = await listAllAssets();
    return all.find((a) => a.id === id) ?? null;
}
