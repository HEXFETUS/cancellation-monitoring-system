const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export interface AssetCode {
    id: number;
    itemCode: string;
    description: string;
    type: string;
    department: string;
    careOf: string;
    space: string;
    /**
     * Legacy field. The new `asset_coding` schema dropped the dedicated
     * `qr_payload` column — QR stickers now encode the item_code directly.
     * We keep this property on the typed model so existing UI (QR previews,
     * download/print labels) continues to render without a schema-wide
     * refactor; `fromWire()` populates it with the item_code.
     */
    qrPayload: string;
    assetId: number | null;
    createdAt: string;
    updatedAt: string;
}

interface AssetCodeWire {
    id: number;
    item_code: string | null;
    description: string;
    type: string | null;
    department: string | null;
    care_of: string | null;
    space: string | null;
    asset_id: number | null;
    created_at: string;
    updated_at: string;
}

export type AssetCodeInput = Omit<
    AssetCode,
    "id" | "qrPayload" | "createdAt" | "updatedAt"
>;

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

function fromWire(w: AssetCodeWire): AssetCode {
    return {
        id: w.id,
        itemCode: w.item_code ?? "",
        description: w.description,
        type: w.type ?? "",
        department: w.department ?? "",
        careOf: w.care_of ?? "",
        space: w.space ?? "",
        // QR sticker text is the item_code itself in the new schema.
        // Fall back to "NO-CODE" when the sheet row had no ASSET ID.
        qrPayload: w.item_code ?? "NO-CODE",
        assetId: w.asset_id,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
    };
}

function toWireBody(input: AssetCodeInput) {
    return {
        itemCode: input.itemCode,
        description: input.description,
        type: input.type || null,
        department: input.department || null,
        careOf: input.careOf || null,
        space: input.space || null,
        assetId: input.assetId ?? null,
    };
}

export async function listAssetCodes(department?: string): Promise<AssetCode[]> {
    const params = new URLSearchParams();
    if (department) params.set("department", department);
    const qs = params.toString();
    const res = await fetch(apiUrl(`/api/asset-codes${qs ? `?${qs}` : ""}`));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load asset codes"));
    const data: AssetCodeWire[] = await res.json();
    return data.map(fromWire);
}

export async function createAssetCode(input: AssetCodeInput): Promise<AssetCode> {
    const res = await fetch(apiUrl("/api/asset-codes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toWireBody(input)),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to create asset code"));
    return fromWire(await res.json());
}

export async function updateAssetCode(id: number, input: AssetCodeInput): Promise<AssetCode> {
    const res = await fetch(apiUrl(`/api/asset-codes/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toWireBody(input)),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to update asset code"));
    return fromWire(await res.json());
}

export async function deleteAssetCode(id: number, userId?: number): Promise<void> {
    const url = userId ? `/api/asset-codes/${id}?user_id=${userId}` : `/api/asset-codes/${id}`;
    const res = await fetch(apiUrl(url), { method: "DELETE" });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to delete asset code"));
}
