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
    serial_no?: string;
    booth_code?: string;
    operator?: string;
}): Promise<PosRecord[]> {
    const searchParams = new URLSearchParams();
    if (params?.device_no) searchParams.set("device_no", params.device_no);
    if (params?.serial_no) searchParams.set("serial_no", params.serial_no);
    if (params?.booth_code) searchParams.set("booth_code", params.booth_code);
    if (params?.operator) searchParams.set("operator", params.operator);

    const query = searchParams.toString();
    const url = query ? `${API_BASE}?${query}` : API_BASE;
    const response = await fetch(url);
    return handleResponse<PosRecord[]>(response);
}

export async function createPosRecord(data: Omit<PosRecord, "id" | "created_at" | "updated_at">): Promise<PosRecord> {
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