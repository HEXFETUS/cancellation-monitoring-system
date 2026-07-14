const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(p: string) {
    return `${API_BASE_URL}${p}`;
}

export interface LotteryResult {
    id: number;
    draw_label: string;
    winning_number: string;
    area: string;
    draw_date: string;
    game_type: string;
    created_at: string;
}

/** Fetch lottery results for the admin results page. */
export async function fetchLotteryResults(userId: number): Promise<LotteryResult[]> {
    const res = await fetch(apiUrl(`/api/posts/results?user_id=${userId}`));
    if (!res.ok) throw new Error("Failed to fetch lottery results");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

/** Create a lottery result. */
export async function createLotteryResult(
    userId: number,
    payload: {
        draw_label: string;
        winning_number: string;
        area: string;
        draw_date?: string;
        game_type: string;
    }
): Promise<LotteryResult> {
    const res = await fetch(apiUrl("/api/posts/results"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, user_id: userId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create result");
    }
    return res.json();
}

/** Delete a lottery result. */
export async function deleteLotteryResult(id: number, userId: number): Promise<void> {
    const res = await fetch(apiUrl(`/api/posts/results/${id}?user_id=${userId}`), {
        method: "DELETE",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete result");
    }
}