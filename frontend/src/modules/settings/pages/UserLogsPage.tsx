import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, User } from "lucide-react";

interface UserLog {
    id: number;
    user_id: number | null;
    user_name: string;
    login_at: string | null;
    logout_at: string | null;
    ip_address?: string | null;
    created_at?: string;
    updated_at?: string;
}

const ROWS_PER_PAGE = 20;
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

async function getErrorMessage(res: Response, fallback: string) {
    try {
        const data = await res.json();
        return data.error || data.message || fallback;
    } catch {
        return fallback;
    }
}

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });
}

function formatTime(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function UserLogsPage() {
    const [logs, setLogs] = useState<UserLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const fetchUserLogs = async () => {
        try {
            setError("");
            const res = await fetch(apiUrl("/api/users/logs"));
            if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to fetch user logs"));
            setLogs(await res.json());
        } catch (err) {
            setError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Could not load user logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUserLogs();
    }, []);

    const totalPages = Math.max(1, Math.ceil(logs.length / ROWS_PER_PAGE));
    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return logs.slice(start, start + ROWS_PER_PAGE);
    }, [logs, currentPage]);

    const visiblePages = useMemo(() => {
        const maxVisible = 10;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        const end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }, [currentPage, totalPages]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="flex items-center gap-3 text-gray-400">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm">Loading user logs...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 p-12">
                <p className="text-sm font-medium text-red-600">Error: {error}</p>
                <button
                    onClick={() => {
                        setLoading(true);
                        fetchUserLogs();
                    }}
                    className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="bg-cream border-b border-warm">
                                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">User</th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Time In</th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Time Out</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-5 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Clock className="h-8 w-8 text-gray-300" />
                                            <p className="text-sm text-gray-400">No user log history found.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedLogs.map((log) => (
                                    <tr key={log.id} className="transition-colors hover:bg-teal-50/40">
                                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                                            <span className="inline-flex items-center gap-1.5">
                                                <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                                                {formatDate(log.login_at ?? log.created_at ?? null)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">
                                                <User className="h-3.5 w-3.5" />
                                                {log.user_name}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-4 text-gray-700">{formatTime(log.login_at)}</td>
                                        <td className="whitespace-nowrap px-5 py-4 text-gray-700">{formatTime(log.logout_at)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {logs.length > 0 && (
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="text-xs text-gray-500">
                        Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}-{Math.min(currentPage * ROWS_PER_PAGE, logs.length)} of {logs.length} record{logs.length !== 1 ? "s" : ""}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40" title="First page">
                            <ChevronsLeft size={14} />
                        </button>
                        <button onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                            <ChevronLeft size={14} />
                        </button>
                        <div className="flex items-center gap-0.5">
                            {visiblePages.map((page) => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors ${
                                        page === currentPage
                                            ? "bg-teal text-white"
                                            : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                            <ChevronRight size={14} />
                        </button>
                        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40" title="Last page">
                            <ChevronsRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
