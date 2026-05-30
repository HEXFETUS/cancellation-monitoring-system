const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export interface RepairRecord {
    id: number;
    date: string;
    pos_record_id: number;
    ntc: boolean;
    operator_id: number | null;
    diagnosis_id: number | null;
    delivered_by: string;
    with_charger: boolean;
    with_box: boolean;
    status: string;
    forwarded: boolean;
    released: boolean;
    re_repair: boolean;
    repaired_by: string | null;
    remarks: string | null;
    billing_code: string | null;
    received_by: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields
    serial_number: string;
    device_no: string;
    area: string;
    operator_name: string;
    diagnosis_name: string;
    // Additional field for update detection
    isUpdate?: boolean;
}

export interface CreateRepairRecordPayload {
    date: string;
    pos_record_id: number;
    ntc: boolean;
    operator_name: string;
    diagnosis_id: number | null;
    delivered_by: string;
    with_charger: boolean;
    with_box: boolean;
}

export interface UpdateRepairRecordPayload {
    diagnosis_id?: number | null;
    ntc?: boolean;
    with_charger?: boolean;
    with_box?: boolean;
    delivered_by?: string | null;
    status?: string;
    forwarded?: boolean;
    released?: boolean;
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

export async function createRepairRecord(payload: CreateRepairRecordPayload): Promise<RepairRecord> {
    const res = await fetch(apiUrl("/api/repair-records"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to create repair record"));
    }

    return res.json();
}

export async function listRepairRecords(): Promise<RepairRecord[]> {
    const res = await fetch(apiUrl("/api/repair-records"));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load repair records"));
    const payload = await res.json();
    return Array.isArray(payload) ? payload : payload.data ?? payload.rows ?? [];
}

export async function updateRepairRecord(
    id: number,
    payload: UpdateRepairRecordPayload
): Promise<RepairRecord> {
    const res = await fetch(apiUrl(`/api/repair-records/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to update repair record"));
    }

    return res.json();
}

export interface ProceedRepairRecordPayload {
    status: string;
    forwarded: boolean;
}

export async function releaseRepairRecord(id: number): Promise<RepairRecord> {
    const res = await fetch(apiUrl(`/api/repair-records/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            status: "Released",
            released: true,
        }),
    });

    if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to release repair record"));
    }

    return res.json();
}

export async function proceedRepairRecord(id: number, diagnosisId?: number): Promise<RepairRecord> {
    const res = await fetch(apiUrl(`/api/repair-records/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            status: "Pending",
            forwarded: true,
            ...(diagnosisId ? { diagnosis_id: diagnosisId } : {}),
        }),
    });

    if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to proceed repair record"));
    }

    return res.json();
}

export async function moveRepairRecordToForReleased(
    id: number,
    payload: { diagnosis_id: number; requested_by?: string | null }
): Promise<RepairRecord> {
    const res = await fetch(apiUrl(`/api/repair-records/${id}/for-released`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to move repair record to For Released"));
    }

    return res.json();
}

export async function clearRepairRecord(id: number): Promise<RepairRecord> {
    const res = await fetch(apiUrl(`/api/repair-records/${id}/clear`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to clear repair record"));
    }

    return res.json();
}
