import { useState, useEffect, useMemo } from "react";
import { Search, Plus, List, Eye, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { PosRecord } from "../types";
import { fetchPosRecords } from "../services";

const ROWS_PER_PAGE = 20;

export default function OperatorsPage() {
    const [records, setRecords] = useState<PosRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const loadRecords = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchPosRecords();
            setRecords(data);
        } catch (err) {
            setError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Failed to load records");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, []);

    // Filter out records without an operator, then sort by operator name (ascending)
    const sortedRecords = useMemo(() => {
        return records
            .filter(record => record.operator && record.operator.trim() !== "")
            .sort((a, b) => {
                const nameA = (a.operator || "").toLowerCase();
                const nameB = (b.operator || "").toLowerCase();
                return nameA.localeCompare(nameB);
            });
    }, [records]);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const filteredRecords = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return sortedRecords;

        return sortedRecords.filter(record => {
            return (
                (record.operator?.toLowerCase() || "").includes(query) ||
                (record.device_no?.toLowerCase() || "").includes(query) ||
                (record.serial_no?.toLowerCase() || "").includes(query) ||
                (record.area?.toLowerCase() || "").includes(query) ||
                (record.booth_code?.toLowerCase() || "").includes(query)
            );
        });
    }, [sortedRecords, searchQuery]);

    // Paginated slice
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ROWS_PER_PAGE));
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return filteredRecords.slice(start, start + ROWS_PER_PAGE);
    }, [filteredRecords, currentPage]);

    // Pagination: show up to 10 page buttons centered around the current page
    const visiblePages = useMemo(() => {
        const MAX_VISIBLE = 10;
        let start = Math.max(1, currentPage - Math.floor(MAX_VISIBLE / 2));
        const end = Math.min(totalPages, start + MAX_VISIBLE - 1);
        if (end - start + 1 < MAX_VISIBLE) {
            start = Math.max(1, end - MAX_VISIBLE + 1);
        }
        const pages: number[] = [];
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    }, [currentPage, totalPages]);

    const goFirstPage = () => {
        setCurrentPage(1);
    };

    const goLastPage = () => {
        setCurrentPage(totalPages);
    };

    const handleView = (record: PosRecord) => {
        // View action – can be extended to open a modal or navigate
        alert(`Operator: ${record.operator}\nDevice No: ${record.device_no}\nSerial No: ${record.serial_no}\nArea: ${record.area}\nBooth Code: ${record.booth_code}`);
    };

    if (error) {
        return (
            <div className="p-6 text-center text-rose">
                <p>{error}</p>
                <button
                    onClick={loadRecords}
                    className="mt-4 px-4 py-2 rounded-lg bg-teal text-white hover:bg-teal-dark transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Toolbar: Search & Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 ml-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search operators..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-72 rounded-lg border border-warm bg-card py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal transition-all shadow-sm"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-dark focus:outline-none focus:ring-2 focus:ring-teal/50">
                            <Plus size={16} />
                            ADD OPERATOR
                        </button>
                        <button className="flex items-center gap-2 rounded-xl border border-warm bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/50">
                            <List size={16} />
                            OPERATOR LIST
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
                <table className="w-full min-w-[600px] text-left text-sm">
                    <thead>
                        <tr className="border-b border-warm bg-cream">
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Operator</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Device Number</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Serial Number</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Area</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Booth Code</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-warm/60">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-ink-subtle">
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="h-5 w-5 animate-spin" />
                                        <span>Loading records...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredRecords.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-ink-subtle">
                                    No operator records found matching your search.
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((record) => (
                                <tr key={record.id} className="transition hover:bg-cream/50">
                                    <td className="px-4 py-3 font-medium text-ink">{record.operator || "—"}</td>
                                    <td className="px-4 py-3 text-ink">{record.device_no}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{record.serial_no}</td>
                                    <td className="px-4 py-3 text-ink">{record.area || "—"}</td>
                                    <td className="px-4 py-3 font-medium text-teal">{record.booth_code || "—"}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleView(record)}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm"
                                        >
                                            <Eye size={14} />
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {!loading && filteredRecords.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-ink-subtle">
                        Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredRecords.length)} of {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* First */}
                        <button
                            onClick={goFirstPage}
                            disabled={currentPage === 1}
                            className="inline-flex items-center justify-center rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            title="First page"
                        >
                            <ChevronsLeft size={14} />
                        </button>
                        {/* Previous */}
                        <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="inline-flex items-center gap-1 rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        {/* Page numbers */}
                        <div className="flex items-center gap-0.5">
                            {visiblePages[0] > 1 && (
                                <span className="px-1 text-xs text-ink-subtle">…</span>
                            )}
                            {visiblePages.map((page) => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`min-w-[32px] rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors shadow-sm ${
                                        page === currentPage
                                            ? 'bg-teal text-white'
                                            : 'border border-warm bg-white text-ink hover:bg-surface'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                            {visiblePages[visiblePages.length - 1] < totalPages && (
                                <span className="px-1 text-xs text-ink-subtle">…</span>
                            )}
                        </div>
                        {/* Next */}
                        <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="inline-flex items-center gap-1 rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={14} />
                        </button>
                        {/* Last */}
                        <button
                            onClick={goLastPage}
                            disabled={currentPage === totalPages}
                            className="inline-flex items-center justify-center rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Last page"
                        >
                            <ChevronsRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
