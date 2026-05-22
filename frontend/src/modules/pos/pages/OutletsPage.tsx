import { useState, useEffect, useMemo } from "react";
import { Search, Plus, List, Edit, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, AlertTriangle } from "lucide-react";
import type { BoothInfo } from "../types";
import { fetchBoothInfo } from "../services";

const ROWS_PER_PAGE = 20;

export default function OutletsPage() {
    const [records, setRecords] = useState<BoothInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        loadRecords();
    }, []);

    const loadRecords = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchBoothInfo();
            setRecords(
                data
                    .filter((record) => record.booth_code?.trim())
                    .sort((a, b) => a.booth_code.localeCompare(b.booth_code, undefined, { numeric: true }))
            );
        } catch (err: any) {
            setError(err.message || "Failed to load records");
        } finally {
            setLoading(false);
        }
    };

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const filteredRecords = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return records;

        return records.filter(record => {
            return (
                (record.operator?.toLowerCase() || "").includes(query) ||
                (record.booth_code?.toLowerCase() || "").includes(query) ||
                (record.coordinate?.toLowerCase() || "").includes(query) ||
                (record.booth_location?.toLowerCase() || "").includes(query)
            );
        });
    }, [records, searchQuery]);

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
        let end = Math.min(totalPages, start + MAX_VISIBLE - 1);
        if (end - start + 1 < MAX_VISIBLE) {
            start = Math.max(1, end - MAX_VISIBLE + 1);
        }
        const pages: number[] = [];
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    }, [currentPage, totalPages]);

    const goFirstPage = () => {
        setCurrentPage(1);
    };

    const goLastPage = () => {
        setCurrentPage(totalPages);
    };

    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const showToast = (message: string) => {
        setToastMessage(message);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 3000);
    };

    const handleEdit = (record: BoothInfo) => {
        // Edit action – can be extended to open a modal or navigate
        alert(`Edit Outlet:\nOperator: ${record.operator}\nBooth Code: ${record.booth_code}\nCoordinate: ${record.coordinate}\nLocation: ${record.booth_location}`);
    };

    // ── Add Booth Modal state ──
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addForm, setAddForm] = useState({
        operator: "",
        booth_code: "",
        coordinate: "",
        location: "",
    });
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    const openAddModal = () => {
        setAddForm({ operator: "", booth_code: "", coordinate: "", location: "" });
        setIsConfirmModalOpen(false);
        setIsAddModalOpen(true);
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setIsConfirmModalOpen(false);
    };

    const handleAddFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setAddForm((prev) => ({ ...prev, [name]: value }));
    };

    const openConfirmModal = () => {
        setIsConfirmModalOpen(true);
    };

    const closeConfirmModal = () => {
        setIsConfirmModalOpen(false);
    };

    const handleSave = () => {
        // For now just show a success toast; backend integration can be added later
        showToast(`Booth "${addForm.booth_code}" has been saved successfully.`);
        closeAddModal();
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
            {/* Toolbar: Toast (left) + Search & Button (right) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {/* Success Toast */}
                {toastVisible && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-100 border border-green-400 text-green-800 px-4 py-2 text-sm shadow-sm">
                        <span>{toastMessage}</span>
                        <button
                            onClick={() => setToastVisible(false)}
                            className="ml-1 text-green-600 hover:text-green-900 font-bold leading-none"
                        >
                            ×
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-3 ml-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search outlets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-72 rounded-lg border border-warm bg-card py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal transition-all shadow-sm"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={openAddModal}
                            className="flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-dark focus:outline-none focus:ring-2 focus:ring-teal/50"
                        >
                            <Plus size={16} />
                            ADD BOOTH
                        </button>
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
                <table className="w-full min-w-[700px] text-left text-sm">
                    <thead>
                        <tr className="border-b border-warm bg-cream">
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Operator</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Booth Code</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Coordinate</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Location</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-warm/60">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-ink-subtle">
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="h-5 w-5 animate-spin" />
                                        <span>Loading records...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredRecords.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-ink-subtle">
                                    No outlet records found matching your search.
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((record) => (
                                <tr key={record.id} className="transition hover:bg-cream/50">
                                    <td className="px-4 py-3 font-medium text-ink">{record.operator || "—"}</td>
                                    <td className="px-4 py-3 font-medium text-teal">{record.booth_code || "—"}</td>
                                    <td className="px-4 py-3 text-ink-muted text-xs">{record.coordinate || "—"}</td>
                                    <td className="px-4 py-3 text-ink">{record.booth_location || "—"}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleEdit(record)}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm"
                                        >
                                            <Edit size={14} />
                                            Edit
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

            {/* ── CONFIRMATION MODAL ── */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 px-4">
                    <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                        {/* Header accent bar */}
                        <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500" />
                        
                        <div className="p-6">
                            <div className="flex flex-col items-center gap-4 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-50">
                                    <AlertTriangle className="h-7 w-7 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-ink">Confirm Save</h3>
                                    <p className="text-sm text-ink-muted mt-1">
                                        Are you sure you want to save this booth?
                                    </p>
                                </div>
                                
                                {/* Summary card */}
                                <div className="w-full divide-y divide-warm/60 rounded-xl bg-gradient-to-br from-cream to-amber-50/50 border border-warm/70 overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Operator</span>
                                        <span className="text-sm font-semibold text-ink">{addForm.operator}</span>
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Booth Code</span>
                                        <span className="text-sm font-semibold text-teal">{addForm.booth_code}</span>
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Coordinate</span>
                                        <span className="text-sm font-medium text-ink">{addForm.coordinate || "—"}</span>
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Location</span>
                                        <span className="text-sm font-medium text-ink">{addForm.location || "—"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={closeConfirmModal}
                                    className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 rounded-xl bg-gradient-to-r from-teal to-teal-dark py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98]"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ADD BOOTH MODAL ── */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm pt-16 px-4">
                    <div className="relative w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                        {/* Header accent bar */}
                        <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />

                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-ink">Add Booth</h2>
                                    <p className="text-sm text-ink-muted mt-0.5">Fill in the booth details below</p>
                                </div>
                                <button onClick={closeAddModal} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                                    <X className="h-5 w-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Form fields */}
                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">
                                        Operator <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="operator"
                                            value={addForm.operator}
                                            onChange={handleAddFormChange}
                                            placeholder="Enter operator name"
                                            className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">
                                        Booth Code <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="booth_code"
                                            value={addForm.booth_code}
                                            onChange={handleAddFormChange}
                                            placeholder="Enter booth code"
                                            className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">Coordinate</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="coordinate"
                                            value={addForm.coordinate}
                                            onChange={handleAddFormChange}
                                            placeholder="Enter coordinate"
                                            className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">Location</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="location"
                                            value={addForm.location}
                                            onChange={handleAddFormChange}
                                            placeholder="Enter location"
                                            className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-warm/60">
                                <button
                                    onClick={closeAddModal}
                                    className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={openConfirmModal}
                                    disabled={!addForm.booth_code.trim() || !addForm.operator.trim()}
                                    className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
