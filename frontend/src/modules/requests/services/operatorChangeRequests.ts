const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type OperatorRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface OperatorChangeRequest {
    id: number;
    user_id: number;
    pos_record_id: number;
    status: OperatorRequestStatus;
    reason: string | null;
    old_operator: string | null;
    decided_by_user_id: number | null;
    decided_at: string | null;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields for display
    device_no: string | null;
    serial_number: string | null;
    area: string | null;
    current_booth_id: number | null;
    current_booth_code: string | null;
    requested_booth_code: string | null;
    current_operator_id: number | null;
    from_operator: string | null;
    to_operator: string | null;
    requested_by_name: string | null;
    decided_by_name: string | null;
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

export async function listOperatorChangeRequests(params: {
    status?: OperatorRequestStatus;
    userId?: number;
    posRecordId?: number;
} = {}): Promise<OperatorChangeRequest[]> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.userId) qs.set("userId", String(params.userId));
    if (params.posRecordId) qs.set("pos_record_id", String(params.posRecordId));
    const url = qs.toString()
        ? `/api/operator-change-requests?${qs.toString()}`
        : "/api/operator-change-requests";

    const res = await fetch(apiUrl(url));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load requests"));
    return await res.json();
}

export async function createOperatorChangeRequest(input: {
    user_id: number;
    pos_record_id: number;
    status?: OperatorRequestStatus;
    reason?: string;
}): Promise<OperatorChangeRequest> {
    // New requests are always created with status "pending" so the admin
    // queue can pick them up. The backend also defaults to "pending" if
    // we omit it, but sending it explicitly keeps the contract clear.
    const payload = {
        status: "pending" as OperatorRequestStatus,
        ...input,
    };
    const res = await fetch(apiUrl("/api/operator-change-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to submit request"));
    return await res.json();
}

export async function cancelOperatorChangeRequest(
    id: number,
    userId: number
): Promise<OperatorChangeRequest> {
    const res = await fetch(apiUrl(`/api/operator-change-requests/${id}/cancel`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to cancel"));
    return await res.json();
}

export async function approveOperatorChangeRequest(
    id: number,
    input: { admin_user_id?: number | null; admin_notes?: string }
): Promise<OperatorChangeRequest> {
    const res = await fetch(apiUrl(`/api/operator-change-requests/${id}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to approve"));
    return await res.json();
}

export async function rejectOperatorChangeRequest(
    id: number,
    input: { admin_user_id?: number | null; admin_notes?: string }
): Promise<OperatorChangeRequest> {
    const res = await fetch(apiUrl(`/api/operator-change-requests/${id}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to reject"));
    return await res.json();
}
