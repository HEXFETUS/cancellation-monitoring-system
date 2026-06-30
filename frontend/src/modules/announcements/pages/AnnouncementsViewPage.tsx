import { useEffect, useState } from "react";
import {
    AlertCircle,
    Megaphone,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import type { AdminAnnouncement } from "../services/adminAnnouncements";
import { fetchVisibleAdminAnnouncements } from "../services/adminAnnouncements";
import {

    markAnnouncementsAsSeen,
} from "../services/announcementSeenStorage";

export default function AnnouncementsViewPage() {
    const { user } = useAuth();
    const userId = user?.id;

    const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        const load = async () => {
            try {
                const data = await fetchVisibleAdminAnnouncements(userId);
                if (!cancelled) {
                    setAnnouncements(data);

                    // Mark all visible announcements as seen (clears nav red dot)
                    markAnnouncementsAsSeen(data.map((a) => a.id));

                    // Notify DashboardLayout to re-check unseen count
                    window.dispatchEvent(new Event("announcements-seen-updated"));
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : "Failed to load announcements");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const fmtDate = (iso: string | null) => {
        if (!iso) return "—";
        return new Date(iso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Megaphone size={20} className="text-teal-dark" />
                    <h1 className="text-lg font-bold text-ink">Announcements</h1>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                    <button
                        onClick={() => setError("")}
                        className="ml-auto rounded p-0.5 hover:bg-red-100"
                    >
                        <span className="sr-only">Close</span>
                        ✕
                    </button>
                </div>
            )}

            <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl border border-warm bg-white/60 shadow-sm">
                <div className="flex-1 overflow-y-auto p-3">
                    {loading ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
                        </div>
                    ) : announcements.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-subtle">
                            <Megaphone size={28} className="opacity-30" />
                            <p className="text-sm">No announcements available.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {announcements.map((a) => (
                                <div
                                    key={a.id}
                                    className="rounded-2xl border border-warm bg-white p-5 shadow-sm transition hover:shadow-md"
                                >
                                    <h4 className="truncate text-sm font-semibold text-ink">
                                        {a.title}
                                    </h4>
                                    <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-muted">
                                        {a.description}
                                    </p>
                                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-subtle">
                                        {a.published_at && (
                                            <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-green-700">
                                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                                Published: {fmtDate(a.published_at)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}