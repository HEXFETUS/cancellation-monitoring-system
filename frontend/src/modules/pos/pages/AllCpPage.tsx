import { useState, useEffect, useMemo } from "react";
import { Search, Filter, Map, RefreshCw, X, Check, AlertTriangle, Eye } from "lucide-react";
import type { BoothInfo, OperatorInfo } from "../types";
import { fetchBoothInfo, fetchOperators } from "../services";
import { convertCpArea } from "../../operator/services/cellphones";
import { useAuth } from "../../../context/AuthContext";
import { ConfirmationModal, EditModal } from "../components";
import { Pagination } from "../../../shared/components";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

interface CellphoneRecord {
    id: number;
    brand: string;
    model: string;
    specs: string;
    serial_number: string;
    imei1: string | null;
    imei2: string | null;
    control_no: string;
    operator_id: number | null;
    added_by_user_id: number | null;
    status: string;
    booth_id: number | null;
    area: string | null;
    created_at: string;
    updated_at: string;
}

const ROWS_PER_PAGE = 20;

export default function AllCpPage() {
    const { user } = useAuth();
    const [records, setRecords] = useState<CellphoneRecord[]>([]);
    const [booths, setBooths] = useState<BoothInfo[]>([]);
    const [operators, setOperators] = useState<OperatorInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search and filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterField, setFilterField] = useState<"all" | "control_no" | "brand" | "model" | "serial_number">("all");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    // View details modal
    const [viewing, setViewing] = useState<CellphoneRecord | null>(null);

    // Convert Area Modal state
    const [isConvertAreaModalOpen, setIsConvertAreaModalOpen] = useState(false);
    const [convertAreaRecord, setConvertAreaRecord] = useState<CellphoneRecord | null>(null);
    const [newArea, setNewArea] = useState("");
    const [convertAreaError, setConvertAreaError] = useState<string | null>(null);
    const [isConvertAreaConfirmOpen, setIsConvertAreaConfirmOpen] = useState(false);

    // Success toast
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const loadRecords = async () => {
        setLoading(true);
        setError(null);
        try {
            const [cpData, boothData, ops] = await Promise.all([
                fetch(`${API_BASE_URL}/api/cellphones`).then((r) => {
                    if (!r.ok) throw new Error("Failed to fetch CP devices");
                    return r.json();
                }),
                fetchBoothInfo().catch(() => [] as BoothInfo[]),
                fetchOperators().catch(() => []),
            ]);
            setRecords(cpData);
            setBooths(boothData);
            setOperators(ops);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load CP records");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, []);

    // Reset to page 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterField]);

    // Filter logic
    const filteredRecords = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return records;

        return records.filter((record) => {
            if (filterField === "all") {
                return (
                    (record.control_no?.toLowerCase() || "").includes(query) ||
                    (record.brand?.toLowerCase() || "").includes(query) ||
                    (record.model?.toLowerCase() || "").includes(query) ||
                    (record.serial_number?.toLowerCase() || "").includes(query) ||
                    (record.imei1?.toLowerCase() || "").includes(query) ||
                    (record.imei2?.toLowerCase() || "").includes(query)
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

    // Convert Area handlers
    const openConvertAreaModal = (record: CellphoneRecord) => {
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

    const handleConfirmConvertArea = async () => {
        if (!convertAreaRecord || !newArea) {
            setConvertAreaError("Please select a new area");
            closeConvertAreaConfirm();
            return;
        }

        try {
            const updatedRecord = await convertCpArea(convertAreaRecord.id, newArea);
            setRecords((prev) =>
                prev.map((r) => (r.id === convertAreaRecord.id ? updatedRecord : r))
            );
            closeConvertAreaModal();
            setSuccessMessage(`Area for device ${convertAreaRecord.control_no} successfully converted to ${newArea}`);
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err) {
            closeConvertAreaConfirm();
            setConvertAreaError(err instanceof Error ? err.message : "Failed to convert area");
        }
    };

    const closeConvertAreaConfirm = () => {
        setIsConvertAreaConfirmOpen(false);
    };

    // Resolve booth code and area for a record
    const getBoothInfo = (rec: CellphoneRecord) => {
        const recBoothId = rec.booth_id != null ? Number(rec.booth_id) : null;
        const matchedBooth = recBoothId != null ? booths.find((b) => Number(b.id) === recBoothId) : null;
        const hasBoothId = recBoothId != null;
        const boothCode = hasBoothId && matchedBooth
            ? matchedBooth.booth_code || "—"
            : "—";
        const area = rec.area
            ? rec.area
            : hasBoothId && matchedBooth && boothCode !== "—"
                ? boothCode.startsWith("CDO-") || boothCode.startsWith("CD0-")
                    ? "CDO"
                    : boothCode.startsWith("MOE-") || boothCode.startsWith("MOW-")
                        ? "MISOR"
                        : "—"
                : "—";
        return { boothCode, area, matchedBooth };
    };

    // Resolve operator name
    const getOperatorName = (rec: CellphoneRecord) => {
        if (rec.operator_id == null) return "—";
        const op = operators.find((o) => Number(o.id) === Number(rec.operator_id));
        return op?.operator || `#${rec.operator_id}`;
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
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle dark:text-gray-500 h-4 w-4" />
                            <input
                                type="text"
                                placeholder="Search CP devices..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-60 rounded-lg border border-warm dark:border-gray-700 bg-card dark:bg-gray-800/70 py-2 pl-9 pr-3 text-sm text-ink dark:text-gray-100 placeholder:text-ink-subtle dark:placeholder:text-gray-400 focus:border-teal dark:focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal dark:focus:ring-teal/50 transition-all shadow-sm"
                            />
                        </div>

                        {/* FILTER */}
                        <div className="relative shrink-0">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle h-4 w-4" />
                            <select
                                value={filterField}
                                onChange={(e) => setFilterField(e.target.value as typeof filterField)}
                                className="rounded-lg border border-warm bg-card py-2 pl-9 pr-8 text-sm text-ink focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal transition-all shadow-sm appearance-none cursor-pointer"
                            >
                                <option value="all">All Fields</option>
                                <option value="control_no">Control No.</option>
                                <option value="brand">Brand</option>
                                <option value="model">Model</option>
                                <option value="serial_number">Serial No.</option>
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

                    <button
                        onClick={loadRecords}
                        className="flex items-center gap-2 rounded-xl border border-warm bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-cream focus:outline-none focus:ring-2 focus:ring-teal/50 whitespace-nowrap"
                    >
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
                <table className="w-full min-w-300 text-left text-sm">
                    <thead>
                        <tr className="border-b border-warm bg-cream">
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Control No.</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Brand / Model</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Serial No.</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">IMEI1</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">IMEI2</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Area</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Booth</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Operator</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted text-right">Actions</th>
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
                                    {records.length === 0 ? "No CP devices found." : "No records match your search."}
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((rec) => {
                                const { boothCode, area } = getBoothInfo(rec);
                                const opName = getOperatorName(rec);
                                return (
                                    <tr key={rec.id} className="transition hover:bg-cream/50">
                                        <td className="px-4 py-3 font-medium text-ink">{rec.control_no}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-ink">
                                            <span className="font-semibold">{rec.brand}</span>
                                            {rec.model && <span className="text-ink-muted"> / {rec.model}</span>}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-ink-muted">{rec.serial_number}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-ink-muted">{rec.imei1 || "—"}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-ink-muted">{rec.imei2 || "—"}</td>
                                        <td className="px-4 py-3 text-ink">{area}</td>
                                        <td className="px-4 py-3 font-medium text-teal">{boothCode}</td>
                                        <td className="px-4 py-3 text-ink">{opName}</td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                                                    rec.status === "Active"
                                                        ? "bg-teal-light/20 text-teal-dark border-teal/20"
                                                        : "bg-warm text-ink-muted border-ink-subtle/20"
                                                }`}
                                            >
                                                {rec.status === "Active" ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => setViewing(rec)}
                                                    className="rounded-lg p-1.5 transition-colors hover:bg-teal/20"
                                                    title="View Details"
                                                    style={{ color: "#92C7CF" }}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => openConvertAreaModal(rec)}
                                                    className="rounded-lg p-1.5 transition-colors hover:bg-green-50"
                                                    title="Convert Area"
                                                    style={{ color: "#16A34A" }}
                                                >
                                                    <Map className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {!loading && filteredRecords.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredRecords.length}
                    onPageChange={setCurrentPage}
                    pageSize={ROWS_PER_PAGE}
                />
            )}

            {/* VIEW DETAILS MODAL */}
            <EditModal
                open={!!viewing}
                title="CP Device Details"
                subtitle={viewing ? `${viewing.brand} ${viewing.model}` : ""}
                onClose={() => setViewing(null)}
                accentColor="teal"
            >
                {viewing && (
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">Control No.</label>
                                <input type="text" value={viewing.control_no} disabled className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">Status</label>
                                <input type="text" value={viewing.status || "—"} disabled className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">Brand</label>
                            <input type="text" value={viewing.brand} disabled className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">Model</label>
                            <input type="text" value={viewing.model} disabled className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">Specs</label>
                            <textarea value={viewing.specs} disabled rows={3} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed resize-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">Serial Number</label>
                            <input type="text" value={viewing.serial_number} disabled className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">IMEI1</label>
                                <input type="text" value={viewing.imei1 || "—"} disabled className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">IMEI2</label>
                                <input type="text" value={viewing.imei2 || "—"} disabled className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">Area</label>
                                <input type="text" value={getBoothInfo(viewing).area} disabled className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">Booth</label>
                                <input type="text" value={getBoothInfo(viewing).boothCode} disabled className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">Operator</label>
                            <input type="text" value={getOperatorName(viewing)} disabled className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed" />
                        </div>
                    </div>
                )}
            </EditModal>

            {/* CONVERT AREA MODAL */}
            <EditModal
                open={isConvertAreaModalOpen && convertAreaRecord !== null}
                title="Convert Area"
                subtitle="Update the area assignment for this CP device"
                onClose={closeConvertAreaModal}
                accentColor="teal"
            >
                {convertAreaRecord && (
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-ink mb-1.5">Control No.</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={convertAreaRecord.control_no}
                                    disabled
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-ink mb-1.5">Device</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={`${convertAreaRecord.brand} ${convertAreaRecord.model}`}
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
                                        convertAreaError ? "border-rose-400 focus:border-rose-400 focus:ring-rose/20" : "border-warm focus:border-teal focus:ring-teal/20"
                                    }`}
                                >
                                    <option value="" disabled hidden>-- Select an area --</option>
                                    {["CDO", "MISOR"]
                                        .filter((area) => area !== convertAreaRecord.area?.toUpperCase())
                                        .map((area) => (
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
                )}
            </EditModal>

            {/* CONVERT AREA CONFIRMATION MODAL */}
            <ConfirmationModal
                open={isConvertAreaConfirmOpen}
                title="Confirm Area Conversion"
                message="Are you sure you want to convert the area of this CP device?"
                onConfirm={handleConfirmConvertArea}
                onCancel={closeConvertAreaConfirm}
            >
                {convertAreaRecord && (
                    <>
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Device</span>
                            <span className="text-sm font-semibold text-ink">{convertAreaRecord.control_no}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">From</span>
                            <span className="text-sm font-semibold text-ink">{convertAreaRecord.area || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">To</span>
                            <span className="text-sm font-semibold text-teal">{newArea}</span>
                        </div>
                    </>
                )}
            </ConfirmationModal>
        </div>
    );
}