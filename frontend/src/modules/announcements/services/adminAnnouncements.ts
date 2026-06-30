const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(p: string) {
    return `${API_BASE_URL}${p}`;
}

export interface AdminAnnouncement {
    id: number;
    title: string;
    description: string;
    status: "published" | "scheduled";
    scheduled_at: string | null;
    published_at: string | null;
    created_by: number;
    created_by_name: string;
    created_at: string;
    updated_at: string;
}

export interface AdminAnnouncementPayload {
    title: string;
    description: string;
    status: "published" | "scheduled";
    scheduled_at?: string | null;
    created_by: number;
}

export async function fetchAdminAnnouncements(userId: number): Promise<AdminAnnouncement[]> {
    const res = await fetch(apiUrl(`/api/admin-announcements?user_id=${userId}`));
    if (!res.ok) throw new Error("Failed to fetch announcements");
    const data = await res.json();
    return data.announcements ?? [];
}

export async function fetchVisibleAdminAnnouncements(userId: number): Promise<AdminAnnouncement[]> {
    const res = await fetch(apiUrl(`/api/admin-announcements/view?user_id=${userId}`));
    if (!res.ok) throw new Error("Failed to fetch announcements");
    const data = await res.json();
    return data.announcements ?? [];
}

export async function createAdminAnnouncement(
    userId: number,
    payload: AdminAnnouncementPayload
): Promise<AdminAnnouncement> {
    const res = await fetch(apiUrl("/api/admin-announcements"), {
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

export async function updateAdminAnnouncement(
    id: number,
    payload: AdminAnnouncementPayload
): Promise<AdminAnnouncement> {
    const res = await fetch(apiUrl(`/api/admin-announcements/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update announcement");
    }
    return res.json();
}

export async function deleteAdminAnnouncement(id: number): Promise<void> {
    const res = await fetch(apiUrl(`/api/admin-announcements/${id}`), {
        method: "DELETE",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete announcement");
    }
}
