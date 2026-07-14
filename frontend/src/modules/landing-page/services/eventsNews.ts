const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(p: string) {
    return `${API_BASE_URL}${p}`;
}

export interface EventsNewsItem {
    id: number;
    title: string | null;
    caption: string;
    type: "event" | "news";
    media_urls: string[];
    location: string;
    status: "published" | "scheduled";
    scheduled_at: string | null;
    published_at: string | null;
    created_by: number | null;
    created_at: string;
}

/** Fetch visible Events & News posts for the public landing page. */
export async function fetchEventsNews(): Promise<EventsNewsItem[]> {
    const res = await fetch(apiUrl("/api/events-news"));
    if (!res.ok) throw new Error("Failed to fetch events & news");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

/** Create an Events & News post. `media` holds image/video File objects. */
export async function createEventsNews(
    userId: number,
    payload: {
        title: string;
        caption: string;
        type: "event" | "news";
        location: string;
        status: "published" | "scheduled";
        scheduled_at?: string | null;
        media: File[];
    }
): Promise<EventsNewsItem> {
    const form = new FormData();
    form.append("user_id", String(userId));
    form.append("title", payload.title);
    form.append("caption", payload.caption);
    form.append("type", payload.type);
    form.append("location", payload.location);
    form.append("status", payload.status);
    if (payload.status === "scheduled" && payload.scheduled_at) {
        form.append("scheduled_at", payload.scheduled_at);
    }
    payload.media.forEach((file) => form.append("media", file));

    const res = await fetch(apiUrl("/api/events-news"), {
        method: "POST",
        body: form,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create post");
    }
    return res.json();
}

/** Delete an Events & News post. */
export async function deleteEventsNews(id: number, userId: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/events-news/${id}?user_id=${userId}`), {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete post");
  }
}

/** Update an Events & News post. `existingMedia` are server URLs to keep;
 *  `media` are new File objects to append. Existing media is dropped when
 *  `existingMedia` is empty and no new files are supplied. */
export async function updateEventsNews(
  id: number,
  userId: number,
  payload: {
    title: string;
    caption: string;
    type: "event" | "news";
    location: string;
    status: "published" | "scheduled";
    scheduled_at?: string | null;
    existingMedia: string[];
    media: File[];
  }
): Promise<EventsNewsItem> {
  const form = new FormData();
  form.append("user_id", String(userId));
  form.append("title", payload.title);
  form.append("caption", payload.caption);
  form.append("type", payload.type);
  form.append("location", payload.location);
  form.append("status", payload.status);
  if (payload.status === "scheduled" && payload.scheduled_at) {
    form.append("scheduled_at", payload.scheduled_at);
  }
  form.append("existing_media", JSON.stringify(payload.existingMedia));
  payload.media.forEach((file) => form.append("media", file));

  const res = await fetch(apiUrl(`/api/events-news/${id}`), {
    method: "PUT",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update post");
  }
  return res.json();
}