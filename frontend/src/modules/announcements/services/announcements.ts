const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(p: string) {
    return `${API_BASE_URL}${p}`;
}

export interface Announcement {
    id: number;
    title: string;
    description: string;
    target_audience: string[];
    display_type: "banner" | "popup" | "toast";
    scheduled_at: string | null;
    priority_level: "low" | "medium" | "high" | "critical";
    status: "draft" | "scheduled" | "published";
    published_at: string | null;
    created_by: number;
    created_by_name: string;
    created_at: string;
    updated_at: string;
}

export interface AnnouncementPayload {
    title: string;
    description: string;
    target_audience: string[];
    display_type: string;
    scheduled_at?: string | null;
    priority_level: string;
    status: string;
}

export async function fetchAnnouncements(userId: number, status?: string): Promise<Announcement[]> {
    const params = new URLSearchParams({ user_id: String(userId) });
    if (status) params.set("status", status);
    const res = await fetch(apiUrl(`/api/announcements?${params}`));
    if (!res.ok) throw new Error("Failed to fetch announcements");
    const data = await res.json();
    return data.announcements ?? [];
}

export async function fetchAnnouncement(userId: number, id: number): Promise<Announcement> {
    const res = await fetch(apiUrl(`/api/announcements/${id}?user_id=${userId}`));
    if (!res.ok) throw new Error("Failed to fetch announcement");
    return res.json();
}

export async function createAnnouncement(
    userId: number,
    payload: AnnouncementPayload
): Promise<Announcement> {
    const res = await fetch(apiUrl("/api/announcements"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, user_id: userId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create announcement");
    }
    return res.json();
}

export async function updateAnnouncement(
    userId: number,
    id: number,
    payload: Partial<AnnouncementPayload>
): Promise<Announcement> {
    const res = await fetch(apiUrl(`/api/announcements/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, user_id: userId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update announcement");
    }
    return res.json();
}

export async function deleteAnnouncement(userId: number, id: number): Promise<void> {
    const res = await fetch(apiUrl(`/api/announcements/${id}?user_id=${userId}`), {
        method: "DELETE",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete announcement");
    }
}