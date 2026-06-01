import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listReleasedLogs } from "../services/releasedLogs";
import type { ReleasedLog } from "../services/releasedLogs";

const teal = "#92C7CF";
const tealLink = "#2A7A8C";
const PAGE_SIZE = 10;

function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

interface ReleasedLogPageProps {
    search?: string;
    onSearchChange?: (value: string) => void;
}

export default function ReleasedLogPage({ search: searchProp, onSearchChange }: ReleasedLogPageProps = {}) {
    const [internalSearch, setInternalSearch] = useState("");
    const search = searchProp ?? internalSearch;
    // Setter is plumbed for parent-controlled search but not used internally;
    // prefix with _ so the linter's no-unused-vars rule is satisfied while
    // we keep the symmetric "search/setSearch" shape readers expect.
    const _setSearch = onSearchChange ?? setInternalSearch;
    void _setSearch;

    const [logs, setLogs] = useState<ReleasedLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const filteredLogs = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return logs;
        return logs.filter(
            (log) =>
                (log.billing_code ?? "").toLowerCase().includes(q)
        );
    }, [logs, search]);

    // Reset to page 1 whenever the search changes; keeps the user on a
    // valid page when filtering shrinks the list.
    useEffect(() => {
        setPage(1);
    }, [search]);

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginatedLogs = useMemo(
        () => filteredLogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
        [filteredLogs, safePage]
    );

    const pageNumbers = useMemo(() => {
        const pages: (number | "...")[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (safePage > 3) pages.push("...");
            const start = Math.max(2, safePage - 1);
            const end = Math.min(totalPages - 1, safePage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (safePage < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    }, [totalPages, safePage]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await listReleasedLogs();
                if (!cancelled) setLogs(data);
            } catch (err: unknown) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load released logs");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="relative rounded-3xl border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
                {loading ? (
                    <div className="px-5 py-10 text-center text-sm text-gray-500">Loading released logs…</div>
                ) : error ? (
                    <div className="px-5 py-10 text-center text-sm text-red-500">{error}</div>
                ) : logs.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-gray-500">No released logs found.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr
                                className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                                style={{ borderBottom: "1px solid rgba(146,199,207,0.15)", background: "rgba(255,253,245,0.7)" }}
                            >
                                <th className="px-5 py-4">Date</th>
                                <th className="px-5 py-4">Billing Code</th>
                                <th className="px-5 py-4">POS</th>
                                <th className="px-5 py-4">Serial</th>
                                <th className="px-5 py-4">Diagnosis</th>
                                <th className="px-5 py-4">Remarks</th>
                                <th className="px-5 py-4">Released By</th>
                                <th className="px-5 py-4">Received By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedLogs.map((log, idx, arr) => (
                                <tr
                                    key={log.id}
                                    className="transition-all duration-200 hover:bg-white/10"
                                    style={{
                                        borderBottom: idx < arr.length - 1
                                            ? "1px solid rgba(146,199,207,0.08)"
                                            : "none",
                                    }}
                                >
                                    <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">
                                        {formatDate(log.release_date)}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span style={{ color: tealLink }}>{log.billing_code || "—"}</span>
                                    </td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.pos || "—"}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.serial_number || "—"}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.diagnosis || "—"}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.remarks || "—"}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.released_by || "—"}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.received_by || "—"}</td>
                                </tr>
                            ))}
                            {paginatedLogs.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-500">
                                        No released logs match your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination footer — only shown when we have results */}
            {!loading && !error && filteredLogs.length > 0 && (
                <div
                    className="flex flex-col items-center justify-between gap-3 px-5 py-3 sm:flex-row"
                    style={{ borderTop: "1px solid rgba(146,199,207,0.15)", background: "rgba(255,253,245,0.5)" }}
                >
                    <p className="text-xs text-gray-500">
                        Showing {(safePage - 1) * PAGE_SIZE + 1}
                        –{Math.min(safePage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage <= 1}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Previous page"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        {pageNumbers.map((p, i) =>
                            p === "..." ? (
                                <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400">…</span>
                            ) : (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPage(p)}
                                    aria-current={p === safePage ? "page" : undefined}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition"
                                    style={{
                                        background: p === safePage ? teal : "transparent",
                                        color: p === safePage ? "#1f3a3f" : "#6b7280",
                                    }}
                                >
                                    {p}
                                </button>
                            )
                        )}
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage >= totalPages}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Next page"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}