import type { BoothInfo, PosRecord, BoothChangeLog, PosConvertHistory, StatusLog, OperatorInfo } from "../types";

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
    serial_number?: string;
    booth_id?: string;
    operator_id?: string;
    /** When set, returns only POS records belonging to the operator linked to this user. */
    user_id?: string;
    /** Used with user_id: narrow to a specific (sub-)operator the user is allowed to see. */
    as_operator_id?: string;
}): Promise<PosRecord[]> {
    const searchParams = new URLSearchParams();

    if (params?.device_no) searchParams.set("device_no", params.device_no);
    if (params?.serial_number) searchParams.set("serial_number", params.serial_number);
    if (params?.booth_id) searchParams.set("booth_id", params.booth_id);
    if (params?.operator_id) searchParams.set("operator_id", params.operator_id);
    if (params?.user_id) searchParams.set("user_id", params.user_id);
    if (params?.as_operator_id) searchParams.set("as_operator_id", params.as_operator_id);

    const query = searchParams.toString();
    const url = query ? `${API_BASE}?${query}` : API_BASE;
    const response = await fetch(url);
    return handleResponse<PosRecord[]>(response);
}

export async function fetchBoothInfo(): Promise<BoothInfo[]> {
    const response = await fetch(`${API_BASE}/booth-info`);
    return handleResponse<BoothInfo[]>(response);
}

export async function fetchOperators(): Promise<OperatorInfo[]> {
    const response = await fetch(`${API_BASE}/operators`);
    return handleResponse<OperatorInfo[]>(response);
}

export async function createOperator(data: {
    operator: string;
    parent_operator_id?: number | null;
}): Promise<OperatorInfo> {
    const response = await fetch(`${API_BASE}/operators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return handleResponse<OperatorInfo>(response);
}

export async function updateOperatorParent(
    operatorId: number,
    parentOperatorId: number | null
): Promise<OperatorInfo> {
    const response = await fetch(`${API_BASE}/operators/${operatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_operator_id: parentOperatorId }),
    });
    return handleResponse<OperatorInfo>(response);
}

/**
 * Atomic bulk-assign: promote the parent to main if it's a sub, re-parent any
 * grandchildren of the picked subs to the new parent, then attach all picked
 * subs. Wraps the whole thing in a backend transaction.
 */
export async function assignSubOperators(
    parentId: number,
    subIds: number[]
): Promise<{
    assigned: number;
    errors: Array<{ id: number; error: string }>;
    reparentedGrandchildren: Array<{ id: number; operator: string; new_parent_id: number }>;
    operators: OperatorInfo[];
}> {
    const response = await fetch(`${API_BASE}/operators/${parentId}/assign-subs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sub_ids: subIds }),
    });
    return handleResponse(response);
}

export async function createBoothInfo(data: {
    booth_code: string;
    coordinate?: string;
    location?: string;
    operator: string;
    operator_id?: number | null;
    changed_by?: string;
}): Promise<BoothInfo> {
    const response = await fetch(`${API_BASE}/booth-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return handleResponse<BoothInfo>(response);
}

export async function createPosRecord(data: Partial<Omit<PosRecord, "id" | "created_at" | "updated_at">>): Promise<PosRecord> {
    const response = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return handleResponse<PosRecord>(response);
}

export async function changePosBooth(id: number, booth_id: number, booth_code: string, changed_by?: string): Promise<PosRecord> {
    const response = await fetch(`${API_BASE}/${id}/change-booth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booth_id, booth_code, changed_by }),
    });
    return handleResponse<PosRecord>(response);
}

export async function convertPosArea(id: number, new_area: string, changed_by?: string): Promise<PosRecord> {
    const response = await fetch(`${API_BASE}/${id}/convert-area`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_area, changed_by }),
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

export async function fetchBoothChangeLogs(): Promise<BoothChangeLog[]> {
    const response = await fetch(`${API_BASE}/booth-change-logs`);
    return handleResponse<BoothChangeLog[]>(response);
}

export async function fetchConvertAreaLogs(): Promise<PosConvertHistory[]> {
    const response = await fetch(`${API_BASE}/convert-area-logs`);
    return handleResponse<PosConvertHistory[]>(response);
}

export async function fetchStatusLogs(): Promise<StatusLog[]> {
    const response = await fetch(`${API_BASE}/status-logs`);
    return handleResponse<StatusLog[]>(response);
}
