import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Plus, Filter, Map, RefreshCw, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, AlertTriangle } from "lucide-react";
import type { PosRecord, BoothInfo } from "../types";
import { fetchPosRecords, updatePosRecord, createPosRecord, fetchBoothInfo, changePosBooth, convertPosArea } from "../services";
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
    const [formErrors, setFormErrors] = useState<{ device_no?: string; serial_no?: string; area?: string }>({});

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

    // Convert Area Modal state
    const [isConvertAreaModalOpen, setIsConvertAreaModalOpen] = useState(false);
    const [convertAreaRecord, setConvertAreaRecord] = useState<PosRecord | null>(null);
    const [newArea, setNewArea] = useState("");
    const [convertAreaError, setConvertAreaError] = useState<string | null>(null);
    const [isConvertAreaConfirmOpen, setIsConvertAreaConfirmOpen] = useState(false);

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

    const openConvertAreaModal = (record: PosRecord) => {
        setConvertAreaRecord(record);
        setNewArea("");
        setConvertAreaError(null);
        setIsConvertAreaConfirmOpen(false);
        setIsConvertAreaModalOpen(true);
    };

    const closeConvertAreaModal = () => {
        setIsConvertAreaModalOpen(false);
        setConvertAreaRecord(null);
        setNewArea("");
        setConvertAreaError(null);
        setIsConvertAreaConfirmOpen(false);
    };

    const openConvertAreaConfirm = () => {
        if (!newArea) {
            setConvertAreaError("Please select a new area");
            return;
        }

        if (convertAreaRecord?.area?.toUpperCase() === newArea) {
            setConvertAreaError("New area must be different from the current area.");
            return;
        }

        setConvertAreaError(null);
        setIsConvertAreaConfirmOpen(true);
    };

    const closeConvertAreaConfirm = () => {
        setIsConvertAreaConfirmOpen(false);
    };

    const handleConfirmConvertArea = async () => {
        if (!convertAreaRecord || !newArea) {
            setConvertAreaError("Please select a new area");
            closeConvertAreaConfirm();
            return;
        }

        try {
            const updatedRecord = await convertPosArea(convertAreaRecord.id, newArea, user?.name || "");
            setRecords(prev =>
                prev.map(r => (r.id === convertAreaRecord.id ? updatedRecord : r))
            );
            window.dispatchEvent(new CustomEvent("pos:convert-area"));
            closeConvertAreaModal();
            setSuccessMessage(`Area for device ${convertAreaRecord.device_no} successfully converted to ${newArea}`);
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            closeConvertAreaConfirm();
            setConvertAreaError(err.message || "Failed to convert area");
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
        const errors: { device_no?: string; serial_no?: string; area?: string } = {};
        if (!newPos.device_no.trim()) errors.device_no = "Device number is required";
        if (!newPos.serial_no.trim()) errors.serial_no = "Serial number is required";
        if (!newPos.area) errors.area = "Please select an area";
        setFormErrors(errors);
        if (Object.keys(errors).length > 0) return;
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
            setFormErrors({});
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
                    <div className="rounded-xl bg-teal px-5 py-3 text-sm font-medium text-white shadow-lg flex items-center gap-2 animate-[slideDown_0.3s_ease-out] ring-1 ring-teal-dark/30">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                            <Check size={16} className="text-white" />
                        </div>
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
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm pt-16 px-4">
                    <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                        {/* Header accent bar */}
                        <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />

                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-ink">Add New POS</h2>
                                    <p className="text-sm text-ink-muted mt-0.5">Enter POS details below</p>
                                </div>
                                <button onClick={() => resetForm()} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                                    <X className="h-5 w-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmitNewPos} className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">
                                        Device Number <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newPos.device_no}
                                            onChange={(e) => {
                                                setNewPos({ ...newPos, device_no: e.target.value });
                                                if (formErrors.device_no) setFormErrors(prev => ({ ...prev, device_no: undefined }));
                                            }}
                                            placeholder="Enter device number"
                                            className={`w-full rounded-xl border bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 transition-all shadow-sm ${
                                                formErrors.device_no ? 'border-rose-400 focus:border-rose-400 focus:ring-rose/20' : 'border-warm focus:border-teal focus:ring-teal/20'
                                            }`}
                                        />
                                    </div>
                                    {formErrors.device_no && (
                                        <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            {formErrors.device_no}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">
                                        Serial Number <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newPos.serial_no}
                                            onChange={(e) => {
                                                setNewPos({ ...newPos, serial_no: e.target.value });
                                                if (formErrors.serial_no) setFormErrors(prev => ({ ...prev, serial_no: undefined }));
                                            }}
                                            placeholder="Enter serial number"
                                            className={`w-full rounded-xl border bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 transition-all shadow-sm ${
                                                formErrors.serial_no ? 'border-rose-400 focus:border-rose-400 focus:ring-rose/20' : 'border-warm focus:border-teal focus:ring-teal/20'
                                            }`}
                                        />
                                    </div>
                                    {formErrors.serial_no && (
                                        <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            {formErrors.serial_no}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">
                                        Select Area <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={newPos.area}
                                            onChange={(e) => {
                                                setNewPos({ ...newPos, area: e.target.value });
                                                if (formErrors.area) setFormErrors(prev => ({ ...prev, area: undefined }));
                                            }}
                                            className={`w-full rounded-xl border bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 transition-all shadow-sm appearance-none cursor-pointer ${
                                                formErrors.area ? 'border-rose-400 focus:border-rose-400 focus:ring-rose/20' : 'border-warm focus:border-teal focus:ring-teal/20'
                                            }`}
                                        >
                                            <option value="" disabled hidden>-- Select an area --</option>
                                            <option value="CDO">CDO</option>
                                            <option value="MISOR">MISOR</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-ink-subtle">
                                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                                                <path
                                                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                                    clipRule="evenodd"
                                                    fillRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                    {formErrors.area && (
                                        <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            {formErrors.area}
                                        </p>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-warm/60">
                                    <button
                                        type="button"
                                        onClick={() => resetForm()}
                                        className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!newPos.device_no.trim() || !newPos.serial_no.trim() || !newPos.area}
                                        className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                                    >
                                        <span className="flex items-center justify-center gap-2">
                                            <Plus size={16} />
                                            Add POS
                                        </span>
                                    </button>
                                </div>
                            </form>
                        </div>
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
                                            <button
                                                onClick={() => openConvertAreaModal(record)}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm"
                                            >
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

            {/* CONVERT AREA MODAL */}
            {isConvertAreaModalOpen && convertAreaRecord && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm pt-16 px-4">
                    <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                        <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />

                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-ink">Convert Area</h2>
                                    <p className="text-sm text-ink-muted mt-0.5">Update the area assignment for this device</p>
                                </div>
                                <button onClick={closeConvertAreaModal} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                                    <X className="h-5 w-5 text-gray-400" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">Device Number</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={convertAreaRecord.device_no}
                                            disabled
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">Serial Number</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={convertAreaRecord.serial_no || convertAreaRecord.serial_number || ""}
                                            disabled
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">
                                        New Area <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={newArea}
                                            onChange={(e) => {
                                                setNewArea(e.target.value);
                                                setConvertAreaError(null);
                                            }}
                                            className={`w-full rounded-xl border bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 transition-all shadow-sm appearance-none cursor-pointer ${
                                                convertAreaError ? 'border-rose-400 focus:border-rose-400 focus:ring-rose/20' : 'border-warm focus:border-teal focus:ring-teal/20'
                                            }`}
                                        >
                                            <option value="" disabled hidden>-- Select an area --</option>
                                            {["CDO", "MISOR"]
                                                .filter(area => area !== convertAreaRecord.area?.toUpperCase())
                                                .map(area => (
                                                    <option key={area} value={area}>{area}</option>
                                                ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-ink-subtle">
                                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                                                <path
                                                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                                    clipRule="evenodd"
                                                    fillRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                    {convertAreaError && (
                                        <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            {convertAreaError}
                                        </p>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-warm/60">
                                    <button
                                        type="button"
                                        onClick={closeConvertAreaModal}
                                        className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={openConvertAreaConfirm}
                                        disabled={!newArea || convertAreaRecord.area?.toUpperCase() === newArea}
                                        className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
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
                </div>
            )}

            {/* CONVERT AREA CONFIRMATION MODAL */}
            {isConvertAreaConfirmOpen && convertAreaRecord && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 px-4">
                    <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                        <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500" />
                        
                        <div className="p-6">
                            <div className="flex flex-col items-center gap-4 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-50">
                                    <AlertTriangle className="h-7 w-7 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-ink">Confirm Area Conversion</h3>
                                    <p className="text-sm text-ink-muted mt-1">
                                        Are you sure you want to convert the area of this device?
                                    </p>
                                </div>
                                
                                <div className="w-full divide-y divide-warm/60 rounded-xl bg-gradient-to-br from-cream to-amber-50/50 border border-warm/70 overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Device</span>
                                        <span className="text-sm font-semibold text-ink">{convertAreaRecord.device_no}</span>
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">From</span>
                                        <span className="text-sm font-semibold text-ink">{convertAreaRecord.area || "—"}</span>
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">To</span>
                                        <span className="text-sm font-semibold text-teal">{newArea}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={closeConvertAreaConfirm}
                                    className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmConvertArea}
                                    className="flex-1 rounded-xl bg-gradient-to-r from-teal to-teal-dark py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98]"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CHANGE BOOTH MODAL */}
            {isChangeBoothModalOpen && changeBoothRecord && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm pt-16 px-4">
                    <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                        {/* Header accent bar */}
                        <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />

                        <div className="p-6">
                            {/* HEADER */}
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-ink">Change Booth</h2>
                                    <p className="text-sm text-ink-muted mt-0.5">Update the booth assignment for this device</p>
                                </div>
                                <button onClick={closeChangeBoothModal} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                                    <X className="h-5 w-5 text-gray-400" />
                                </button>
                            </div>

                            {/* FORM */}
                            <div className="flex flex-col gap-4">
                                {/* DEVICE NUMBER (disabled) */}
                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">Device Number</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={changeBoothRecord.device_no}
                                            disabled
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                {/* CURRENT BOOTH CODE (disabled) */}
                                <div>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">Current Booth Code</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={changeBoothRecord.booth_code || "—"}
                                            disabled
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                {/* NEW BOOTH CODE (with autocomplete dropdown) */}
                                <div className="relative" ref={boothDropdownRef}>
                                    <label className="block text-sm font-semibold text-ink mb-1.5">New Booth Code <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={boothSearch}
                                            onChange={handleBoothSearchChange}
                                            onFocus={() => setShowBoothDropdown(true)}
                                            placeholder="Type booth code or location..."
                                            className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                                        />
                                    </div>

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
                                                    <span className="font-medium text-ink">{booth.booth_code}</span>
                                                    <span className="text-xs text-ink-muted">{booth.booth_location || "—"}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {showBoothDropdown && filteredBooths.length === 0 && boothSearch.trim() && (
                                        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-ink-muted shadow-lg">
                                            No matching booths found
                                        </div>
                                    )}

                                    {/* ERROR TOAST */}
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
                                <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-warm/60">
                                    <button
                                        type="button"
                                        onClick={closeChangeBoothModal}
                                        className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={openConfirmModal}
                                        disabled={!newBoothCode.trim() || newBoothCode.trim() === (changeBoothRecord.booth_code || "")}
                                        className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
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
                </div>
            )}

            {/* CONFIRMATION MODAL */}
            {isConfirmModalOpen && changeBoothRecord && (
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
                                    <h3 className="text-lg font-bold text-ink">Confirm Booth Change</h3>
                                    <p className="text-sm text-ink-muted mt-1">
                                        Are you sure you want to change the booth code of this device?
                                    </p>
                                </div>
                                
                                {/* Summary card */}
                                <div className="w-full divide-y divide-warm/60 rounded-xl bg-gradient-to-br from-cream to-amber-50/50 border border-warm/70 overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Device</span>
                                        <span className="text-sm font-semibold text-ink">{changeBoothRecord.device_no}</span>
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">From</span>
                                        <span className="text-sm font-semibold text-ink">{changeBoothRecord.booth_code || "—"}</span>
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">To</span>
                                        <span className="text-sm font-semibold text-teal">{newBoothCode.trim()}</span>
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
                                    onClick={handleConfirmChangeBooth}
                                    className="flex-1 rounded-xl bg-gradient-to-r from-teal to-teal-dark py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98]"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
