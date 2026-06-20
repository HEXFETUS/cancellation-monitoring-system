const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export interface PosRecord {
    id: number;
    device_no: string;
    serial_number: string;
    area: string;
    status: string;
    booth_id: number | null;
    operator_id: number | null;
    booth_code: string | null;
    operator: string | null;
}

export interface OperatorItem {
    id: number;
    operator: string;
}

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

export async function searchPosRecordsBySerial(query: string): Promise<PosRecord[]> {
    if (!query || query.trim().length === 0) return [];

    const params = new URLSearchParams();
    params.set("serial_number", query);
    const res = await fetch(apiUrl(`/api/pos?${params.toString()}`));
    if (!res.ok) {
        console.error("Failed to search POS records by serial:", res.statusText);
        return [];
    }
    return await res.json();
}

export async function searchPosRecordsByDevice(query: string): Promise<PosRecord[]> {
    if (!query || query.trim().length === 0) return [];

    const params = new URLSearchParams();
    params.set("device_no", query);
    const res = await fetch(apiUrl(`/api/pos?${params.toString()}`));
    if (!res.ok) {
        console.error("Failed to search POS records by device no:", res.statusText);
        return [];
    }
    return await res.json();
}

export async function searchOperators(query: string): Promise<OperatorItem[]> {
    if (!query || query.trim().length === 0) return [];

    const params = new URLSearchParams();
    params.set("q", query);
    const res = await fetch(apiUrl(`/api/pos/operators?${params.toString()}`));
    if (!res.ok) {
        console.error("Failed to search operators:", res.statusText);
        return [];
    }
    const data = await res.json();
    const rows = Array.isArray(data) ? data : data.data ?? data.rows ?? [];
    return (rows as OperatorItem[]).filter((op) => op.operator.trim().length > 0);
}