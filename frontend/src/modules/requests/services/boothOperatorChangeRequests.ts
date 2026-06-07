const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type BoothOperatorRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface BoothOperatorChangeRequest {
    id: number;
    user_id: number;
    booth_info_id: number;
    status: BoothOperatorRequestStatus;
    decided_by_user_id: number | null;
    decided_at: string | null;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields for display
    booth_code: string | null;
    coordinate: string | null;
    booth_location: string | null;
    current_operator_id: number | null;
    current_operator: string | null;
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

export async function listBoothOperatorChangeRequests(params: {
    status?: BoothOperatorRequestStatus;
    userId?: number;
    boothId?: number;
} = {}): Promise<BoothOperatorChangeRequest[]> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.userId) qs.set("userId", String(params.userId));
    if (params.boothId) qs.set("booth_id", String(params.boothId));
    const url = qs.toString()
        ? `/api/booth-operator-change-requests?${qs.toString()}`
        : "/api/booth-operator-change-requests";

    const res = await fetch(apiUrl(url));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load requests"));
    return await res.json();
}

export async function createBoothOperatorChangeRequest(input: {
    user_id: number;
    booth_id: number;
    status?: BoothOperatorRequestStatus;
}): Promise<BoothOperatorChangeRequest> {
    // New requests are always created with status "pending" so the admin
    // queue can pick them up. The backend also defaults to "pending" if
    // we omit it, but sending it explicitly keeps the contract clear.
    const payload = {
        status: "pending" as BoothOperatorRequestStatus,
        ...input,
    };
    const res = await fetch(apiUrl("/api/booth-operator-change-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to submit request"));
    return await res.json();
}

export async function cancelBoothOperatorChangeRequest(
    id: number,
    userId: number
): Promise<BoothOperatorChangeRequest> {
    const res = await fetch(apiUrl(`/api/booth-operator-change-requests/${id}/cancel`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to cancel"));
    return await res.json();
}

export async function approveBoothOperatorChangeRequest(
    id: number,
    input: { admin_user_id?: number | null; admin_notes?: string }
): Promise<BoothOperatorChangeRequest> {
    const res = await fetch(apiUrl(`/api/booth-operator-change-requests/${id}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to approve"));
    return await res.json();
}

export async function rejectBoothOperatorChangeRequest(
    id: number,
    input: { admin_user_id?: number | null; admin_notes?: string }
): Promise<BoothOperatorChangeRequest> {
    const res = await fetch(apiUrl(`/api/booth-operator-change-requests/${id}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to reject"));
    return await res.json();
}