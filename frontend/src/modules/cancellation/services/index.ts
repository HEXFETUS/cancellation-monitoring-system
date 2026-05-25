import type {
    CancellationHumanErrorBooth,
    CancellationHumanForce,
    CancellationRecord,
    CancellationSyncResult,
} from "../types";

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

export async function fetchMonthlySummary(
    year: number,
    month: number
): Promise<{
    year: number;
    month: number;
    days_in_month: number;
    daily: {
        day: number;
        approved: number;
        denied: number;
        force_cancel: number;
        human_error: number;
        areas?: {
            area: string;
            approved: number;
            denied: number;
            force_cancel: number;
            human_error: number;
        }[];
    }[];
}> {
    const response = await fetch(`${API_BASE}/monthly-summary?year=${year}&month=${month}`);
    const result = await handleResponse<{
        year: number;
        month: number;
        days_in_month: number;
        daily?: {
            day: number;
            approved: number;
            denied: number;
            force_cancel: number;
            human_error: number;
            areas?: {
                area: string;
                approved: number;
                denied: number;
                force_cancel: number;
                human_error: number;
            }[];
        }[];
        rows?: {
            day: number;
            approved: number;
            denied: number;
            force_cancel: number;
            human_error: number;
            areas?: {
                area: string;
                approved: number;
                denied: number;
                force_cancel: number;
                human_error: number;
            }[];
        }[];
    }>(response);

    return {
        ...result,
        daily: result.daily ?? result.rows ?? [],
    };
}

export async function fetchMonthlyHumanErrorBooths(year: number, month: number): Promise<CancellationHumanErrorBooth[]> {
    const response = await fetch(`${API_BASE}/human-error-booths?year=${year}&month=${month}`);
    return handleResponse<CancellationHumanErrorBooth[]>(response);
}

export async function fetchYearlySummary(
    year: number
): Promise<{
    year: number;
    monthly: {
        month: number;
        approved: number;
        denied: number;
        force_cancel: number;
        human_error: number;
    }[];
}> {
    const response = await fetch(`${API_BASE}/yearly-summary?year=${year}`);
    const result = await handleResponse<{
        year: number;
        monthly?: {
            month: number;
            approved: number;
            denied: number;
            force_cancel: number;
            human_error: number;
        }[];
        rows?: {
            month: number;
            approved: number;
            denied: number;
            force_cancel: number;
            human_error: number;
        }[];
    }>(response);

    return {
        ...result,
        monthly: result.monthly ?? result.rows ?? [],
    };
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
