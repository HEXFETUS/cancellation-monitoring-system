const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export interface DiagnosisLog {
    id: number;
    repair_record_id: number;
    requested_at: string;
    requested_by: string | null;
    pos_diagnosis: string | null;
    repaired_by: string | null;
    remarks: string | null;
    status: string | null;
    forwarded_at: string | null;
    returned_at: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields from pos_records
    device_no: string | null;
    serial_number: string | null;
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

export async function listDiagnosisLogs(): Promise<DiagnosisLog[]> {
    const res = await fetch(apiUrl("/api/diagnosis-logs"));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load diagnosis logs"));
    const payload = await res.json();
    return Array.isArray(payload) ? payload : payload.data ?? payload.rows ?? [];
}