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

export async function searchPosRecords(query: string): Promise<PosRecord[]> {
    if (!query || query.trim().length === 0) return [];

    const params = new URLSearchParams();

    // Search across both serial_number and device_no using the existing endpoint.
    // Since the backend LIKE-matches each field independently, we fetch by
    // serial_number first. If the query also looks like a device_no, we do a
    // second request and merge the results (deduplicating by id).
    params.set("serial_number", query);
    const res = await fetch(apiUrl(`/api/pos?${params.toString()}`));
    if (!res.ok) {
        console.error("Failed to search POS records:", res.statusText);
        return [];
    }

    const serialResults: PosRecord[] = await res.json();

    // Also try device_no search
    const params2 = new URLSearchParams();
    params2.set("device_no", query);
    const res2 = await fetch(apiUrl(`/api/pos?${params2.toString()}`));
    if (!res2.ok) return serialResults;

    const deviceResults: PosRecord[] = await res2.json();

    // Merge and deduplicate by id
    const seen = new Set<number>();
    const merged: PosRecord[] = [];
    for (const r of [...serialResults, ...deviceResults]) {
        if (!seen.has(r.id)) {
            seen.add(r.id);
            merged.push(r);
        }
    }

    return merged;
}