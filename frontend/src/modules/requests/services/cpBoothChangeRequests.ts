const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type CpRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface CpBoothChangeRequest {
    id: number;
    cellphone_id: number;
    requested_by_user_id: number | null;
    requested_booth_id: number;
    reason: string | null;
    status: CpRequestStatus;
    admin_user_id: number | null;
    admin_notes: string | null;
    decided_at: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields for display
    brand: string | null;
    model: string | null;
    control_no: string | null;
    serial_number: string | null;
    requested_booth_code: string | null;
    requested_by_name: string | null;
    admin_name: string | null;
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

export async function listCpBoothChangeRequests(params: {
    status?: CpRequestStatus;
    userId?: number;
    cellphoneId?: number;
} = {}): Promise<CpBoothChangeRequest[]> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.userId) qs.set("userId", String(params.userId));
    if (params.cellphoneId) qs.set("cellphone_id", String(params.cellphoneId));
    const url = qs.toString()
        ? `/api/cp-booth-change-requests?${qs.toString()}`
        : "/api/cp-booth-change-requests";

    const res = await fetch(apiUrl(url));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load requests"));
    return await res.json();
}

export async function createCpBoothChangeRequest(input: {
    cellphone_id: number;
    requested_booth_id: number;
    requested_by_user_id?: number | null;
    reason?: string;
}): Promise<CpBoothChangeRequest> {
    const res = await fetch(apiUrl("/api/cp-booth-change-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to submit request"));
    return await res.json();
}

export async function approveCpBoothChangeRequest(
    id: number,
    input: { admin_user_id?: number | null; admin_notes?: string }
): Promise<CpBoothChangeRequest> {
    const res = await fetch(apiUrl(`/api/cp-booth-change-requests/${id}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to approve"));
    return await res.json();
}

export async function rejectCpBoothChangeRequest(
    id: number,
    input: { admin_user_id?: number | null; admin_notes?: string }
): Promise<CpBoothChangeRequest> {
    const res = await fetch(apiUrl(`/api/cp-booth-change-requests/${id}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to reject"));
    return await res.json();
}

export async function cancelCpBoothChangeRequest(
    id: number,
    userId: number
): Promise<CpBoothChangeRequest> {
    const res = await fetch(apiUrl(`/api/cp-booth-change-requests/${id}/cancel`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to cancel"));
    return await res.json();
}