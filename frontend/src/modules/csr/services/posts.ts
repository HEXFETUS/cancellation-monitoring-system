const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export interface LotteryResult {
  id: number;
  draw_label: string;
  winning_number: string;
  area: "National" | "Local CDO" | "Local MISOR";
  draw_date: string;
  created_at: string;
}

export interface Announcement {
  id: number;
  title: string;
  caption: string;
  type: "event" | "news";
  media_urls: string[];
  location: string;
  created_by: number;
  created_at: string;
}

// ── RESULTS ────────────────────────────────────

export async function fetchResults(): Promise<LotteryResult[]> {
  const res = await fetch(apiUrl("/api/posts/results"));
  if (!res.ok) throw new Error("Failed to fetch results");
  return res.json();
}

export async function createResult(
  data: Omit<LotteryResult, "id" | "created_at">,
  userId: number
): Promise<LotteryResult> {
  const res = await fetch(apiUrl("/api/posts/results"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, user_id: userId }),
  });
  if (!res.ok) throw new Error("Failed to create result");
  return res.json();
}

export async function deleteResult(id: number, userId: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/posts/results/${id}?user_id=${userId}`), {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete result");
}

// ── ANNOUNCEMENTS ──────────────────────────────

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const res = await fetch(apiUrl("/api/posts/announcements"));
  if (!res.ok) throw new Error("Failed to fetch announcements");
  return res.json();
}

export async function createAnnouncement(
  formData: FormData,
  userId: number
): Promise<Announcement> {
  formData.append("user_id", String(userId));
  const res = await fetch(apiUrl("/api/posts/announcements"), {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to create announcement");
  return res.json();
}

export async function deleteAnnouncement(id: number, userId: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/posts/announcements/${id}?user_id=${userId}`), {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete announcement");
}