import { useCallback, useEffect, useRef, useState } from "react";
import {
    CalendarClock,
    ImagePlus,
    MapPin,
    Newspaper,
    Pencil,
    Send,
    Trash2,
    X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { ConfirmationModal, Toast } from "../../../shared/components";
import {
    createEventsNews,
    deleteEventsNews,
    fetchEventsNews,
    updateEventsNews,
    type EventsNewsItem,
} from "../services/eventsNews";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

interface SelectedMedia {
    file: File;
    preview: string;
}

export default function EventsNewsAdminPage() {
    const { user } = useAuth();
    const userId = user?.id;

    const [posts, setPosts] = useState<EventsNewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Composer state
    const [title, setTitle] = useState("");
    const [caption, setCaption] = useState("");
    const [type, setType] = useState<"event" | "news">("news");
    const [location, setLocation] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [media, setMedia] = useState<SelectedMedia[]>([]);
    // Server media URLs kept while editing an existing post
    const [serverMedia, setServerMedia] = useState<string[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    // Pending action for the confirmation modal
    const [pendingStatus, setPendingStatus] = useState<"published" | "scheduled" | null>(null);
    const [showPostConfirm, setShowPostConfirm] = useState(false);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    const [toast, setToast] = useState<{ open: boolean; message: string; type: "success" | "error" }>({
        open: false,
        message: "",
        type: "success",
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
        setToast({ open: true, message, type });
    }, []);
    const hideToast = useCallback(() => setToast((p) => ({ ...p, open: false })), []);

    const load = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError("");
        try {
            const data = await fetchEventsNews();
            setPosts(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    // Revoke object URLs on unmount
    useEffect(() => {
        return () => {
            media.forEach((m) => URL.revokeObjectURL(m.preview));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resetForm = () => {
        setTitle("");
        setCaption("");
        setType("news");
        setLocation("");
        setScheduledAt("");
        media.forEach((m) => URL.revokeObjectURL(m.preview));
        setMedia([]);
        setServerMedia([]);
        setEditingId(null);
        setFormError("");
    };

    const removeServerMedia = (index: number) => {
        setServerMedia((prev) => prev.filter((_, i) => i !== index));
    };

    const startEdit = (p: EventsNewsItem) => {
        setEditingId(p.id);
        setTitle(p.title ?? "");
        setCaption(p.caption);
        setType(p.type);
        setLocation(p.location);
        setServerMedia(p.media_urls);
        media.forEach((m) => URL.revokeObjectURL(m.preview));
        setMedia([]);
        setFormError("");
        let localScheduled = "";
        if (p.scheduled_at) {
            const d = new Date(p.scheduled_at);
            const offset = d.getTimezoneOffset();
            const local = new Date(d.getTime() - offset * 60 * 1000);
            localScheduled = local.toISOString().slice(0, 16);
        }
        setScheduledAt(localScheduled);
        document.querySelector(".lg\\:w-\\[480px\\]")?.scrollIntoView({ behavior: "smooth" });
    };

    const cancelEdit = () => resetForm();

    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        const next: SelectedMedia[] = [];
        for (const file of Array.from(files)) {
            const okImage = /image\/(jpe?g|png)/i.test(file.type);
            const okVideo = /video\/mp4/i.test(file.type);
            if (okImage || okVideo) {
                next.push({ file, preview: URL.createObjectURL(file) });
            }
        }
        setMedia((prev) => [...prev, ...next].slice(0, 5));
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeMedia = (index: number) => {
        setMedia((prev) => {
            const target = prev[index];
            if (target) URL.revokeObjectURL(target.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSubmit = (status: "published" | "scheduled") => {
        if (!caption.trim()) {
            setFormError("Caption is required.");
            return;
        }
        if (status === "scheduled" && !scheduledAt) {
            setFormError("Please select a date and time to schedule.");
            return;
        }
        setPendingStatus(status);
        setShowPostConfirm(true);
    };

    const confirmSubmit = async () => {
        if (!pendingStatus || !userId) return;
        setSubmitting(true);
        setFormError("");
        try {
            const scheduledIso =
                pendingStatus === "scheduled" && scheduledAt
                    ? new Date(scheduledAt).toISOString()
                    : null;

            if (editingId !== null) {
                await updateEventsNews(editingId, userId, {
                    title: title.trim(),
                    caption: caption.trim(),
                    type,
                    location: location.trim(),
                    status: pendingStatus,
                    scheduled_at: scheduledIso,
                    existingMedia: serverMedia,
                    media: media.map((m) => m.file),
                });
                showToast("Post updated.", "success");
            } else {
                await createEventsNews(userId, {
                    title: title.trim(),
                    caption: caption.trim(),
                    type,
                    location: location.trim(),
                    status: pendingStatus,
                    scheduled_at: scheduledIso,
                    media: media.map((m) => m.file),
                });
                showToast(
                    pendingStatus === "published" ? "Post published." : "Post scheduled.",
                    "success"
                );
            }
            resetForm();
            await load();
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Failed to save");
        } finally {
            setSubmitting(false);
            setShowPostConfirm(false);
            setPendingStatus(null);
        }
    };

    const askDelete = (id: number) => {
        setDeleteTargetId(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId || !userId) return;
        setSubmitting(true);
        try {
            await deleteEventsNews(deleteTargetId, userId);
            showToast("Post deleted.", "success");
            await load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Failed to delete", "error");
        } finally {
            setSubmitting(false);
            setShowDeleteModal(false);
            setDeleteTargetId(null);
        }
    };

    const fmtDate = (iso: string | null) => {
        if (!iso) return "—";
        return new Date(iso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            <div className="flex items-center gap-2">
                <Newspaper size={20} className="text-teal-dark" />
                <h1 className="text-lg font-bold text-ink">Events & News</h1>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    <span>{error}</span>
                </div>
            )}

            <div className="flex flex-1 min-h-0 gap-4 lg:flex-row flex-col">
                {/* ─── Facebook-style composer ─── */}
                <div className="lg:w-[480px] xl:w-[520px] shrink-0 overflow-y-auto rounded-2xl border border-warm bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-semibold text-ink">
                        {editingId ? "Edit Post" : "Create a Post"}
                    </h2>

                    {formError && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                            {formError}
                        </div>
                    )}

                    {/* Type toggle */}
                    <div className="mb-4 flex gap-2">
                        {(["event", "news"] as const).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setType(t)}
                                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold capitalize transition ${
                                    type === t
                                        ? "bg-teal text-ink shadow"
                                        : "border border-warm bg-card text-ink-muted hover:bg-slate-50"
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Title (optional) */}
                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Title{" "}
                            <span className="text-ink-subtle">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Add a title…"
                            maxLength={255}
                            className="w-full rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    {/* Caption */}
                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Caption <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder="What's happening? Share an event or news update…"
                            rows={5}
                            className="w-full resize-y rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    {/* Photo attach */}
                    <div className="mb-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,video/mp4"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-warm bg-card px-3 py-3 text-sm font-medium text-teal-dark transition hover:bg-teal/10"
                        >
                            <ImagePlus size={16} />
                            Add Photos / Video
                        </button>

                        {media.length > 0 && (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                {media.map((m, i) => (
                                    <div
                                        key={m.preview}
                                        className="group relative aspect-square overflow-hidden rounded-lg border border-warm bg-black/5"
                                    >
                                        {m.file.type.startsWith("video") ? (
                                            <video
                                                src={m.preview}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <img
                                                src={m.preview}
                                                alt="preview"
                                                className="h-full w-full object-cover"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeMedia(i)}
                                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                                            title="Remove"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Existing server media (editable) */}
                        {serverMedia.length > 0 && (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                {serverMedia.map((url, i) => (
                                    <div
                                        key={url}
                                        className="group relative aspect-square overflow-hidden rounded-lg border border-warm bg-black/5"
                                    >
                                        {/\.mp4$/i.test(url) ? (
                                            <video
                                                src={`${API_BASE}${url}`}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <img
                                                src={`${API_BASE}${url}`}
                                                alt="server media"
                                                className="h-full w-full object-cover"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeServerMedia(i)}
                                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                                            title="Remove"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <p className="mt-1 text-[10px] text-ink-subtle">
                            Up to 5 images (JPG/PNG) or MP4 videos, 10 MB each.
                        </p>
                    </div>

                    {/* Location */}
                    <div className="mb-4">
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-ink">
                            <MapPin size={12} />
                            Location <span className="text-ink-subtle">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g. Davao City"
                            className="w-full rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    {/* Schedule */}
                    <div className="mb-5">
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-ink">
                            <CalendarClock size={12} />
                            Schedule (optional)
                        </label>
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            className="w-full rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                        <p className="mt-1 text-[10px] text-ink-subtle">
                            Leave empty to publish immediately when you click Post.
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                        {editingId ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleSubmit("published")}
                                    disabled={submitting || !caption.trim()}
                                    className="flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-ink shadow transition hover:bg-teal-dark disabled:opacity-50"
                                >
                                    <Send size={14} />
                                    {submitting ? "Updating…" : "Update"}
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    disabled={submitting}
                                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <X size={14} />
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleSubmit("published")}
                                    disabled={submitting || !caption.trim()}
                                    className="flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-ink shadow transition hover:bg-teal-dark disabled:opacity-50"
                                >
                                    <Send size={14} />
                                    {submitting ? "Posting…" : "Post"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSubmit("scheduled")}
                                    disabled={submitting || !scheduledAt || !caption.trim()}
                                    className="flex items-center gap-1.5 rounded-xl border border-teal bg-teal/10 px-4 py-2 text-sm font-semibold text-teal-dark transition hover:bg-teal/20 disabled:opacity-50"
                                >
                                    <CalendarClock size={14} />
                                    {submitting ? "Scheduling…" : "Schedule Post"}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ─── Existing posts ─── */}
                <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl border border-warm bg-white/60 shadow-sm">
                    <div className="flex-1 overflow-y-auto p-3">
                        {loading ? (
                            <div className="flex h-full items-center justify-center">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-subtle">
                                <Newspaper size={28} className="opacity-30" />
                                <p className="text-sm">No posts yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {posts.map((p) => (
                                    <div
                                        key={p.id}
                                        className="rounded-xl border border-warm bg-white p-3 shadow-xs"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    {p.title && (
                                                        <h4 className="truncate text-sm font-semibold text-ink">
                                                            {p.title}
                                                        </h4>
                                                    )}
                                                    <span
                                                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                                                            p.type === "event"
                                                                ? "bg-teal/15 text-teal-dark"
                                                                : "bg-slate-100 text-slate-600"
                                                        }`}
                                                    >
                                                        {p.type}
                                                    </span>
                                                    <span
                                                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                                            p.status === "published"
                                                                ? "text-green-700 bg-green-100"
                                                                : "text-blue-700 bg-blue-100"
                                                        }`}
                                                    >
                                                        {p.status}
                                                    </span>
                                                </div>
                                                <p className="mt-0.5 line-clamp-3 text-xs text-ink-muted">
                                                    {p.caption}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-ink-subtle">
                                                    <span>🕐 {fmtDate(p.created_at)}</span>
                                                    {p.location && (
                                                        <span className="flex items-center gap-0.5">
                                                            <MapPin size={10} /> {p.location}
                                                        </span>
                                                    )}
                                                    {p.scheduled_at && (
                                                        <span>⏳ {fmtDate(p.scheduled_at)}</span>
                                                    )}
                                                    {p.media_urls.length > 0 && (
                                                        <span>🖼 {p.media_urls.length}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(p)}
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                                    title="Edit"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => askDelete(p.id)}
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmationModal
                open={showPostConfirm}
                title={pendingStatus === "published" ? "Post Now?" : "Schedule Post?"}
                message={
                    pendingStatus === "published"
                        ? "This post will appear on the landing page immediately."
                        : "This post will be published on the selected date and time."
                }
                confirmLabel={pendingStatus === "published" ? "Post" : "Schedule"}
                onConfirm={confirmSubmit}
                onCancel={() => {
                    setShowPostConfirm(false);
                    setPendingStatus(null);
                }}
                isLoading={submitting}
            />

            <ConfirmationModal
                open={showDeleteModal}
                title="Delete Post"
                message="Are you sure you want to delete this post? This action cannot be undone."
                confirmLabel="Delete"
                variant="delete"
                onConfirm={confirmDelete}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setDeleteTargetId(null);
                }}
                isLoading={submitting}
            />

            <Toast
                open={toast.open}
                message={toast.message}
                type={toast.type}
                onClose={hideToast}
                position="top-center"
            />
        </div>
    );
}