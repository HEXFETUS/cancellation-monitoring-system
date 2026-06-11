const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export interface CellphoneRecord {
    id: number;
    brand: string;
    model: string;
    specs: string;
    serial_number: string;
    imei1: string | null;
    imei2: string | null;
    control_no: string;
    operator_id: number | null;
    added_by_user_id: number | null;
    status: string;
    booth_id: number | null;
    created_at: string;
    updated_at: string;
}

export async function updateCellphone(
    id: number,
    data: {
        brand: string;
        model: string;
        specs: string;
        serialNumber: string;
        imei1: string | null;
        imei2: string | null;
        controlNo: string;
    }
): Promise<CellphoneRecord> {
    const res = await fetch(`${API_BASE_URL}/api/cellphones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update cellphone");
    }
    return await res.json();
}