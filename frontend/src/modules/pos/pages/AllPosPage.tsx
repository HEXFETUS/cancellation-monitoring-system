import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Plus, Filter, Map, RefreshCw, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, AlertTriangle } from "lucide-react";
import type { PosRecord, BoothInfo } from "../types";
import { fetchPosRecords, updatePosRecord, createPosRecord, fetchBoothInfo, changePosBooth } from "../services";
import { useAuth } from "../../../context/AuthContext";

const ROWS_PER_PAGE = 20;

export default function AllPosPage() {
    const { user } = useAuth();
    const [records, setRecords] = useState<PosRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPos, setNewPos] = useState({
        device_no: "",
        serial_no: "",
        area: "", // Default value
    });

    // Change Booth Modal state
    const [isChangeBoothModalOpen, setIsChangeBoothModalOpen] = useState(false);
    const [changeBoothRecord, setChangeBoothRecord] = useState<PosRecord | null>(null);
    const [boothList, setBoothList] = useState<BoothInfo[]>([]);
    const [newBoothCode, setNewBoothCode] = useState("");
    const [selectedBoothId, setSelectedBoothId] = useState<number | null>(null);
    const [boothSearch, setBoothSearch] = useState("");
    const [showBoothDropdown, setShowBoothDropdown] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorBoothMessage, setErrorBoothMessage] = useState<string | null>(null);
    const boothDropdownRef = useRef<HTMLDivElement>(null);

    // Filtered booth list for autocomplete
    const filteredBooths = useMemo(() => {
        if (!boothSearch.trim()) return boothList;
        const query = boothSearch.toLowerCase();
        return boothList.filter(b => 
            b.booth_code?.toLowerCase().includes(query) ||
            b.booth_location?.toLowerCase().includes(query)
        );
    }, [boothList, boothSearch]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (boothDropdownRef.current && !boothDropdownRef.current.contains(e.target as Node)) {
                setShowBoothDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const openChangeBoothModal = async (record: PosRecord) => {
        setChangeBoothRecord(record);
        setNewBoothCode("");
        setSelectedBoothId(null);
        setBoothSearch("");
        setShowBoothDropdown(false);
        setIsConfirmModalOpen(false);
        // Fetch booth list if not already loaded
        if (boothList.length === 0) {
            try {
                const booths = await fetchBoothInfo();
                setBoothList(booths);
            } catch (err: any) {
                alert("Failed to load booth list");
            }
        }
        setIsChangeBoothModalOpen(true);
    };

    const closeChangeBoothModal = () => {
        setIsChangeBoothModalOpen(false);
        setChangeBoothRecord(null);
        setNewBoothCode("");
        setSelectedBoothId(null);
        setBoothSearch("");
        setShowBoothDropdown(false);
        setIsConfirmModalOpen(false);
        setErrorBoothMessage(null);
    };

    const handleBoothSelect = (booth: BoothInfo) => {
        setNewBoothCode(booth.booth_code);
        setSelectedBoothId(booth.id);
        setBoothSearch(booth.booth_code);
        setShowBoothDropdown(false);
        // Check if selected booth is the same as current booth
        if (changeBoothRecord && booth.booth_code === changeBoothRecord.booth_code) {
            setErrorBoothMessage("Selected booth is the same as the current booth.");
        } else {
            setErrorBoothMessage(null);
        }
    };

    const handleBoothSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setBoothSearch(value);
        setNewBoothCode(value);
        setSelectedBoothId(null);
        setShowBoothDropdown(true);
        setErrorBoothMessage(null);
    };

    const openConfirmModal = () => {
        setIsConfirmModalOpen(true);
    };

    const closeConfirmModal = () => {
        setIsConfirmModalOpen(false);
    };

    const handleConfirmChangeBooth = async () => {
        if (!changeBoothRecord || !newBoothCode.trim() || selectedBoothId === null) {
            alert("Please select a booth from the dropdown list");
            return;
        }
        try {
            const updatedRecord = await changePosBooth(changeBoothRecord.id, selectedBoothId, newBoothCode.trim(), user?.name || "");
            setRecords(prev =>
                prev.map(r => (r.id === changeBoothRecord.id ? updatedRecord : r))
            );
            closeChangeBoothModal();
            setSuccessMessage(`Booth for device ${changeBoothRecord.device_no} successfully changed to ${newBoothCode.trim()}`);
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            // Show operator mismatch error as inline toast below the New Booth Code input
            if (err.message?.toLowerCase().includes("operator mismatch")) {
                closeConfirmModal();
                setErrorBoothMessage(err.message);
            } else {
                alert(err.message || "Failed to change booth");
            }
        }
    };

    // RESET FORM
    const resetForm = () => {
        setNewPos({
            device_no: "",
            serial_no: "",
            area: "",
        });

        setIsModalOpen(false);
    };

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
            // Send fields from the form; missing fields (booth_id, operator_id, etc.)
            // will be null, sticker defaults to false, status explicitly set to Inactive
            const createdRecord = await createPosRecord({
                device_no: newPos.device_no,
                serial_number: newPos.serial_no,
                area: newPos.area,
                status: "Inactive",
                sticker: false,
            });
            setRecords((prev) => [...prev, createdRecord]);
            resetForm();
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

            {/* HEADER + ACTIONS */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                {/* LEFT SIDE - Success toast or empty space */}
                {successMessage ? (
                    <div className="rounded-xl bg-teal px-5 py-3 text-sm font-medium text-white shadow-lg flex items-center gap-2">
                        <Check size={18} />
                        <span>{successMessage}</span>
                        <button onClick={() => setSuccessMessage(null)} className="ml-auto rounded-lg p-0.5 hover:bg-white/20 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <div />
                )}

                {/* RIGHT SIDE */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">

                    {/* SEARCH */}
                    <div className="flex items-center gap-2">

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle h-4 w-4" />

                            <input
                                type="text"
                                placeholder="Search POS records..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-60 rounded-lg border border-warm bg-card py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal transition-all shadow-sm"
                            />
                        </div>

                        {/* FILTER */}
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
                                    <path
                                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                        fillRule="evenodd"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* BUTTON */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-dark focus:outline-none focus:ring-2 focus:ring-teal/50 whitespace-nowrap"
                    >
                        <Plus size={16} />
                        Add New POS
                    </button>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 backdrop-blur-sm pt-16 px-4">

                    {/* MODAL CARD */}
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">

                        {/* HEADER */}
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">
                                    Add New POS
                                </h2>

                                <p className="text-sm text-gray-500">
                                    Enter POS details below
                                </p>
                            </div>

                            <button
                                onClick={() => resetForm()}
                                className="rounded-lg p-1 hover:bg-gray-100"
                            >
                                <X className="h-5 w-5 text-gray-600" />
                            </button>
                        </div>

                        {/* FORM */}
                        <form
                            onSubmit={handleSubmitNewPos}
                            className="space-y-4"
                        >

                            {/* DEVICE NUMBER */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Device Number
                                </label>

                                <input
                                    type="text"
                                    value={newPos.device_no}
                                    onChange={(e) =>
                                        setNewPos({
                                            ...newPos,
                                            device_no: e.target.value,
                                        })
                                    }
                                    placeholder="Enter device number"
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                                />
                            </div>

                            {/* SERIAL NUMBER */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Serial Number
                                </label>

                                <input
                                    type="text"
                                    value={newPos.serial_no}
                                    onChange={(e) =>
                                        setNewPos({
                                            ...newPos,
                                            serial_no: e.target.value,
                                        })
                                    }
                                    placeholder="Enter serial number"
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                                />
                            </div>

                            {/* AREA */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Select Area
                                </label>

                                <select
                                    value={newPos.area}
                                    onChange={(e) =>
                                        setNewPos({
                                            ...newPos,
                                            area: e.target.value,
                                        })
                                    }
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                                >
                                    <option value="" disabled hidden>
                                        --
                                    </option>

                                    <option value="CDO">CDO</option>
                                    <option value="MISOR">MISOR</option>
                                </select>
                            </div>

                            {/* BUTTONS */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => resetForm()}
                                    className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="flex-1 rounded-xl bg-teal py-3 text-sm font-medium text-white hover:bg-teal-dark"
                                >
                                    Add POS
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
                <table className="w-full min-w-300 text-left text-sm">
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
                                            <button
                                                onClick={() => openChangeBoothModal(record)}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm"
                                            >
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
                                    className={`min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors shadow-sm ${
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

            {/* CHANGE BOOTH MODAL */}
            {isChangeBoothModalOpen && changeBoothRecord && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 backdrop-blur-sm pt-16 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        {/* HEADER */}
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Change Booth</h2>
                                <p className="text-sm text-gray-500">Update the booth assignment for this device</p>
                            </div>
                            <button onClick={closeChangeBoothModal} className="rounded-lg p-1 hover:bg-gray-100">
                                <X className="h-5 w-5 text-gray-600" />
                            </button>
                        </div>

                        {/* FORM */}
                        <div className="space-y-4">
                            {/* DEVICE NUMBER (disabled) */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Device Number</label>
                                <input
                                    type="text"
                                    value={changeBoothRecord.device_no}
                                    disabled
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed"
                                />
                            </div>

                            {/* CURRENT BOOTH CODE (disabled) */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Current Booth Code</label>
                                <input
                                    type="text"
                                    value={changeBoothRecord.booth_code || "—"}
                                    disabled
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed"
                                />
                            </div>

                            {/* NEW BOOTH CODE (with autocomplete dropdown) */}
                            <div className="relative" ref={boothDropdownRef}>
                                <label className="mb-1 block text-sm font-medium text-gray-700">New Booth Code</label>
                                <input
                                    type="text"
                                    value={boothSearch}
                                    onChange={handleBoothSearchChange}
                                    onFocus={() => setShowBoothDropdown(true)}
                                    placeholder="Type booth code or location..."
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                                />

                                {/* DROPDOWN LIST */}
                                {showBoothDropdown && filteredBooths.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                                        {filteredBooths.map((booth) => (
                                            <button
                                                key={booth.id}
                                                type="button"
                                                onClick={() => handleBoothSelect(booth)}
                                                className="flex w-full flex-col items-start px-4 py-2.5 text-left text-sm hover:bg-teal-light/20 transition-colors border-b border-gray-100 last:border-b-0"
                                            >
                                                <span className="font-medium text-gray-800">{booth.booth_code}</span>
                                                <span className="text-xs text-gray-500">{booth.booth_location || "—"}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showBoothDropdown && filteredBooths.length === 0 && boothSearch.trim() && (
                                    <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-lg">
                                        No matching booths found
                                    </div>
                                )}

                                {/* ERROR TOAST - displayed when selected booth matches current booth */}
                                {errorBoothMessage && (
                                    <div className="mt-2 rounded-xl bg-rose px-4 py-2.5 text-sm font-medium text-white flex items-center gap-2 shadow-sm">
                                        <AlertTriangle size={16} />
                                        <span>{errorBoothMessage}</span>
                                        <button onClick={() => setErrorBoothMessage(null)} className="ml-auto rounded-lg p-0.5 hover:bg-white/20 transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* BUTTONS */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeChangeBoothModal}
                                    className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={openConfirmModal}
                                    disabled={!newBoothCode.trim() || newBoothCode.trim() === (changeBoothRecord.booth_code || "")}
                                    className="flex-1 rounded-xl bg-teal py-3 text-sm font-medium text-white hover:bg-teal-dark disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <Check size={16} />
                                        Save Change
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION MODAL */}
            {isConfirmModalOpen && changeBoothRecord && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex flex-col items-center text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber/10">
                                <AlertTriangle className="h-7 w-7 text-amber" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">Confirm Booth Change</h3>
                            <p className="mt-2 text-sm text-gray-500">
                                Are you sure you want to change the booth code of device <strong>{changeBoothRecord.device_no}</strong> from{" "}
                                <strong>{changeBoothRecord.booth_code || "—"}</strong> to <strong>{newBoothCode.trim()}</strong>?
                            </p>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={closeConfirmModal}
                                className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmChangeBooth}
                                className="flex-1 rounded-xl bg-teal py-3 text-sm font-medium text-white hover:bg-teal-dark"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
