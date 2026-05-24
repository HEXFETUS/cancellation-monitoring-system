import type { CancellationHumanForce, CancellationRecord, CancellationSyncResult } from "../types";

const API_BASE = "/api/cancellation";

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
}

export async function fetchCancellationRecords(date?: string): Promise<CancellationRecord[]> {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const response = await fetch(`${API_BASE}/records${query}`);
    return handleResponse<CancellationRecord[]>(response);
}

export async function fetchCancellationHumanForce(date?: string): Promise<CancellationHumanForce[]> {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const response = await fetch(`${API_BASE}/human-force${query}`);
    return handleResponse<CancellationHumanForce[]>(response);
}

export async function syncCancellationSummary(data: {
    date?: string;
    sync_all?: boolean;
    cancelled_by_id?: number | null;
}): Promise<CancellationSyncResult> {
    const response = await fetch(`${API_BASE}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return handleResponse<CancellationSyncResult>(response);
}
