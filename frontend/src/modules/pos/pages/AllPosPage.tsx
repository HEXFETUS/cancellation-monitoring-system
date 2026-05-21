import { useState, useEffect, useMemo } from "react";
import { Search, Plus, Filter, Map, RefreshCw, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { PosRecord } from "../types";
import { fetchPosRecords, updatePosRecord, createPosRecord } from "../services";

const ROWS_PER_PAGE = 20;
const PAGE_WINDOW = 10;
const WINDOW_STEP = 5;

export default function AllPosPage() {
    const [records, setRecords] = useState<PosRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPos, setNewPos] = useState({
        device_no: "",
        serial_no: "",
        area: "CDO", // Default value
    });

    // Search and filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterField, setFilterField] = useState<"all" | "device_no" | "serial_no" | "booth_code" | "operator">("all");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        loadRecords();
    }, []);

    const loadRecords = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchPosRecords();
            setRecords(data);
        } catch (err: any) {
            setError(err.message || "Failed to load POS records");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitNewPos = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Assuming createPosRecord only needs device_no, serial_no, and area
            const createdRecord = await createPosRecord({
                device_no: newPos.device_no,
                serial_no: newPos.serial_no,
                area: newPos.area,
                // Add other default values or make them optional in the backend
                booth_code: "", // Default empty
                operator: "", // Default empty
                coordinate: "", // Default empty
                booth_location: "", // Default empty
                status: "Active", // Default active
                sticker: false, // Default false
            });
            setRecords((prev) => [...prev, createdRecord]);
            setNewPos({ device_no: "", serial_no: "", area: "CDO" }); // Reset form
            setIsModalOpen(false);
        } catch (err: any) {
            alert(err.message || "Failed to add new POS record");
        }
    };

    const handleStickerToggle = async (id: number, currentSticker: boolean) => {
        try {
            await updatePosRecord(id, { sticker: !currentSticker });
            setRecords(prev =>
                prev.map(r => (r.id === id ? { ...r, sticker: !currentSticker } : r))
            );
        } catch (err: any) {
            alert(err.message || "Failed to update sticker status");
        }
    };

    // Reset to page 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterField]);

    // Filter logic
    const filteredRecords = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return records;

        return records.filter(record => {
            if (filterField === "all") {
                return (
                    (record.device_no?.toLowerCase() || "").includes(query) ||
                    (record.serial_no?.toLowerCase() || "").includes(query) ||
                    (record.booth_code?.toLowerCase() || "").includes(query) ||
                    (record.operator?.toLowerCase() || "").includes(query)
                );
            } else {
                const value = record[filterField] as string | null;
                return (value?.toLowerCase() || "").includes(query);
            }
        });
    }, [records, searchQuery, filterField]);

    // Paginated slice
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ROWS_PER_PAGE));
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return filteredRecords.slice(start, start + ROWS_PER_PAGE);
    }, [filteredRecords, currentPage]);

    // Pagination window logic: show 10 pages at a time, step by 5
    const [pageWindowStart, setPageWindowStart] = useState(1);
    const visiblePages = useMemo(() => {
        const end = Math.min(pageWindowStart + PAGE_WINDOW - 1, totalPages);
        const pages: number[] = [];
        for (let i = pageWindowStart; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    }, [pageWindowStart, totalPages]);

    const goNextWindow = () => {
        const nextStart = Math.min(pageWindowStart + WINDOW_STEP, totalPages);
        setPageWindowStart(nextStart);
        setCurrentPage(nextStart);
    };

    const goPrevWindow = () => {
        const prevStart = Math.max(pageWindowStart - WINDOW_STEP, 1);
        setPageWindowStart(prevStart);
        setCurrentPage(prevStart);
    };

    const goFirstPage = () => {
        setPageWindowStart(1);
        setCurrentPage(1);
    };

    const goLastPage = () => {
        const lastWindowStart = Math.max(totalPages - PAGE_WINDOW + 1, 1);
        setPageWindowStart(lastWindowStart);
        setCurrentPage(totalPages);
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-ink">All POS Records</h1>
                    <p className="text-sm text-ink-muted">Overview of all POS devices and their statuses.</p>
                </div>
                
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-dark focus:outline-none focus:ring-2 focus:ring-teal/50"
                >
                    <Plus size={16} />
                    Add New POS
                </button>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div
                        className="relative w-full max-w-md rounded-3xl border shadow-2xl backdrop-blur-2xl p-8 mx-4"
                        style={{
                            background: "rgba(255, 255, 255, 0.66)",
                            border: "1px solid rgba(255, 255, 255, 0.50)",
                            boxShadow:
                                "0 20px 60px rgba(31, 38, 135, 0.18), inset 0 1px 0 rgba(255,255,255,0.65)",
                            backdropFilter: "blur(24px)",
                            WebkitBackdropFilter: "blur(24px)",
                        }}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute right-5 top-5 rounded-xl p-1.5 text-gray-500 transition-colors hover:bg-white/20 hover:text-gray-800"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {/* Title */}
                        <h2 className="text-2xl font-bold text-gray-800">Add New POS</h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Enter the details of the new POS device.
                        </p>

                        <form onSubmit={handleSubmitNewPos} className="mt-8 space-y-5">
                            {/* Device Number */}
                            <div>
                                <label htmlFor="device_no" className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Device Number
                                </label>
                                <input
                                    id="device_no"
                                    type="text"
                                    value={newPos.device_no}
                                    onChange={(e) => setNewPos({ ...newPos, device_no: e.target.value })}
                                    placeholder="Enter device number"
                                    className="w-full rounded-2xl border bg-white/40 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:bg-white/60 focus:ring-2 focus:ring-gray-300/50"
                                    style={{
                                        border: "1px solid rgba(255, 255, 255, 0.50)",
                                    }}
                                />
                            </div>

                            {/* Serial Number */}
                            <div>
                                <label htmlFor="serial_no" className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Serial Number
                                </label>
                                <input
                                    id="serial_no"
                                    type="text"
                                    value={newPos.serial_no}
                                    onChange={(e) => setNewPos({ ...newPos, serial_no: e.target.value })}
                                    placeholder="Enter serial number"
                                    className="w-full rounded-2xl border bg-white/40 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:bg-white/60 focus:ring-2 focus:ring-gray-300/50"
                                    style={{
                                        border: "1px solid rgba(255, 255, 255, 0.50)",
                                    }}
                                />
                            </div>

                            {/* Area */}
                            <div>
                                <label htmlFor="area" className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Select Area
                                </label>
                                <select
                                    id="area"
                                    value={newPos.area}
                                    onChange={(e) => setNewPos({ ...newPos, area: e.target.value })}
                                    className="w-full rounded-2xl border bg-white/40 px-4 py-3 text-sm text-gray-800 outline-none transition-all focus:border-gray-400 focus:bg-white/60 focus:ring-2 focus:ring-gray-300/50 appearance-none cursor-pointer"
                                    style={{
                                        border: "1px solid rgba(255, 255, 255, 0.50)",
                                    }}
                                >
                                    <option value="CDO">CDO</option>
                                    <option value="MISOR">MISOR</option>
                                </select>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 rounded-2xl border bg-white/60 px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-white/80"
                                    style={{
                                        border: "1px solid rgba(255, 255, 255, 0.50)",
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                                    style={{
                                        background:
                                            "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                                    }}
                                >
                                    Add POS
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search POS records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-fit rounded-lg border border-warm bg-card py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal transition-all shadow-sm"
                        />
                    </div>
                    
                    <div className="relative shrink-0">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle h-4 w-4" />
                        <select
                            value={filterField}
                            onChange={(e) => setFilterField(e.target.value as any)}
                            className="rounded-lg border border-warm bg-card py-2 pl-9 pr-8 text-sm text-ink focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal transition-all shadow-sm appearance-none cursor-pointer"
                        >
                            <option value="all">All Fields</option>
                            <option value="device_no">Device No.</option>
                            <option value="serial_no">Serial No.</option>
                            <option value="booth_code">Booth Code</option>
                            <option value="operator">Operator</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-ink-subtle">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
                <table className="w-full min-w-[1200px] text-left text-sm">
                    <thead>
                        <tr className="border-b border-warm bg-cream">
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Device No.</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Serial No.</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Area</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Operator</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Coordinate</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Booth Code</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Booth Location</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted text-center">Sticker</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-warm/60">
                        {loading ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-ink-subtle">
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="h-5 w-5 animate-spin" />
                                        <span>Loading records...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredRecords.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-ink-subtle">
                                    No POS records found matching your search.
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((record) => (
                                <tr key={record.id} className="transition hover:bg-cream/50">
                                    <td className="px-4 py-3 font-medium text-ink">{record.device_no}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{record.serial_no}</td>
                                    <td className="px-4 py-3 text-ink">{record.area || "—"}</td>
                                    <td className="px-4 py-3 text-ink">{record.operator || "—"}</td>
                                    <td className="px-4 py-3 text-ink-muted text-xs">{record.coordinate || "—"}</td>
                                    <td className="px-4 py-3 font-medium text-teal">{record.booth_code || "—"}</td>
                                    <td className="px-4 py-3 text-ink">{record.booth_location || "—"}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border
                                            ${record.status === 'Active' ? 'bg-teal-light/20 text-teal-dark border-teal/20' : 
                                              record.status === 'Inactive' ? 'bg-warm text-ink-muted border-ink-subtle/20' : 
                                              'bg-peach/20 text-peach-dark border-peach/20'}`}
                                        >
                                            {record.status || "—"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={record.sticker}
                                            onChange={() => handleStickerToggle(record.id, record.sticker)}
                                            className="h-4 w-4 rounded border-warm text-teal focus:ring-teal transition-colors cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm">
                                                <RefreshCw size={12} />
                                                Change Booth
                                            </button>
                                            <button className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm">
                                                <Map size={12} />
                                                Convert Area
                                            </button>
                                        </div>
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
                            onClick={() => {
                                if (currentPage === pageWindowStart) {
                                    goPrevWindow();
                                } else {
                                    setCurrentPage((p) => Math.max(1, p - 1));
                                }
                            }}
                            disabled={currentPage === 1}
                            className="inline-flex items-center gap-1 rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        {/* Page numbers */}
                        <div className="flex items-center gap-0.5">
                            {pageWindowStart > 1 && (
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
                            {pageWindowStart + PAGE_WINDOW - 1 < totalPages && (
                                <span className="px-1 text-xs text-ink-subtle">…</span>
                            )}
                        </div>
                        {/* Next */}
                        <button
                            onClick={() => {
                                if (currentPage === pageWindowStart + PAGE_WINDOW - 1 || currentPage === totalPages) {
                                    goNextWindow();
                                } else {
                                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                                }
                            }}
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