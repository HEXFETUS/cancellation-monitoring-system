import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    ChevronLeft,
    ChevronRight,
    Filter,
    RefreshCw,
    Search,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const PAGE_SIZE = 25;

function apiUrl(p: string) {
    return `${API_BASE_URL}${p}`;
}

interface ActivityLog {
    id: number;
    user_id: number | null;
    user_name: string;
    user_role: string | null;
    action: string;
    entity: string;
    entity_id: number | null;
    summary: string | null;
    details: unknown;
    created_at: string;
}

const ROLE_BADGE: Record<string, string> = {
    admin: "bg-rose/30 text-rose-dark border-rose/40",
    csr: "bg-teal-light/40 text-ink border-teal/30",
    operator: "bg-amber-100 text-amber-700 border-amber-200",
    purchaser: "bg-violet-100 text-violet-700 border-violet-200",
};

const ACTION_BADGE: Record<string, string> = {
    create: "bg-emerald-100 text-emerald-700 border-emerald-200",
    update: "bg-blue-100 text-blue-700 border-blue-200",
    delete: "bg-red-100 text-red-700 border-red-200",
    upload: "bg-indigo-100 text-indigo-700 border-indigo-200",
    pin: "bg-amber-100 text-amber-700 border-amber-200",
    unpin: "bg-amber-50 text-amber-600 border-amber-200",
    login: "bg-cream text-ink border-warm",
    logout: "bg-cream text-ink-muted border-warm",
};

function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function ActivityLogsPage() {
    const { user } = useAuth();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState<string>("");
    const [entityFilter, setEntityFilter] = useState<string>("");
    const [search, setSearch] = useState("");

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const fetchLogs = async () => {
        if (!user?.id) return;
        setLoading(true);
        setError(null);
        try {
            const offset = (page - 1) * PAGE_SIZE;
            const params = new URLSearchParams();
            params.set("limit", String(PAGE_SIZE));
            params.set("offset", String(offset));
            if (actionFilter) params.set("action", actionFilter);
            if (entityFilter) params.set("entity", entityFilter);

            const res = await fetch(apiUrl(`/api/activity-logs?${params.toString()}`), {
                headers: {
                    // Admin gate on the backend keys off this header. The
                    // backend ensures only admin callers see this endpoint —
                    // including other admins' activity.
                    "x-user-id": String(user.id),
                },
            });
            if (res.status === 403) {
                throw new Error("Only admins can view activity logs.");
            }
            if (!res.ok) throw new Error("Failed to load activity logs");
            const data = await res.json();
            setLogs(data.logs ?? []);
            setTotal(Number(data.total ?? 0));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, actionFilter, entityFilter, user?.id]);

    // Reset to page 1 when filters change.
    useEffect(() => {
        setPage(1);
    }, [actionFilter, entityFilter]);

    // Search applies to whatever is currently on the page (client-side); it
    // intentionally doesn't refetch so the admin can scan the visible window.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return logs;
        return logs.filter((l) =>
            [l.user_name, l.action, l.entity, l.summary, String(l.entity_id ?? "")]
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [logs, search]);

    return (
        <div>
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-ink">Activity Logs</h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        See all users' actions across the system — additions, edits, deletions, and uploads.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={fetchLogs}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-card px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-cream disabled:opacity-50"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                    <Search
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle dark:text-gray-500"
                        size={16}
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search this page..."
                        className="w-full rounded-lg border border-warm dark:border-gray-700 bg-card dark:bg-gray-800/70 pl-9 pr-3 py-2 text-sm text-ink dark:text-gray-100 placeholder:text-ink-subtle dark:placeholder:text-gray-400 focus:border-teal dark:focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal dark:focus:ring-teal/50"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-ink-subtle" />
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="rounded-lg border border-warm bg-card px-2 py-1.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                    >
                        <option value="">All actions</option>
                        <option value="create">Create</option>
                        <option value="update">Update</option>
                        <option value="delete">Delete</option>
                        <option value="upload">Upload</option>
                        <option value="pin">Pin</option>
                        <option value="unpin">Unpin</option>
                        <option value="login">Login</option>
                        <option value="logout">Logout</option>
                    </select>
                    <select
                        value={entityFilter}
                        onChange={(e) => setEntityFilter(e.target.value)}
                        className="rounded-lg border border-warm bg-card px-2 py-1.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                    >
                        <option value="">All entities</option>
                        <option value="user">User</option>
                        <option value="user_password">User password</option>
                        <option value="profile_picture">Profile picture</option>
                        <option value="asset">Asset</option>
                        <option value="asset_remarks">Asset remarks</option>
                        <option value="asset_media">Asset media</option>
                        <option value="asset_code">Asset code</option>
                        <option value="bulletin_message">Bulletin message</option>
                        <option value="announcement">Announcement</option>
                        <option value="lottery_result">Lottery result</option>
                        <option value="session">Session</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-warm bg-cream">
                            <Th>User</Th>
                            <Th>Role</Th>
                            <Th>Action</Th>
                            <Th>Entity</Th>
                            <Th>Summary</Th>
                            <Th>Timestamp</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-ink-subtle">
                                    Loading activity...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-ink-subtle">
                                    {logs.length === 0
                                        ? "No activity recorded yet."
                                        : "No matching activity on this page."}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((log) => (
                                <tr
                                    key={log.id}
                                    className="border-b border-warm/60 transition hover:bg-cream"
                                >
                                    <td className="px-4 py-3 text-sm text-ink">
                                        {log.user_name}
                                    </td>
                                    <td className="px-4 py-3">
                                        {log.user_role ? (
                                            <span
                                                className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_BADGE[log.user_role] ??
                                                    "border-warm bg-cream text-ink-muted"
                                                    }`}
                                            >
                                                {log.user_role}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-ink-subtle">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${ACTION_BADGE[log.action] ??
                                                "border-warm bg-cream text-ink-muted"
                                                }`}
                                        >
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-ink-muted">
                                        {log.entity}
                                        {log.entity_id ? (
                                            <span className="ml-1 text-ink-subtle">
                                                #{log.entity_id}
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-ink">
                                        {log.summary || (
                                            <span className="italic text-ink-subtle">
                                                (no description)
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-ink-subtle whitespace-nowrap">
                                        {formatTimestamp(log.created_at)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-ink-subtle">
                        Showing page {page} of {totalPages} · {total.toLocaleString()} total
                        entries
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || loading}
                            className="inline-flex items-center gap-1 rounded-lg border border-warm bg-card px-2.5 py-1 text-xs text-ink-muted hover:bg-cream disabled:opacity-50"
                        >
                            <ChevronLeft size={14} />
                            Prev
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loading}
                            className="inline-flex items-center gap-1 rounded-lg border border-warm bg-card px-2.5 py-1 text-xs text-ink-muted hover:bg-cream disabled:opacity-50"
                        >
                            Next
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {!loading && total === 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-subtle">
                    <Activity size={12} />
                    Activity will appear here as users add, edit, delete, or upload data.
                </p>
            )}
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {children}
        </th>
    );
}
