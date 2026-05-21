import type { PosRecord } from "../types";

const API_BASE = "/api/pos";

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
}

export async function fetchPosRecords(params?: {
    device_no?: string;
    serial_number?: string; // FIXED: Changed from serial_no to match backend
    booth_id?: string;      // FIXED: Pass the actual booth ID string (e.g., 'BTH-A01')
    operator_id?: string;   // FIXED: Pass the operator ID number as a string (e.g., '1')
}): Promise<PosRecord[]> {
    const searchParams = new URLSearchParams();
    
    if (params?.device_no) searchParams.set("device_no", params.device_no);
    
    // FIXED: Must match backend destructuring `const { serial_number } = req.query;`
    if (params?.serial_number) searchParams.set("serial_number", params.serial_number);
    
    // FIXED: Must pass the ID key string so backend filters `p.booth_id = $idx`
    if (params?.booth_id) searchParams.set("booth_id", params.booth_id);
    
    // FIXED: Must pass the numeric string ID so backend filters `p.operator_id = $idx::int`
    if (params?.operator_id) searchParams.set("operator_id", params.operator_id);

    const query = searchParams.toString();
    const url = query ? `${API_BASE}?${query}` : API_BASE;
    const response = await fetch(url);
    return handleResponse<PosRecord[]>(response);
}

export async function createPosRecord(data: Partial<Omit<PosRecord, "id" | "created_at" | "updated_at">>): Promise<PosRecord> {
    const response = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return handleResponse<PosRecord>(response);
}

export async function updatePosRecord(id: number, data: Partial<PosRecord>): Promise<PosRecord> {
    const response = await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return handleResponse<PosRecord>(response);
}

export async function deletePosRecord(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
}