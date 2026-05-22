import { useEffect, useMemo, useRef, useState } from "react";
import {
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Filter,
    RefreshCw,
    Search,
    X,
} from "lucide-react";
import type { PosRecord } from "../types";
import { fetchPosRecords, updatePosRecord } from "../services";
import { useAuth } from "../../../context/AuthContext";

type FilterField = "all" | "device_no" | "serial_no" | "booth_code";

const DEFAULT_STATUS_OPTIONS = ["Active", "Inactive", "For Repair"];
const ROWS_PER_PAGE = 20;

const STATUS_COLOR_PALETTE: { bg: string; text: string; dot: string }[] = [
    { bg: "bg-teal-light/20", text: "text-teal-dark", dot: "bg-teal" },
    { bg: "bg-warm", text: "text-ink-muted", dot: "bg-ink-subtle" },
    { bg: "bg-peach/20", text: "text-peach-dark", dot: "bg-peach" },
    { bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-400" },
    { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-400" },
    { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400" },
    { bg: "bg-rose-100", text: "text-rose-700", dot: "bg-rose-400" },
    { bg: "bg-lime-100", text: "text-lime-700", dot: "bg-lime-400" },
    { bg: "bg-cyan-100", text: "text-cyan-700", dot: "bg-cyan-400" },
];

function getStatusColor(status: string) {
    const index = DEFAULT_STATUS_OPTIONS.indexOf(status);
    if (index !== -1) return STATUS_COLOR_PALETTE[index];
    const hash = status.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return STATUS_COLOR_PALETTE[3 + (hash % (STATUS_COLOR_PALETTE.length - 3))];
}


function normalize(value: string | null | undefined) {
    return value?.trim() || "";
}

function getErrorMessage(err: unknown, fallback: string) {
    return err instanceof Error ? err.message : fallback;
}

function getStatusClasses(status: string | null) {
    const key = normalize(status);
    const colors = getStatusColor(key);
    return `${colors.bg} ${colors.text}`;
}

function getStatusDotColor(status: string): string {
    return getStatusColor(status || "").dot;
}

function getStatusTextColor(status: string): string {
    return getStatusColor(status || "").text;
}

function ConfirmModal({
    open,
    record,
    nextStatus,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    record: PosRecord | null;
    nextStatus: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!open || !record) return null;

    return (
        <div className="fixed inset-0 z-100 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-20">
            <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-warm bg-white p-0 shadow-2xl">
                {/* Header with accent bar */}
                <div className="relative flex items-center gap-3 rounded-t-2xl bg-gradient-to-r from-teal/10 to-teal/5 px-6 pb-4 pt-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal/10">
                        <svg
                            className="h-5 w-5 text-teal"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                            />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-ink">Change Status</h3>
                        <p className="text-xs text-ink-muted">Confirm device status update</p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-ink-subtle transition hover:bg-white/70 hover:text-ink"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    <div className="rounded-xl border border-warm bg-cream/30 p-4">
                        <p className="text-sm leading-relaxed text-ink-muted">
                            Change status of device{" "}
                            <span className="font-semibold text-ink">{record.device_no}</span>
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                            {/* Current Status */}
                            <div className="flex flex-1 flex-col items-center gap-1.5 rounded-lg border border-warm bg-white px-3 py-2.5">
                                <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
                                    Current
                                </span>
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusClasses(record.status)}`}
                                >
                                    <span
                                        className={`inline-block h-1.5 w-1.5 rounded-full ${getStatusDotColor(normalize(record.status) || "-")}`}
                                    />
                                    {normalize(record.status) || "-"}
                                </span>
                            </div>

                            {/* Arrow */}
                            <div className="shrink-0">
                                <svg
                                    className="h-5 w-5 text-ink-subtle"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                                    />
                                </svg>
                            </div>

                            {/* New Status */}
                            <div className="flex flex-1 flex-col items-center gap-1.5 rounded-lg border border-warm bg-white px-3 py-2.5">
                                <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
                                    New
                                </span>
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusClasses(nextStatus)}`}
                                >
                                    <span
                                        className={`inline-block h-1.5 w-1.5 rounded-full ${getStatusColor(nextStatus).dot}`}
                                    />
                                    {nextStatus}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-warm bg-cream/50 px-6 py-4 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-warm bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-cream hover:border-ink-subtle"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-lg bg-teal px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-dark focus:outline-none focus:ring-2 focus:ring-teal/40"
                    >
                        Confirm Change
                    </button>
                </div>
            </div>
        </div>
    );
}

function SuccessToast({
    message,
    onClose,
}: {
    message: string;
    onClose: () => void;
}) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="flex items-center gap-3 rounded-lg border border-teal/30 bg-teal-light/30 px-4 py-3 shadow-sm">
            <CheckCircle className="h-5 w-5 text-teal" />
            <span className="text-sm font-medium text-teal-dark">{message}</span>
            <button type="button" onClick={onClose} className="ml-auto text-teal-dark/60 hover:text-teal-dark">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

export default function PosStatusPage() {
    const { user } = useAuth();
    const [records, setRecords] = useState<PosRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterField, setFilterField] = useState<FilterField>("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [updatingRecordId, setUpdatingRecordId] = useState<number | null>(null);
    const [changeStatusOpen, setChangeStatusOpen] = useState<number | null>(null);
    const [pendingChange, setPendingChange] = useState<{
        record: PosRecord;
        nextStatus: string;
    } | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const changeStatusRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (changeStatusOpen !== -1) return;
            if (
                changeStatusRef.current &&
                !changeStatusRef.current.contains(e.target as Node)
            ) {
                setChangeStatusOpen(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [changeStatusOpen]);

    const loadRecords = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await fetchPosRecords();
            setRecords(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to load POS status records"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;

        fetchPosRecords()
            .then((data) => {
                if (isMounted) {
                    setRecords(data);
                }
            })
            .catch((err: unknown) => {
                if (isMounted) {
                    setError(getErrorMessage(err, "Failed to load POS status records"));
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const statusOptions = useMemo(() => {
        const seen = new Map<string, string>();

        DEFAULT_STATUS_OPTIONS.forEach((s) => seen.set(s.toLowerCase(), s));

        records.forEach((record) => {
            const status = normalize(record.status);
            if (!status) return;
            const key = status.toLowerCase();
            if (!seen.has(key)) {
                seen.set(key, status);
            }
        });

        return Array.from(seen.values()).sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase())
        );
    }, [records]);

    /** Options for the Change Status dropdown – "Active" is excluded */
    const changeStatusOptions = useMemo(
        () => statusOptions.filter((s) => s.toLowerCase() !== "active"),
        [statusOptions]
    );

    const filteredRecords = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();

        return records.filter((record) => {
            const matchesStatus =
                statusFilter === "all" || normalize(record.status) === statusFilter;

            if (!matchesStatus) return false;
            if (!query) return true;

            if (filterField === "all") {
                return (
                    (record.device_no?.toLowerCase() || "").includes(query) ||
                    (record.serial_no?.toLowerCase() || "").includes(query) ||
                    (record.booth_code?.toLowerCase() || "").includes(query)
                );
            } else {
                const fieldValue = normalize(record[filterField]).toLowerCase();
                return fieldValue.includes(query);
            }
        });
    }, [records, filterField, searchQuery, statusFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterField, searchQuery, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ROWS_PER_PAGE));
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return filteredRecords.slice(start, start + ROWS_PER_PAGE);
    }, [currentPage, filteredRecords]);

    const visiblePages = useMemo(() => {
        const maxVisible = 10;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        const end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        const pages: number[] = [];
        for (let page = start; page <= end; page += 1) {
            pages.push(page);
        }
        return pages;
    }, [currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);

    const goFirstPage = () => setCurrentPage(1);
    const goLastPage = () => setCurrentPage(totalPages);

    const handleConfirmChange = async () => {
        if (!pendingChange) return;
        const { record, nextStatus } = pendingChange;
        if (record.status === nextStatus) return;

        setUpdatingRecordId(record.id);
        setPendingChange(null);

        try {
            const updatedRecord = await updatePosRecord(record.id, {
                status: nextStatus,
                changed_by: user?.name || null,
            } as Partial<PosRecord> & { changed_by?: string | null });
            setRecords((currentRecords) =>
                currentRecords.map((currentRecord) =>
                    currentRecord.id === record.id ? updatedRecord : currentRecord
                )
            );
            window.dispatchEvent(new CustomEvent("pos:status-change"));
            setSuccessMessage(
                `Device ${record.device_no} status changed to ${nextStatus}`
            );
        } catch (err: unknown) {
            alert(getErrorMessage(err, "Failed to update POS status"));
        } finally {
            setUpdatingRecordId(null);
            setChangeStatusOpen(null);
        }
    };

    if (error) {
        return (
            <div className="p-6 text-center text-rose">
                <p>{error}</p>
                <button
                    onClick={loadRecords}
                    className="mt-4 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-dark"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <ConfirmModal
                open={pendingChange !== null}
                record={pendingChange?.record ?? null}
                nextStatus={pendingChange?.nextStatus ?? ""}
                onConfirm={handleConfirmChange}
                onCancel={() => setPendingChange(null)}
            />

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-end">
                {successMessage && (
                    <div className="mr-auto w-full lg:w-auto lg:min-w-80">
                        <SuccessToast
                            message={successMessage}
                            onClose={() => setSuccessMessage(null)}
                        />
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <div className="relative w-full sm:w-72">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search status records..."
                            className="w-full rounded-lg border border-warm bg-card py-2 pl-9 pr-3 text-sm text-ink shadow-sm transition placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                        />
                    </div>

                    {/* FILTER */}
                    <div className="relative shrink-0">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle h-4 w-4" />
                        <select
                            value={filterField}
                            onChange={(e) => setFilterField(e.target.value as FilterField)}
                            className="rounded-lg border border-warm bg-card py-2 pl-9 pr-8 text-sm text-ink focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal transition-all shadow-sm appearance-none cursor-pointer"
                        >
                            <option value="all">All Fields</option>
                            <option value="device_no">Device No.</option>
                            <option value="serial_no">Serial No.</option>
                            <option value="booth_code">Booth Code</option>
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
            </div>

            <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
                <table className="w-full min-w-245 text-left text-sm">
                    <thead>
                        <tr className="border-b border-warm bg-cream">
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                <div className="flex items-center gap-2">
                                    <span>Status</span>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setChangeStatusOpen(-1)}
                                            className="flex h-5 w-5 items-center justify-center rounded text-ink-muted transition hover:bg-warm hover:text-ink"
                                            aria-label="Filter by status"
                                        >
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        </button>
                                        {changeStatusOpen === -1 && (
                                            <div
                                                ref={changeStatusRef}
                                                className="absolute left-0 top-full z-50 mt-1 min-w-32.5 overflow-hidden rounded-lg border border-warm bg-white shadow-lg"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setStatusFilter("all");
                                                        setChangeStatusOpen(null);
                                                    }}
                                                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition hover:bg-cream ${
                                                        statusFilter === "all" ? "bg-cream" : ""
                                                    } text-ink-muted`}
                                                >
                                                    All
                                                </button>
                                                {statusOptions.map((opt) => {
                                                    const dotColor = getStatusDotColor(opt);
                                                    return (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => {
                                                                setStatusFilter(opt);
                                                                setChangeStatusOpen(null);
                                                            }}
                                                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition hover:bg-cream ${
                                                                statusFilter === opt
                                                                    ? "bg-cream"
                                                                    : ""
                                                            } ${getStatusTextColor(opt)}`}
                                                        >
                                                            <span
                                                                className={`inline-block h-2 w-2 rounded-full ${dotColor}`}
                                                            />
                                                            {opt}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Change Status
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Device No
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Serial
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Operator
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Area
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Booth
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-warm/60">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-ink-subtle">
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="h-5 w-5 animate-spin" />
                                        <span>Loading status records...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredRecords.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-ink-subtle">
                                    No POS status records found.
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((record) => {
                                const currentStatus = normalize(record.status) || "Inactive";
                                const isUpdating = updatingRecordId === record.id;
                                const isChangeOpen = changeStatusOpen === record.id;
                                const statusDotColor = getStatusDotColor(
                                    normalize(record.status) || "Inactive"
                                );

                                return (
                                    <tr key={record.id} className="transition hover:bg-cream/50">
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusClasses(record.status)}`}
                                            >
                                                <span
                                                    className={`inline-block h-1.5 w-1.5 rounded-full ${statusDotColor}`}
                                                />
                                                {normalize(record.status) || "-"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="relative inline-block">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setChangeStatusOpen(
                                                            isChangeOpen ? null : record.id
                                                        )
                                                    }
                                                    disabled={isUpdating}
                                                    className="flex w-36 cursor-pointer items-center justify-between rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:border-teal focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <span className="truncate">--</span>
                                                    <ChevronDown className="h-3 w-3 shrink-0 text-ink-subtle" />
                                                </button>
                                                {isChangeOpen && (
                                                    <div className="absolute left-0 top-full z-50 mt-1 min-w-35 overflow-hidden rounded-lg border border-warm bg-white shadow-lg">
                                                        {changeStatusOptions.map((opt) => {
                                                            const dotColor = getStatusDotColor(opt);
                                                            return (
                                                                <button
                                                                    key={opt}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setChangeStatusOpen(null);
                                                                        setPendingChange({
                                                                            record,
                                                                            nextStatus: opt,
                                                                        });
                                                                    }}
                                                                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition hover:bg-cream ${
                                                                        currentStatus === opt
                                                                            ? "bg-cream"
                                                                            : ""
                                                                    } ${getStatusTextColor(opt)}`}
                                                                >
                                                                    <span
                                                                        className={`inline-block h-2 w-2 rounded-full ${dotColor}`}
                                                                    />
                                                                    {opt}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-ink">
                                            {record.device_no || "-"}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                                            {record.serial_no || "-"}
                                        </td>
                                        <td className="px-4 py-3 text-ink">
                                            {record.operator || "-"}
                                        </td>
                                        <td className="px-4 py-3 text-ink">
                                            {record.area || "-"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-teal">
                                                    {record.booth_code || "-"}
                                                </span>
                                                {record.booth_location && (
                                                    <span className="text-xs text-ink-subtle">
                                                        {record.booth_location}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {!loading && filteredRecords.length > 0 && (
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="text-xs text-ink-subtle">
                        Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}-
                        {Math.min(currentPage * ROWS_PER_PAGE, filteredRecords.length)} of{" "}
                        {filteredRecords.length} record
                        {filteredRecords.length === 1 ? "" : "s"}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={goFirstPage}
                            disabled={currentPage === 1}
                            className="inline-flex items-center justify-center rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                            title="First page"
                        >
                            <ChevronsLeft size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={currentPage === 1}
                            className="inline-flex items-center gap-1 rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                            title="Previous page"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <div className="flex items-center gap-0.5">
                            {visiblePages[0] > 1 && (
                                <span className="px-1 text-xs text-ink-subtle">...</span>
                            )}
                            {visiblePages.map((page) => (
                                <button
                                    key={page}
                                    type="button"
                                    onClick={() => setCurrentPage(page)}
                                    className={`min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-sm transition ${
                                        page === currentPage
                                            ? "bg-teal text-white"
                                            : "border border-warm bg-white text-ink hover:bg-surface"
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                            {visiblePages[visiblePages.length - 1] < totalPages && (
                                <span className="px-1 text-xs text-ink-subtle">...</span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                setCurrentPage((page) => Math.min(totalPages, page + 1))
                            }
                            disabled={currentPage === totalPages}
                            className="inline-flex items-center gap-1 rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                            title="Next page"
                        >
                            <ChevronRight size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={goLastPage}
                            disabled={currentPage === totalPages}
                            className="inline-flex items-center justify-center rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
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
