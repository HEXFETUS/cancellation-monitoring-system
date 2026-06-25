import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    AlertCircle,
    Check,
    Clock,
    Megaphone,
    Pencil,
    Send,
    Smile,
    Trash2,
    X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import type { AdminAnnouncement } from "../services/adminAnnouncements";
import {
    createAdminAnnouncement,
    fetchAdminAnnouncements,
    updateAdminAnnouncement,
    deleteAdminAnnouncement,
} from "../services/adminAnnouncements";
import { ConfirmationModal, Toast } from "../../../shared/components";
import EmojiPicker from "../../messages/components/EmojiPicker";

interface FormState {
    title: string;
    description: string;
    scheduled_at: string;
}

const EMPTY_FORM: FormState = {
    title: "",
    description: "",
    scheduled_at: "",
};

export default function AnnouncementsPage() {
    const { user } = useAuth();
    const userId = user?.id;

    const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emojiPickerPosition, setEmojiPickerPosition] = useState({ top: 0, left: 0 });
    const [showPostConfirm, setShowPostConfirm] = useState(false);
    const [pendingAction, setPendingAction] = useState<"published" | "scheduled" | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [toast, setToast] = useState<{ open: boolean; message: string; type: "success" | "error" }>({
        open: false,
        message: "",
        type: "success",
    });
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);

    const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
        setToast({ open: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, open: false }));
    }, []);

    const load = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError("");
        try {
            const data = await fetchAdminAnnouncements(userId);
            setAnnouncements(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    const resetForm = () => {
        setForm(EMPTY_FORM);
        setFormError("");
        setEditingId(null);
    };

    const startEdit = (a: AdminAnnouncement) => {
        setEditingId(a.id);
        let localScheduled = "";
        if (a.scheduled_at) {
            const d = new Date(a.scheduled_at);
            const offset = d.getTimezoneOffset();
            const local = new Date(d.getTime() - offset * 60 * 1000);
            localScheduled = local.toISOString().slice(0, 16);
        }
        setForm({
            title: a.title,
            description: a.description,
            scheduled_at: localScheduled,
        });
        setFormError("");
        document.querySelector(".lg\\:w-\\[480px\\]")?.scrollIntoView({ behavior: "smooth" });
    };

    const cancelEdit = () => {
        setEditingId(null);
        resetForm();
    };

    const handleUpdate = async () => {
        if (!editingId || !userId) return;
        setSubmitting(true);
        setFormError("");
        try {
            const scheduledAt = form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null;
            const original = announcements.find((a) => a.id === editingId);
            const status: "published" | "scheduled" = original?.status === "scheduled" ? "scheduled" : "published";
            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                status,
                scheduled_at: scheduledAt,
                created_by: userId,
            };
            await updateAdminAnnouncement(editingId, payload);
            showToast("Announcement updated.", "success");
            resetForm();
            await load();
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Failed to update");
        } finally {
            setSubmitting(false);
        }
    };

    const askDelete = (id: number) => {
        setDeleteTargetId(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;
        setSubmitting(true);
        try {
            await deleteAdminAnnouncement(deleteTargetId);
            showToast("Announcement deleted.", "success");
            if (editingId === deleteTargetId) resetForm();
            await load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Failed to delete", "error");
        } finally {
            setSubmitting(false);
            setShowDeleteModal(false);
            setDeleteTargetId(null);
        }
    };

    const insertEmoji = (emoji: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = form.description;
        const next = value.slice(0, start) + emoji + value.slice(end);
        setForm((p) => ({ ...p, description: next }));
        requestAnimationFrame(() => {
            textarea.focus();
            const pos = start + emoji.length;
            textarea.setSelectionRange(pos, pos);
        });
        setShowEmojiPicker(false);
    };

    const positionEmojiPicker = useCallback(() => {
        const button = emojiButtonRef.current;
        if (!button) return;
        const rect = button.getBoundingClientRect();
        const pickerWidth = Math.min(320, window.innerWidth - 24);
        const left = Math.min(
            Math.max(12, rect.right - pickerWidth),
            window.innerWidth - pickerWidth - 12
        );
        setEmojiPickerPosition({
            top: rect.bottom + 8,
            left,
        });
    }, []);

    const toggleEmojiPicker = () => {
        if (!showEmojiPicker) positionEmojiPicker();
        setShowEmojiPicker((v) => !v);
    };

    useEffect(() => {
        if (!showEmojiPicker) return;
        positionEmojiPicker();
        window.addEventListener("resize", positionEmojiPicker);
        window.addEventListener("scroll", positionEmojiPicker, true);
        return () => {
            window.removeEventListener("resize", positionEmojiPicker);
            window.removeEventListener("scroll", positionEmojiPicker, true);
        };
    }, [positionEmojiPicker, showEmojiPicker]);

    const handleSubmit = async (status: "published" | "scheduled") => {
        if (!userId) return;
        if (!form.title.trim()) {
            setFormError("Title is required.");
            return;
        }
        if (!form.description.trim()) {
            setFormError("Description is required.");
            return;
        }
        if (form.title.length > 100) {
            setFormError("Title must be 100 characters or less.");
            return;
        }
        if (status === "scheduled" && !form.scheduled_at) {
            setFormError("Please select a date and time to schedule.");
            return;
        }

        setPendingAction(status);
        setShowPostConfirm(true);
    };

    const confirmSubmit = async () => {
        if (!pendingAction || !userId) return;
        setSubmitting(true);
        setFormError("");
        try {
            const scheduledAt = pendingAction === "scheduled" && form.scheduled_at
                ? new Date(form.scheduled_at).toISOString()
                : null;

            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                status: pendingAction,
                scheduled_at: scheduledAt,
                created_by: userId,
            };

            await createAdminAnnouncement(userId, payload);
            showToast(pendingAction === "published" ? "Announcement published." : "Announcement scheduled.", "success");
            resetForm();
            await load();
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Failed to save");
        } finally {
            setSubmitting(false);
            setShowPostConfirm(false);
            setPendingAction(null);
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
                    <button onClick={() => setError("")} className="ml-auto rounded p-0.5 hover:bg-red-100">
                        <X size={14} />
                    </button>
                </div>
            )}

            <div className="flex flex-1 min-h-0 gap-4 lg:flex-row flex-col">
                <div className="lg:w-[480px] xl:w-[520px] shrink-0 overflow-y-auto rounded-2xl border border-warm bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-semibold text-ink">
                        {editingId ? "Edit Announcement" : "New Announcement"}
                    </h2>

                    {formError && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                            {formError}
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => {
                                if (e.target.value.length <= 100) setForm((p) => ({ ...p, title: e.target.value }));
                            }}
                            placeholder="Announcement title"
                            maxLength={100}
                            className="w-full rounded-xl border border-warm bg-card px-3 py-2 pr-12 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                        <div className="mt-1 text-right text-[11px] text-ink-subtle">
                            {form.title.length}/100
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Content <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <textarea
                                ref={textareaRef}
                                value={form.description}
                                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                                placeholder="Write your announcement content..."
                                rows={6}
                                className="w-full resize-y rounded-xl border border-warm bg-card px-3 py-2 pr-9 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                            />
                            <button
                                ref={emojiButtonRef}
                                type="button"
                                onClick={toggleEmojiPicker}
                                className="absolute bottom-2 right-2 text-slate-400 transition-colors hover:text-slate-600"
                                title="Emoji"
                            >
                                <Smile className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="mb-5">
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-ink">
                            <Clock size={12} />
                            Schedule (optional)
                        </label>
                        <input
                            type="datetime-local"
                            value={form.scheduled_at}
                            onChange={(e) => setForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                            className="w-full rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                        <p className="mt-1 text-[10px] text-ink-subtle">
                            Leave empty to publish immediately.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {editingId ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleUpdate}
                                    disabled={submitting}
                                    className="flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-ink shadow transition hover:bg-teal-dark disabled:opacity-50"
                                >
                                    <Send size={14} />
                                    {submitting ? "Updating..." : "Update"}
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
                                    disabled={submitting}
                                    className="flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-ink shadow transition hover:bg-teal-dark disabled:opacity-50"
                                >
                                    <Send size={14} />
                                    {submitting ? "Posting..." : "Post Now"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSubmit("scheduled")}
                                    disabled={submitting || !form.scheduled_at}
                                    className="flex items-center gap-1.5 rounded-xl border border-teal bg-teal/10 px-4 py-2 text-sm font-semibold text-teal-dark transition hover:bg-teal/20 disabled:opacity-50"
                                >
                                    <Clock size={14} />
                                    {submitting ? "Scheduling..." : "Schedule"}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl border border-warm bg-white/60 shadow-sm">
                    <div className="flex-1 overflow-y-auto p-3">
                        {loading ? (
                            <div className="flex h-full items-center justify-center">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
                            </div>
                        ) : announcements.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-subtle">
                                <Megaphone size={28} className="opacity-30" />
                                <p className="text-sm">No announcements yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {announcements.map((a) => (
                                    <div
                                        key={a.id}
                                        className="rounded-xl border border-warm bg-white p-3 shadow-xs"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className="truncate text-sm font-semibold text-ink">
                                                        {a.title}
                                                    </h4>
                                                    <span
                                                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                                            a.status === "published"
                                                                ? "text-green-700 bg-green-100"
                                                                : "text-blue-700 bg-blue-100"
                                                        }`}
                                                    >
                                                        {a.status}
                                                    </span>
                                                </div>
                                                <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                                                    {a.description}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-ink-subtle">
                                                    <span>👤 {a.created_by_name}</span>
                                                    <span>🕐 {fmtDate(a.created_at)}</span>
                                                    {a.published_at && <span>✅ {fmtDate(a.published_at)}</span>}
                                                    {a.scheduled_at && <span>⏳ {fmtDate(a.scheduled_at)}</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(a)}
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                                    title="Edit"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => askDelete(a.id)}
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
                title={pendingAction === "published" ? "Post Announcement?" : "Schedule Announcement?"}
                message={
                    pendingAction === "published"
                        ? "This announcement will be published immediately."
                        : "This announcement will be scheduled for the selected date and time."
                }
                confirmLabel={pendingAction === "published" ? "Post Now" : "Schedule"}
                onConfirm={confirmSubmit}
                onCancel={() => {
                    setShowPostConfirm(false);
                    setPendingAction(null);
                }}
                isLoading={submitting}
            />

            <ConfirmationModal
                open={showDeleteModal}
                title="Delete Announcement"
                message="Are you sure you want to delete this announcement? This action cannot be undone."
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

            {showEmojiPicker &&
                createPortal(
                    <EmojiPicker
                        onSelect={insertEmoji}
                        onClose={() => setShowEmojiPicker(false)}
                        className="fixed z-[9999] flex max-h-64 w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                        style={{
                            top: emojiPickerPosition.top,
                            left: emojiPickerPosition.left,
                        }}
                    />,
                    document.body
                )}
        </div>
    );
}