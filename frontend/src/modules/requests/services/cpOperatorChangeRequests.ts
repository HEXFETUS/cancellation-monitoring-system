const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type CpOperatorRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface CpOperatorChangeRequest {
    id: number;
    user_id: number;
    cellphone_id: number;
    status: CpOperatorRequestStatus;
    reason: string | null;
    old_operator: string | null;
    admin_notes: string | null;
    decided_by_user_id: number | null;
    decided_at: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields for display
    brand: string | null;
    model: string | null;
    control_no: string | null;
    serial_number: string | null;
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

export async function listCpOperatorChangeRequests(params: {
    status?: CpOperatorRequestStatus;
    userId?: number;
    cellphoneId?: number;
} = {}): Promise<CpOperatorChangeRequest[]> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.userId) qs.set("userId", String(params.userId));
    if (params.cellphoneId) qs.set("cellphone_id", String(params.cellphoneId));
    const url = qs.toString()
        ? `/api/cp-operator-change-requests?${qs.toString()}`
        : "/api/cp-operator-change-requests";

    const res = await fetch(apiUrl(url));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load requests"));
    return await res.json();
}

export async function createCpOperatorChangeRequest(input: {
    user_id: number;
    cellphone_id: number;
    reason?: string;
}): Promise<CpOperatorChangeRequest> {
    const res = await fetch(apiUrl("/api/cp-operator-change-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...input,
            status: "pending",
        }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to submit request"));
    return await res.json();
}

export async function approveCpOperatorChangeRequest(
    id: number,
    input: { admin_user_id?: number | null; admin_notes?: string }
): Promise<CpOperatorChangeRequest> {
    const res = await fetch(apiUrl(`/api/cp-operator-change-requests/${id}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to approve"));
    return await res.json();
}

export async function rejectCpOperatorChangeRequest(
    id: number,
    input: { admin_user_id?: number | null; admin_notes?: string }
): Promise<CpOperatorChangeRequest> {
    const res = await fetch(apiUrl(`/api/cp-operator-change-requests/${id}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to reject"));
    return await res.json();
}

export async function cancelCpOperatorChangeRequest(
    id: number,
    userId: number
): Promise<CpOperatorChangeRequest> {
    const res = await fetch(apiUrl(`/api/cp-operator-change-requests/${id}/cancel`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to cancel"));
    return await res.json();
}