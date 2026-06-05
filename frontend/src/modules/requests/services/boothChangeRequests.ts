const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface BoothChangeRequest {
    id: number;
    pos_record_id: number;
    requested_by_user_id: number | null;
    requested_booth_id: number;
    reason: string | null;
    status: RequestStatus;
    admin_user_id: number | null;
    admin_notes: string | null;
    decided_at: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields for display
    device_no: string | null;
    serial_number: string | null;
    current_booth_id: number | null;
    current_booth_code: string | null;
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

export async function listBoothChangeRequests(params: {
    status?: RequestStatus;
    userId?: number;
    posRecordId?: number;
} = {}): Promise<BoothChangeRequest[]> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.userId) qs.set("userId", String(params.userId));
    if (params.posRecordId) qs.set("pos_record_id", String(params.posRecordId));
    const url = qs.toString()
        ? `/api/booth-change-requests?${qs.toString()}`
        : "/api/booth-change-requests";

    const res = await fetch(apiUrl(url));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load requests"));
    return await res.json();
}

export async function createBoothChangeRequest(input: {
    pos_record_id: number;
    requested_booth_id: number;
    requested_by_user_id?: number | null;
    reason?: string;
}): Promise<BoothChangeRequest> {
    const res = await fetch(apiUrl("/api/booth-change-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to submit request"));
    return await res.json();
}

export async function approveBoothChangeRequest(
    id: number,
    input: { admin_user_id?: number | null; admin_notes?: string }
): Promise<BoothChangeRequest> {
    const res = await fetch(apiUrl(`/api/booth-change-requests/${id}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to approve"));
    return await res.json();
}

export async function rejectBoothChangeRequest(
    id: number,
    input: { admin_user_id?: number | null; admin_notes?: string }
): Promise<BoothChangeRequest> {
    const res = await fetch(apiUrl(`/api/booth-change-requests/${id}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to reject"));
    return await res.json();
}

export async function cancelBoothChangeRequest(
    id: number,
    userId: number
): Promise<BoothChangeRequest> {
    const res = await fetch(apiUrl(`/api/booth-change-requests/${id}/cancel`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to cancel"));
    return await res.json();
}
