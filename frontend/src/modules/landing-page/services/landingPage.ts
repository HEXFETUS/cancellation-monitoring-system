const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(p: string) {
    return `${API_BASE_URL}${p}`;
}

export interface LandingPageContent {
    id: number;
    section: string;
    title: string | null;
    description: string | null;
    content: string | null;
    image_urls: string[];
    stats: Record<string, string> | null;
    created_by: number | null;
    created_at: string;
    updated_at: string;
}

/** Fetch content for a specific landing page section. */
export async function fetchLandingPageContent(section: string): Promise<LandingPageContent | null> {
    const res = await fetch(apiUrl(`/api/landing-page/${section}`));
    if (!res.ok) throw new Error("Failed to fetch landing page content");
    return res.json();
}

/** Update content for a specific landing page section. */
export async function updateLandingPageContent(
    section: string,
    payload: {
        title?: string;
        description?: string;
        content?: string;
        stats?: Record<string, string>;
        existingImages?: string[];
        images?: File[];
    },
    userId: number
): Promise<LandingPageContent> {
    const form = new FormData();
    form.append("user_id", String(userId));
    if (payload.title !== undefined) form.append("title", payload.title);
    if (payload.description !== undefined) form.append("description", payload.description);
    if (payload.content !== undefined) form.append("content", payload.content);
    if (payload.stats !== undefined) form.append("stats", JSON.stringify(payload.stats));
    if (payload.existingImages) {
        form.append("existing_images", JSON.stringify(payload.existingImages));
    }
    payload.images?.forEach((file) => form.append("images", file));

    const res = await fetch(apiUrl(`/api/landing-page/${section}`), {
        method: "PUT",
        body: form,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update content");
    }
    return res.json();
}

/** Remove an image from a section. */
export async function deleteLandingPageImage(section: string, imageUrl: string): Promise<void> {
    const res = await fetch(apiUrl(`/api/landing-page/${section}/image`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete image");
    }
}