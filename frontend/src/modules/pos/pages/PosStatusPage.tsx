import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, ChevronDown, RefreshCw, Search, X } from "lucide-react";
import type { PosRecord } from "../types";
import { fetchPosRecords, updatePosRecord } from "../services";

type SearchField = "device_no" | "serial_no" | "booth_code";

const DEFAULT_STATUS_OPTIONS = ["Active", "Inactive", "For Repair"];

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

const searchFieldLabels: Record<SearchField, string> = {
    device_no: "Device Number",
    serial_no: "Serial Number",
    booth_code: "Booth Code",
};

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
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-ink">Change Status</h3>
                <p className="mt-2 text-sm text-ink-muted">
                    Change status of device{" "}
                    <span className="font-medium text-ink">{record.device_no}</span> from{" "}
                    <span className="font-medium text-ink">
                        {normalize(record.status) || "-"}
                    </span>{" "}
                    to{" "}
                    <span className={`font-medium ${getStatusTextColor(nextStatus)}`}>
                        {nextStatus}
                    </span>
                    ?
                </p>
                <div className="mt-5 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-warm px-4 py-2 text-sm font-medium text-ink transition hover:bg-cream"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-dark"
                    >
                        Confirm
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
    const [records, setRecords] = useState<PosRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchField, setSearchField] = useState<SearchField>("device_no");
    const [statusFilter, setStatusFilter] = useState("all");
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
            if (
                changeStatusRef.current &&
                !changeStatusRef.current.contains(e.target as Node)
            ) {
                setChangeStatusOpen(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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

            const fieldValue = normalize(record[searchField]).toLowerCase();
            return fieldValue.includes(query);
        });
    }, [records, searchField, searchQuery, statusFilter]);

    const handleConfirmChange = async () => {
        if (!pendingChange) return;
        const { record, nextStatus } = pendingChange;
        if (record.status === nextStatus) return;

        setUpdatingRecordId(record.id);
        setPendingChange(null);

        try {
            const updatedRecord = await updatePosRecord(record.id, { status: nextStatus });
            setRecords((currentRecords) =>
                currentRecords.map((currentRecord) =>
                    currentRecord.id === record.id ? updatedRecord : currentRecord
                )
            );
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

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-72">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={`Search ${searchFieldLabels[searchField].toLowerCase()}...`}
                            className="w-full rounded-lg border border-warm bg-card py-2 pl-9 pr-3 text-sm text-ink shadow-sm transition placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                        />
                    </div>

                    <div className="relative w-full sm:w-52">
                        <select
                            value={searchField}
                            onChange={(event) => setSearchField(event.target.value as SearchField)}
                            className="w-full cursor-pointer appearance-none rounded-lg border border-warm bg-card py-2 pl-3 pr-8 text-sm text-ink shadow-sm transition focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                        >
                            <option value="device_no">Device Number</option>
                            <option value="serial_no">Serial Number</option>
                            <option value="booth_code">Booth Code</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
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
                            filteredRecords.map((record) => {
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

            {!loading && (
                <p className="text-xs text-ink-subtle">
                    Showing {filteredRecords.length} of {records.length} record
                    {records.length === 1 ? "" : "s"}
                </p>
            )}
        </div>
    );
}