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
    area: string | null;
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

export async function deleteCellphone(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/cellphones/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete cellphone");
    }
}

export async function convertCpArea(id: number, new_area: string): Promise<CellphoneRecord> {
    const res = await fetch(`${API_BASE_URL}/api/cellphones/${id}/convert-area`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_area }),
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to convert area");
    }
    return await res.json();
}
