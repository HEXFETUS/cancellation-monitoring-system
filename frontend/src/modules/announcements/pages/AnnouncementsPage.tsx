import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AlertCircle,
    Image as ImageIcon,
    Paperclip,
    Pin,
    PinOff,
    Reply,
    Send,
    Trash2,
    User as UserIcon,
    X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const POLL_INTERVAL_MS = 4000;
const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME = /^(image\/(jpe?g|png)|video\/mp4)$/i;
const ACCEPTED_EXT = /\.(jpe?g|png|mp4)$/i;

function apiUrl(p: string) {
    return `${API_BASE_URL}${p}`;
}

function resolveUrl(p?: string | null) {
    if (!p) return "";
    if (/^https?:\/\//i.test(p)) return p;
    return `${API_BASE_URL}${p}`;
}

function isVideoUrl(url: string) {
    return /\.mp4(\?|$)/i.test(url);
}

function initialsOf(name?: string | null) {
    if (!name) return "?";
    const trimmed = name.trim();
    if (!trimmed) return "?";
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const sameDay =
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return time;
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

interface SenderRef {
    id: number | null;
    name: string;
    profile_picture: string | null;
    role: string | null;
}

interface ReplyToPreview {
    id: number;
    sender_name: string;
    message: string;
    attachment_count: number;
}

interface ChatMessage {
    id: number;
    message: string;
    attachment_urls: string[];
    created_at: string;
    is_pinned: boolean;
    reply_to_id: number | null;
    reply_to: ReplyToPreview | null;
    sender: SenderRef;
}

const ROLE_LABELS: Record<string, string> = {
    admin: "Admin",
    csr: "CSR",
    operator: "Operator",
    purchaser: "Purchaser",
};

export default function AnnouncementsPage() {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [pinned, setPinned] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [draft, setDraft] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const [sending, setSending] = useState(false);
    const [composerError, setComposerError] = useState("");

    const [lightbox, setLightbox] = useState<string | null>(null);
    const [highlightId, setHighlightId] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const feedRef = useRef<HTMLDivElement | null>(null);
    const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const lastIdRef = useRef<number>(0);

    const isAdmin = user?.usertype === "admin";

    const scrollToBottom = useCallback((smooth = true) => {
        const el = feedRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    }, []);

    const markRead = useCallback(async (lastId: number) => {
        if (!user?.id || !lastId) return;
        try {
            await fetch(apiUrl("/api/bulletin/read"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: user.id, last_id: lastId }),
            });
        } catch {
            // Read marker is best-effort; transient failures are fine.
        }
    }, [user?.id]);

    // Initial load + pinned banner
    const loadInitial = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        setError("");
        try {
            const [feedRes, pinnedRes] = await Promise.all([
                fetch(apiUrl(`/api/bulletin?user_id=${user.id}&limit=50`)),
                fetch(apiUrl(`/api/bulletin/pinned?user_id=${user.id}`)),
            ]);
            if (!feedRes.ok) throw new Error("Failed to load chat");
            if (!pinnedRes.ok) throw new Error("Failed to load pinned");
            const feedData = await feedRes.json();
            const pinnedData = await pinnedRes.json();
            const list: ChatMessage[] = feedData.messages ?? [];
            setMessages(list);
            setPinned(pinnedData.messages ?? []);
            if (list.length > 0) {
                lastIdRef.current = list[list.length - 1].id;
                markRead(list[list.length - 1].id);
            }
            // Defer to after paint so the layout is complete.
            requestAnimationFrame(() => scrollToBottom(false));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [user?.id, markRead, scrollToBottom]);

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    // Live polling for new messages while the tab is visible.
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;

        const tick = async () => {
            if (cancelled || document.visibilityState !== "visible") return;
            try {
                const after = lastIdRef.current;
                const res = await fetch(
                    apiUrl(`/api/bulletin?user_id=${user.id}&after_id=${after}&limit=50`)
                );
                if (!res.ok) return;
                const data = await res.json();
                const fresh: ChatMessage[] = data.messages ?? [];
                if (fresh.length === 0) return;
                setMessages((prev) => {
                    const seen = new Set(prev.map((m) => m.id));
                    const merged = [...prev];
                    for (const m of fresh) {
                        if (!seen.has(m.id)) merged.push(m);
                    }
                    return merged;
                });
                lastIdRef.current = fresh[fresh.length - 1].id;
                markRead(fresh[fresh.length - 1].id);
                // Auto-scroll only when the user is already near the bottom.
                const el = feedRef.current;
                if (el) {
                    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
                    if (distance < 120) {
                        requestAnimationFrame(() => scrollToBottom(true));
                    }
                }
            } catch {
                // Polling failure is non-fatal.
            }
        };

        const id = window.setInterval(tick, POLL_INTERVAL_MS);
        const onVis = () => {
            if (document.visibilityState === "visible") tick();
        };
        document.addEventListener("visibilitychange", onVis);
        return () => {
            cancelled = true;
            window.clearInterval(id);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [user?.id, markRead, scrollToBottom]);

    // Refresh the pinned banner whenever the message list changes (catches
    // pin/unpin done in another tab too).
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(apiUrl(`/api/bulletin/pinned?user_id=${user.id}`));
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setPinned(data.messages ?? []);
            } catch {
                /* noop */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.id, messages.length]);

    const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? []);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (picked.length === 0) return;

        const next = [...files];
        for (const f of picked) {
            if (next.length >= MAX_ATTACHMENTS) {
                setComposerError(`You can attach at most ${MAX_ATTACHMENTS} files.`);
                break;
            }
            if (!ACCEPTED_MIME.test(f.type) || !ACCEPTED_EXT.test(f.name)) {
                setComposerError("Only JPG, PNG, and MP4 files are allowed.");
                continue;
            }
            if (f.size > MAX_FILE_BYTES) {
                setComposerError(`${f.name} exceeds the 10 MB limit.`);
                continue;
            }
            next.push(f);
        }
        setFiles(next);
    };

    const removeFile = (idx: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSend = async () => {
        if (!user?.id) return;
        const trimmed = draft.trim();
        if (!trimmed && files.length === 0) {
            setComposerError("Type a message or attach a file.");
            return;
        }
        if (trimmed.length > 2000) {
            setComposerError("Message is too long (2000 character max).");
            return;
        }

        setSending(true);
        setComposerError("");
        try {
            const fd = new FormData();
            fd.append("user_id", String(user.id));
            fd.append("message", trimmed);
            if (replyTo) fd.append("reply_to_id", String(replyTo.id));
            for (const f of files) fd.append("attachments", f);

            const res = await fetch(apiUrl("/api/bulletin"), {
                method: "POST",
                body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const code = data?.error || "Failed to send";
                throw new Error(humanizeError(code));
            }
            setMessages((prev) => {
                if (prev.some((m) => m.id === data.id)) return prev;
                return [...prev, data as ChatMessage];
            });
            lastIdRef.current = data.id;
            markRead(data.id);
            setDraft("");
            setFiles([]);
            setReplyTo(null);
            requestAnimationFrame(() => scrollToBottom(true));
        } catch (e) {
            setComposerError(e instanceof Error ? e.message : "Failed to send");
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!user?.id) return;
        if (!window.confirm("Delete this message?")) return;
        try {
            const res = await fetch(apiUrl(`/api/bulletin/${id}?user_id=${user.id}`), {
                method: "DELETE",
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(humanizeError(data?.error || "Failed to delete"));
            }
            setMessages((prev) => prev.filter((m) => m.id !== id));
            setPinned((prev) => prev.filter((m) => m.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to delete");
        }
    };

    const handleTogglePin = async (m: ChatMessage) => {
        if (!user?.id || !isAdmin) return;
        try {
            const res = await fetch(apiUrl(`/api/bulletin/${m.id}/pin`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: user.id, pinned: !m.is_pinned }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(humanizeError(data?.error || "Failed to update pin"));
            }
            const updated: ChatMessage = await res.json();
            setMessages((prev) =>
                prev.map((x) => (x.id === updated.id ? { ...x, is_pinned: updated.is_pinned } : x))
            );
            setPinned((prev) => {
                if (updated.is_pinned) {
                    if (prev.some((x) => x.id === updated.id)) {
                        return prev.map((x) => (x.id === updated.id ? updated : x));
                    }
                    return [updated, ...prev];
                }
                return prev.filter((x) => x.id !== updated.id);
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to update pin");
        }
    };

    const handleScrollToOriginal = (id: number) => {
        const target = messageRefs.current.get(id);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightId(id);
        window.setTimeout(() => setHighlightId(null), 1500);
    };

    // Cluster consecutive messages from the same sender so the avatar +
    // name only render on the first card of each run.
    const clusters = useMemo(() => {
        const out: { showHeader: boolean; msg: ChatMessage }[] = [];
        let prevSender: number | null = null;
        let prevTime = 0;
        for (const m of messages) {
            const t = new Date(m.created_at).getTime();
            const sameSender = m.sender.id === prevSender;
            const closeInTime = t - prevTime < 5 * 60 * 1000; // 5 min cluster window
            out.push({ showHeader: !(sameSender && closeInTime), msg: m });
            prevSender = m.sender.id;
            prevTime = t;
        }
        return out;
    }, [messages]);

    return (
        <div className="flex h-[calc(100vh-160px)] flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-ink">Announcements</h1>
                    <p className="text-sm text-ink-muted">
                        Group chat for everyone. Share updates, ask questions, attach images or videos.
                    </p>
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
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Pinned banner */}
            {pinned.length > 0 && (
                <div className="flex gap-2 overflow-x-auto rounded-2xl border border-amber-200/70 bg-amber-50/60 p-2">
                    {pinned.map((p) => (
                        <button
                            key={`pin-${p.id}`}
                            onClick={() => handleScrollToOriginal(p.id)}
                            className="flex min-w-[260px] max-w-[320px] items-start gap-2 rounded-xl bg-white px-3 py-2 text-left shadow-sm ring-1 ring-amber-200/60 hover:bg-amber-50"
                        >
                            <Pin size={14} className="mt-0.5 shrink-0 text-amber-600" />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                    <span className="truncate">{p.sender.name}</span>
                                </div>
                                <p className="line-clamp-2 text-xs text-ink">{p.message || "(attachment)"}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Message feed */}
            <div
                ref={feedRef}
                className="flex-1 min-h-0 space-y-2 overflow-y-auto rounded-2xl border border-warm bg-white/60 p-4 shadow-inner"
            >
                {loading && messages.length === 0 ? (
                    <p className="text-center text-sm text-ink-subtle">Loading messages...</p>
                ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-subtle">
                        <ImageIcon size={32} className="opacity-40" />
                        <p className="text-sm">No messages yet. Be the first to say hi.</p>
                    </div>
                ) : (
                    clusters.map(({ showHeader, msg }) => (
                        <MessageCard
                            key={msg.id}
                            msg={msg}
                            showHeader={showHeader}
                            isMine={msg.sender.id === user?.id}
                            isAdmin={!!isAdmin}
                            highlight={highlightId === msg.id}
                            registerRef={(el) => {
                                if (el) messageRefs.current.set(msg.id, el);
                                else messageRefs.current.delete(msg.id);
                            }}
                            onReply={() => setReplyTo(msg)}
                            onDelete={() => handleDelete(msg.id)}
                            onTogglePin={() => handleTogglePin(msg)}
                            onScrollToOriginal={handleScrollToOriginal}
                            onOpenLightbox={(url) => setLightbox(url)}
                        />
                    ))
                )}
            </div>

            {/* Composer */}
            <div className="rounded-2xl border border-warm bg-white p-3 shadow-sm">
                {replyTo && (
                    <div className="mb-2 flex items-start gap-2 rounded-lg bg-cream px-3 py-2 text-xs text-ink">
                        <Reply size={14} className="mt-0.5 text-teal-dark" />
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold">Replying to {replyTo.sender.name}</p>
                            <p className="truncate text-ink-muted">{replyTo.message || "(attachment)"}</p>
                        </div>
                        <button
                            onClick={() => setReplyTo(null)}
                            className="rounded p-0.5 text-ink-subtle hover:bg-warm/60"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {files.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                        {files.map((f, idx) => (
                            <div
                                key={`${f.name}-${idx}`}
                                className="flex items-center gap-2 rounded-lg bg-cream px-2 py-1 text-xs text-ink"
                            >
                                <Paperclip size={12} />
                                <span className="max-w-[160px] truncate">{f.name}</span>
                                <button
                                    onClick={() => removeFile(idx)}
                                    className="rounded p-0.5 text-ink-subtle hover:bg-warm/60"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-end gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending || files.length >= MAX_ATTACHMENTS}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-warm bg-card text-ink-muted transition hover:bg-cream disabled:opacity-50"
                        title="Attach files"
                    >
                        <Paperclip size={18} />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,video/mp4"
                        multiple
                        className="hidden"
                        onChange={handlePickFiles}
                    />
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        rows={1}
                        placeholder="Write a message... (Shift+Enter for newline)"
                        disabled={sending}
                        maxLength={2000}
                        className="min-h-[40px] max-h-32 flex-1 resize-y rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal disabled:opacity-50"
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending || (!draft.trim() && files.length === 0)}
                        className="flex h-10 items-center gap-2 rounded-xl bg-teal px-4 text-sm font-semibold text-ink shadow transition hover:bg-teal-dark disabled:opacity-50"
                    >
                        <Send size={16} />
                        {sending ? "Sending..." : "Send"}
                    </button>
                </div>
                {composerError && (
                    <p className="mt-2 text-xs text-red-600">{composerError}</p>
                )}
            </div>

            {/* Lightbox */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setLightbox(null)}
                >
                    <button
                        type="button"
                        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                        onClick={() => setLightbox(null)}
                    >
                        <X size={20} />
                    </button>
                    {isVideoUrl(lightbox) ? (
                        <video
                            src={lightbox}
                            controls
                            autoPlay
                            className="max-h-full max-w-full rounded-xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <img
                            src={lightbox}
                            alt=""
                            className="max-h-full max-w-full rounded-xl object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

function humanizeError(code: string) {
    switch (code) {
        case "EMPTY_MESSAGE":
            return "Message can't be empty.";
        case "MESSAGE_TOO_LONG":
            return "Message is too long (2000 character max).";
        case "ATTACHMENT_TYPE_REJECTED":
            return "Only JPG, PNG, and MP4 files are allowed.";
        case "ATTACHMENT_LIMIT_EXCEEDED":
            return "You can attach at most 5 files.";
        case "ATTACHMENT_TOO_LARGE":
            return "Attachment exceeds the 10 MB limit.";
        case "REPLY_TARGET_NOT_FOUND":
            return "The message you replied to no longer exists.";
        case "FORBIDDEN":
            return "You don't have permission to do that.";
        case "NOT_FOUND":
            return "Message not found.";
        case "UNAUTHENTICATED":
            return "Please sign in again.";
        default:
            return code;
    }
}

interface MessageCardProps {
    msg: ChatMessage;
    showHeader: boolean;
    isMine: boolean;
    isAdmin: boolean;
    highlight: boolean;
    registerRef: (el: HTMLDivElement | null) => void;
    onReply: () => void;
    onDelete: () => void;
    onTogglePin: () => void;
    onScrollToOriginal: (id: number) => void;
    onOpenLightbox: (url: string) => void;
}

function MessageCard({
    msg,
    showHeader,
    isMine,
    isAdmin,
    highlight,
    registerRef,
    onReply,
    onDelete,
    onTogglePin,
    onScrollToOriginal,
    onOpenLightbox,
}: MessageCardProps) {
    const canDelete = isMine || isAdmin;
    const avatar = resolveUrl(msg.sender.profile_picture);
    const roleLabel = msg.sender.role ? ROLE_LABELS[msg.sender.role] ?? msg.sender.role : "";

    return (
        <div
            ref={registerRef}
            className={`group flex gap-3 rounded-xl px-2 py-1.5 transition ${
                highlight ? "ring-2 ring-teal/60 bg-teal/5" : ""
            }`}
        >
            {/* Avatar slot — kept reserved even when hidden so cluster lines align */}
            <div className="w-10 shrink-0">
                {showHeader ? (
                    avatar ? (
                        <img
                            src={avatar}
                            alt={msg.sender.name}
                            className="h-10 w-10 rounded-full object-cover ring-1 ring-warm"
                        />
                    ) : (
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-xs font-bold text-teal-dark ring-1 ring-warm"
                            aria-hidden
                        >
                            {initialsOf(msg.sender.name)}
                        </div>
                    )
                ) : (
                    <div className="h-1" />
                )}
            </div>

            <div className="min-w-0 flex-1">
                {showHeader && (
                    <div className="mb-0.5 flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-ink">{msg.sender.name}</span>
                        {roleLabel && (
                            <span className="rounded-full bg-cream px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                                {roleLabel}
                            </span>
                        )}
                        <span className="text-[11px] text-ink-subtle">{formatTime(msg.created_at)}</span>
                        {msg.is_pinned && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                <Pin size={10} />
                                Pinned
                            </span>
                        )}
                    </div>
                )}

                <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-warm/60">
                    {msg.reply_to && (
                        <button
                            type="button"
                            onClick={() => msg.reply_to && onScrollToOriginal(msg.reply_to.id)}
                            className="mb-1.5 flex w-full items-start gap-2 rounded-lg border-l-2 border-teal/60 bg-cream/70 px-2 py-1 text-left text-xs text-ink-muted hover:bg-cream"
                        >
                            <Reply size={12} className="mt-0.5 shrink-0 text-teal-dark" />
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-ink">{msg.reply_to.sender_name}</p>
                                <p className="truncate">
                                    {msg.reply_to.message ||
                                        (msg.reply_to.attachment_count > 0
                                            ? `(${msg.reply_to.attachment_count} attachment${msg.reply_to.attachment_count === 1 ? "" : "s"})`
                                            : "(empty)")}
                                </p>
                            </div>
                        </button>
                    )}
                    {msg.reply_to_id && !msg.reply_to && (
                        <p className="mb-1.5 rounded-lg bg-cream px-2 py-1 text-xs italic text-ink-subtle">
                            Original message deleted
                        </p>
                    )}

                    {msg.message && (
                        <p className="whitespace-pre-wrap break-words text-sm text-ink">{msg.message}</p>
                    )}

                    {msg.attachment_urls.length > 0 && (
                        <div
                            className={`mt-2 grid gap-1.5 ${
                                msg.attachment_urls.length === 1
                                    ? "grid-cols-1 max-w-md"
                                    : "grid-cols-2 max-w-md"
                            }`}
                        >
                            {msg.attachment_urls.map((url) => {
                                const full = resolveUrl(url);
                                return isVideoUrl(url) ? (
                                    <video
                                        key={url}
                                        src={full}
                                        controls
                                        className="rounded-lg bg-black"
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        key={url}
                                        onClick={() => onOpenLightbox(full)}
                                        className="overflow-hidden rounded-lg bg-cream"
                                    >
                                        <img
                                            src={full}
                                            alt=""
                                            className="h-32 w-full object-cover transition hover:scale-105"
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Hover actions */}
                <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                        type="button"
                        onClick={onReply}
                        title="Reply"
                        className="inline-flex items-center gap-1 rounded-md border border-warm bg-card px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-cream"
                    >
                        <Reply size={11} />
                        Reply
                    </button>
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={onTogglePin}
                            title={msg.is_pinned ? "Unpin" : "Pin"}
                            className="inline-flex items-center gap-1 rounded-md border border-warm bg-card px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-cream"
                        >
                            {msg.is_pinned ? <PinOff size={11} /> : <Pin size={11} />}
                            {msg.is_pinned ? "Unpin" : "Pin"}
                        </button>
                    )}
                    {canDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            title="Delete"
                            className="inline-flex items-center gap-1 rounded-md border border-warm bg-card px-1.5 py-0.5 text-[11px] text-red-500 hover:bg-red-50"
                        >
                            <Trash2 size={11} />
                            Delete
                        </button>
                    )}
                </div>
            </div>

            {/* Reserved icon column (kept for future enhancements) */}
            <div className="hidden">
                <UserIcon />
            </div>
        </div>
    );
}