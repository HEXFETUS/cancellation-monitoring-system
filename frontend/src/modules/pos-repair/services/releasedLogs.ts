const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export interface ReleasedLog {
    id: number;
    release_date: string | null;
    billing_code: string | null;
    pos: string | null;
    serial_number: string | null;
    diagnosis: string | null;
    remarks: string | null;
    released_by: string | null;
    received_by: string | null;
    created_at: string;
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

export async function listReleasedLogs(): Promise<ReleasedLog[]> {
    const res = await fetch(apiUrl("/api/released-logs"));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load released logs"));
    const payload = await res.json();
    return Array.isArray(payload) ? payload : payload.data ?? payload.rows ?? [];
}