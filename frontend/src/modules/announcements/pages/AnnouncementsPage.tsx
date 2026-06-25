import { useCallback, useEffect, useRef, useState } from "react";
import {
    AlertCircle,
    Check,
    ChevronDown,
    Clock,
    Eye,
    Globe,
    Megaphone,
    Save,
    Send,
    Trash2,
    X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import type { Announcement } from "../services/announcements";
import {
    createAnnouncement,
    deleteAnnouncement,
    fetchAnnouncements,
    updateAnnouncement,
} from "../services/announcements";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUDIENCE_OPTIONS = [
    { label: "All Users", value: "All Users" },
    { label: "Premium Users", value: "Premium Users" },
    { label: "Beta Testers", value: "Beta Testers" },
    { label: "Administrators", value: "Administrators" },
];

const DISPLAY_OPTIONS = [
    { value: "banner", label: "Banner", desc: "Top of the page", icon: "▬" },
    { value: "popup", label: "Pop-up / Modal", desc: "Center screen", icon: "◻" },
    { value: "toast", label: "Toast Notification", desc: "Bottom-right corner", icon: "◰" },
];

const PRIORITY_OPTIONS = [
    { value: "low", label: "Low", color: "text-gray-500 bg-gray-100" },
    { value: "medium", label: "Medium", color: "text-blue-600 bg-blue-100" },
    { value: "high", label: "High", color: "text-orange-600 bg-orange-100" },
    { value: "critical", label: "Critical", color: "text-red-600 bg-red-100" },
];

const PRIORITY_COLORS: Record<string, string> = {
    low: "text-gray-500 bg-gray-100",
    medium: "text-blue-600 bg-blue-100",
    high: "text-orange-600 bg-orange-100",
    critical: "text-red-600 bg-red-100",
};

const STATUS_COLORS: Record<string, string> = {
    draft: "text-gray-500 bg-gray-100",
    scheduled: "text-blue-600 bg-blue-100",
    published: "text-green-600 bg-green-100",
};

const DISPLAY_ICONS: Record<string, string> = {
    banner: "▬",
    popup: "◻",
    toast: "◰",
};

// ---------------------------------------------------------------------------
// Form state defaults
// ---------------------------------------------------------------------------

interface FormState {
    title: string;
    description: string;
    target_audience: string[];
    display_type: string;
    scheduled_at: string;
    priority_level: string;
}

const EMPTY_FORM: FormState = {
    title: "",
    description: "",
    target_audience: ["All Users"],
    display_type: "banner",
    scheduled_at: "",
    priority_level: "medium",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnnouncementsPage() {
    const { user } = useAuth();
    const isAdmin = user?.usertype === "admin";
    const userId = user?.id;

    // Data
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

    // Form
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    // Audience dropdown
    const [audienceOpen, setAudienceOpen] = useState(false);
    const audienceRef = useRef<HTMLDivElement>(null);

    // Preview
    const [showPreview, setShowPreview] = useState(false);

    // Toast timer
    const successTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const showSuccess = useCallback((msg: string) => {
        setSuccessMsg(msg);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setSuccessMsg(""), 4000);
    }, []);

    // ---- Load announcements ----
    const load = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError("");
        try {
            const data = await fetchAnnouncements(userId, filterStatus);
            setAnnouncements(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [userId, filterStatus]);

    useEffect(() => {
        load();
    }, [load]);

    // ---- Close audience dropdown on click outside ----
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (audienceRef.current && !audienceRef.current.contains(e.target as Node)) {
                setAudienceOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // ---- Toggle audience chip ----
    const toggleAudience = (val: string) => {
        setForm((prev) => {
            const current = prev.target_audience;
            if (current.includes(val)) {
                const next = current.filter((v) => v !== val);
                return { ...prev, target_audience: next.length === 0 ? ["All Users"] : next };
            }
            return { ...prev, target_audience: [...current, val] };
        });
    };

    // ---- Reset form ----
    const resetForm = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setFormError("");
        setShowPreview(false);
    };

    // ---- Edit announcement ----
    const handleEdit = (a: Announcement) => {
        setForm({
            title: a.title,
            description: a.description,
            target_audience: a.target_audience,
            display_type: a.display_type,
            scheduled_at: a.scheduled_at ? a.scheduled_at.slice(0, 16) : "",
            priority_level: a.priority_level,
        });
        setEditingId(a.id);
        setFormError("");
        setShowPreview(false);
    };

    // ---- Submit (create or update) ----
    const handleSubmit = async (status: string) => {
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

        setSubmitting(true);
        setFormError("");
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                target_audience: form.target_audience,
                display_type: form.display_type,
                priority_level: form.priority_level,
                scheduled_at: form.scheduled_at || null,
                status,
            };

            if (editingId) {
                await updateAnnouncement(userId, editingId, payload);
                showSuccess("Announcement updated successfully.");
            } else {
                await createAnnouncement(userId, payload);
                showSuccess("Announcement created successfully.");
            }
            resetForm();
            await load();
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Failed to save");
        } finally {
            setSubmitting(false);
        }
    };

    // ---- Delete ----
    const handleDelete = async (id: number) => {
        if (!userId) return;
        if (!window.confirm("Delete this announcement? This action cannot be undone.")) return;
        try {
            await deleteAnnouncement(userId, id);
            showSuccess("Announcement deleted.");
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to delete");
        }
    };

    // ---- Format date nicely ----
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

    // ---- Render description as simple HTML for preview ----
    const renderDescription = (desc: string) => {
        // Simple markdown-to-HTML: bold, italic, bullet lists, links
        let html = desc
            .replace(/&/g, "&")
            .replace(/</g, "<")
            .replace(/>/g, ">");
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        // Italic
        html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
        // Bullet lists
        html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
        html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");
        // Links
        html = html.replace(
            /\[(.+?)\]\((.+?)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-teal-dark underline">$1</a>'
        );
        // Newlines to <br>
        html = html.replace(/\n/g, "<br />");
        return html;
    };

    // ---- Toolbar for formatting ----
    const insertFormatting = (type: string) => {
        setForm((prev) => {
            const ta = prev.description;
            const snippets: Record<string, string> = {
                bold: "**bold text**",
                italic: "*italic text*",
                bullet: "\n- ",
                link: "[link text](https://example.com)",
            };
            const suffix = snippets[type] || "";
            return { ...prev, description: ta + (ta && !ta.endsWith("\n") ? "\n" : "") + suffix };
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Megaphone size={20} className="text-teal-dark" />
                    <h1 className="text-lg font-bold text-ink">Announcements</h1>
                </div>
            </div>

            {/* Global messages */}
            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                    <button onClick={() => setError("")} className="ml-auto rounded p-0.5 hover:bg-red-100">
                        <X size={14} />
                    </button>
                </div>
            )}

            {successMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-600">
                    <Check size={16} />
                    <span>{successMsg}</span>
                    <button onClick={() => setSuccessMsg("")} className="ml-auto rounded p-0.5 hover:bg-green-100">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Two-column layout */}
            <div className="flex flex-1 min-h-0 gap-4 lg:flex-row flex-col">
                {/* ---- LEFT: Form ---- */}
                <div className="lg:w-[480px] xl:w-[520px] shrink-0 overflow-y-auto rounded-2xl border border-warm bg-white p-5 shadow-sm">
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                        {editingId ? (
                            <>✏️ Edit Announcement</>
                        ) : (
                            <>📢 New Announcement</>
                        )}
                    </h2>

                    {formError && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                            {formError}
                        </div>
                    )}

                    {/* 1. Title */}
                    <div className="mb-4">
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-ink">
                            Announcement Title <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => {
                                    if (e.target.value.length <= 100) setForm((p) => ({ ...p, title: e.target.value }));
                                }}
                                placeholder="e.g., New Feature Released: Dark Mode is Here!"
                                maxLength={100}
                                className="w-full rounded-xl border border-warm bg-card px-3 py-2 pr-16 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-subtle">
                                {form.title.length}/100
                            </span>
                        </div>
                    </div>

                    {/* 2. Description / Rich Text */}
                    <div className="mb-4">
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-ink">
                            Description / Content <span className="text-red-500">*</span>
                        </label>
                        {/* Formatting toolbar */}
                        <div className="mb-1 flex flex-wrap gap-1">
                            <button
                                type="button"
                                onClick={() => insertFormatting("bold")}
                                className="rounded-lg border border-warm bg-card px-2 py-1 text-xs font-bold text-ink-muted hover:bg-cream"
                                title="Bold"
                            >
                                <strong>B</strong>
                            </button>
                            <button
                                type="button"
                                onClick={() => insertFormatting("italic")}
                                className="rounded-lg border border-warm bg-card px-2 py-1 text-xs italic text-ink-muted hover:bg-cream"
                                title="Italic"
                            >
                                <em>I</em>
                            </button>
                            <button
                                type="button"
                                onClick={() => insertFormatting("bullet")}
                                className="rounded-lg border border-warm bg-card px-2 py-1 text-xs text-ink-muted hover:bg-cream"
                                title="Bullet List"
                            >
                                ☰ List
                            </button>
                            <button
                                type="button"
                                onClick={() => insertFormatting("link")}
                                className="rounded-lg border border-warm bg-card px-2 py-1 text-xs text-ink-muted hover:bg-cream"
                                title="Hyperlink"
                            >
                                🔗 Link
                            </button>
                            <span className="ml-auto text-[10px] text-ink-subtle">Supports Markdown</span>
                        </div>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            placeholder="Write your announcement content here... Use **bold**, *italic*, - bullet lists, and [links](url)"
                            rows={8}
                            className="w-full resize-y rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    {/* 3. Target Audience */}
                    <div className="mb-4" ref={audienceRef}>
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-ink">
                            Target Audience <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setAudienceOpen((o) => !o)}
                                className="flex w-full items-center justify-between rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink hover:bg-cream"
                            >
                                <span className="truncate">{form.target_audience.join(", ") || "Select audience"}</span>
                                <ChevronDown size={14} className={`transition ${audienceOpen ? "rotate-180" : ""}`} />
                            </button>
                            {audienceOpen && (
                                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-warm bg-white p-2 shadow-lg">
                                    {AUDIENCE_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => toggleAudience(opt.value)}
                                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-cream ${
                                                form.target_audience.includes(opt.value)
                                                    ? "text-teal-dark font-semibold"
                                                    : "text-ink"
                                            }`}
                                        >
                                            <span
                                                className={`flex h-4 w-4 items-center justify-center rounded border ${
                                                    form.target_audience.includes(opt.value)
                                                        ? "border-teal bg-teal text-white"
                                                        : "border-warm"
                                                }`}
                                            >
                                                {form.target_audience.includes(opt.value) && <Check size={10} />}
                                            </span>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Selected chips */}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {form.target_audience.map((val) => (
                                <span
                                    key={val}
                                    className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-[11px] font-medium text-teal-dark"
                                >
                                    {val}
                                    <button
                                        type="button"
                                        onClick={() => toggleAudience(val)}
                                        className="rounded-full p-0.5 hover:bg-teal/20"
                                    >
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* 4. Display Type */}
                    <div className="mb-4">
                        <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-ink">
                            Display Type (Placement) <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {DISPLAY_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setForm((p) => ({ ...p, display_type: opt.value }))}
                                    className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition ${
                                        form.display_type === opt.value
                                            ? "border-teal bg-teal/5"
                                            : "border-warm bg-card hover:border-teal/40"
                                    }`}
                                >
                                    <span className="text-xl">{opt.icon}</span>
                                    <span className="text-[11px] font-medium text-ink">{opt.label}</span>
                                    <span className="text-[10px] text-ink-subtle">{opt.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 5. Schedule */}
                    <div className="mb-4">
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-ink">
                            <Clock size={12} />
                            Start Date & Time
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="datetime-local"
                                value={form.scheduled_at}
                                onChange={(e) => setForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                                className="flex-1 rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                            />
                        </div>
                        <p className="mt-1 text-[10px] text-ink-subtle">
                            Timezone: Asia/Manila (UTC+8)
                        </p>
                    </div>

                    {/* 6. Priority */}
                    <div className="mb-5">
                        <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-ink">
                            Priority Level <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                            {PRIORITY_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setForm((p) => ({ ...p, priority_level: opt.value }))}
                                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                                        form.priority_level === opt.value
                                            ? "border-teal ring-2 ring-teal/30"
                                            : "border-warm hover:bg-cream"
                                    } ${opt.color}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col gap-2 border-t border-warm pt-4">
                        {isAdmin && (
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSubmit("published")}
                                    disabled={submitting}
                                    className="flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-ink shadow transition hover:bg-teal-dark disabled:opacity-50"
                                >
                                    <Send size={14} />
                                    {submitting ? "Publishing..." : "Publish Now"}
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
                                <button
                                    type="button"
                                    onClick={() => handleSubmit("draft")}
                                    disabled={submitting}
                                    className="flex items-center gap-1.5 rounded-xl border border-warm bg-card px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-cream disabled:opacity-50"
                                >
                                    <Save size={14} />
                                    Save as Draft
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPreview((p) => !p)}
                                    className="flex items-center gap-1.5 rounded-xl border border-warm bg-card px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-cream"
                                >
                                    <Eye size={14} />
                                    {showPreview ? "Hide Preview" : "Preview"}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="flex items-center gap-1.5 rounded-xl border border-warm bg-card px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-cream"
                                    >
                                        <X size={14} />
                                        Cancel Edit
                                    </button>
                                )}
                            </div>
                        )}

                        {!isAdmin && (
                            <p className="text-xs text-ink-subtle">Only administrators can create announcements.</p>
                        )}
                    </div>

                    {/* Preview */}
                    {showPreview && form.title.trim() && (
                        <div className="mt-4 rounded-xl border border-teal/30 bg-teal/5 p-4">
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-dark">
                                Preview
                            </h3>
                            <div className="rounded-lg border border-warm bg-white p-3 shadow-sm">
                                <h4 className="mb-1 text-sm font-bold text-ink">{form.title}</h4>
                                <div
                                    className="prose prose-sm max-w-none text-sm text-ink"
                                    dangerouslySetInnerHTML={{ __html: renderDescription(form.description) }}
                                />
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {form.target_audience.map((a) => (
                                        <span
                                            key={a}
                                            className="rounded-full bg-cream px-2 py-0.5 text-[10px] text-ink-muted"
                                        >
                                            {a}
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-[10px] text-ink-subtle">
                                    <span>📍 {DISPLAY_OPTIONS.find((d) => d.value === form.display_type)?.label}</span>
                                    <span
                                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                            PRIORITY_COLORS[form.priority_level] || ""
                                        }`}
                                    >
                                        {form.priority_level}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ---- RIGHT: Announcement list ---- */}
                <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl border border-warm bg-white/60 shadow-sm">
                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 border-b border-warm px-4 py-2">
                            {["all", "published", "scheduled", "draft"].map((tab) => {
                                const counts = {
                                    all: announcements.length,
                                    published: announcements.filter((a) => a.status === "published").length,
                                    scheduled: announcements.filter((a) => a.status === "scheduled").length,
                                    draft: announcements.filter((a) => a.status === "draft").length,
                                };
                                const isActive = filterStatus === tab || (tab === "all" && !filterStatus);
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setFilterStatus(tab === "all" ? undefined : tab)}
                                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition hover:bg-cream ${
                                            isActive
                                                ? "bg-teal/10 text-teal-dark"
                                                : "text-ink-muted"
                                        }`}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)} ({counts[tab as keyof typeof counts]})
                                    </button>
                                );
                            })}
                        <Globe size={14} className="ml-auto text-ink-subtle" />
                    </div>

                    {/* List */}
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
                                        className="group rounded-xl border border-warm bg-white p-3 shadow-xs transition hover:shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className="truncate text-sm font-semibold text-ink">
                                                        {a.title}
                                                    </h4>
                                                    <span
                                                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                                            STATUS_COLORS[a.status] || ""
                                                        }`}
                                                    >
                                                        {a.status}
                                                    </span>
                                                    <span
                                                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                                            PRIORITY_COLORS[a.priority_level] || ""
                                                        }`}
                                                    >
                                                        {a.priority_level}
                                                    </span>
                                                </div>
                                                <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                                                    {a.description}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-ink-subtle">
                                                    <span>👤 {a.created_by_name}</span>
                                                    <span>🕐 {fmtDate(a.created_at)}</span>
                                                    {a.published_at && <span>✅ {fmtDate(a.published_at)}</span>}
                                                    <span className="rounded bg-cream px-1 py-0.5">
                                                        {DISPLAY_ICONS[a.display_type] || "▬"}{" "}
                                                        {a.display_type}
                                                    </span>
                                                    {a.target_audience.length > 0 && (
                                                        <span className="truncate max-w-[120px]">
                                                            👥 {a.target_audience.join(", ")}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            {isAdmin && (
                                                <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(a)}
                                                        className="rounded-lg border border-warm bg-card px-2 py-1 text-[11px] text-ink-muted hover:bg-cream"
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(a.id)}
                                                        className="rounded-lg border border-warm bg-card px-2 py-1 text-[11px] text-red-500 hover:bg-red-50"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}