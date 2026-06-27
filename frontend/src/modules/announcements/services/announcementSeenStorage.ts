const STORAGE_KEY = "seenAnnouncementIds";

export function getSeenAnnouncementIds(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map(String);
        }
        return [];
    } catch {
        return [];
    }
}

export function markAnnouncementsAsSeen(ids: (number | string)[]): void {
    try {
        const existing = getSeenAnnouncementIds();
        const merged = [...new Set([...existing, ...ids.map(String)])];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
        // localStorage unavailable — silently ignore
    }
}

export function getUnseenAnnouncementIds(
    announcements: { id: number | string }[],
    seenIds: string[]
): string[] {
    const seenSet = new Set(seenIds);
    return announcements
        .map((a) => String(a.id))
        .filter((id) => !seenSet.has(id));
}

const TOAST_STORAGE_KEY = "toastShownAnnouncementIds";

export function getToastShownAnnouncementIds(): string[] {
    try {
        const raw = localStorage.getItem(TOAST_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map(String);
        }
        return [];
    } catch {
        return [];
    }
}

export function markToastShownAnnouncementIds(ids: (number | string)[]): void {
    try {
        const existing = getToastShownAnnouncementIds();
        const merged = [...new Set([...existing, ...ids.map(String)])];
        localStorage.setItem(TOAST_STORAGE_KEY, JSON.stringify(merged));
    } catch {
        // localStorage unavailable
    }
}

export function getUnshownToastAnnouncementIds(
    announcements: { id: number | string }[],
    shownIds: string[]
): string[] {
    const shownSet = new Set(shownIds);
    return announcements
        .map((a) => String(a.id))
        .filter((id) => !shownSet.has(id));
}

