import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle, CalendarDays } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import {
    approveCpBoothChangeRequest,
    listCpBoothChangeRequests,
    rejectCpBoothChangeRequest,
    type CpBoothChangeRequest,
    type CpRequestStatus,
} from "../services/cpBoothChangeRequests";
import { ConfirmationModal, EditModal } from "../components";
import { Pagination, Toast, type ToastType } from "../../../shared/components";

const teal = "#92C7CF";
const PAGE_SIZE = 10;

function getTodayString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

const getRequestedBoothLabel = (request: CpBoothChangeRequest) => request.requested_booth_code || `#${request.requested_booth_id}`;

export default function CpRequestResetPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<CpBoothChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<CpRequestStatus>("pending");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [page, setPage] = useState(1);
    const [darkMode, setDarkMode] = useState(() => {
        return document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
    });

    useEffect(() => {
        const syncTheme = () => {
            setDarkMode(document.documentElement.classList.contains("dark"));
        };
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("storage", syncTheme);
        syncTheme();
        return () => {
            observer.disconnect();
            window.removeEventListener("storage", syncTheme);
        };
    }, []);
    const [busyId, setBusyId] = useState<number | null>(null);

    // Toast state
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<ToastType>("error");

    const showToast = (message: string, type: ToastType = "error") => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    // Auto-close toast after 4 seconds
    useEffect(() => {
        if (!toastOpen) return;
        const timer = setTimeout(() => setToastOpen(false), 4000);
        return () => clearTimeout(timer);
    }, [toastOpen]);

    // Confirmation modal state (for approve)
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<CpBoothChangeRequest | null>(null);

    // Reject note modal state
    const [rejectNoteOpen, setRejectNoteOpen] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<CpBoothChangeRequest | null>(null);
    const [rejectNoteValue, setRejectNoteValue] = useState("");

    const openConfirm = (action: "approve" | "reject", req: CpBoothChangeRequest) => {
        setConfirmAction(action);
        setConfirmTarget(req);
        setConfirmOpen(true);
    };

    const closeConfirm = () => {
        setConfirmOpen(false);
        setConfirmAction(null);
        setConfirmTarget(null);
    };

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const data = await listCpBoothChangeRequests({ status: filter });
            setRequests(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    useEffect(() => { setPage(1); }, [filter, dateFrom, dateTo]);

    const counts = useMemo(() => {
        const c = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
        for (const r of requests) c[r.status]++;
        return c;
    }, [requests]);

    const filteredRequests = useMemo(() => {
        return requests.filter((r) => {
            if (r.status !== filter) return false;

            // Determine effective date range
            let effectiveFrom = dateFrom;
            let effectiveTo = dateTo;

            // For non-pending statuses, default to today if no date range set
            if (filter !== "pending" && !effectiveFrom && !effectiveTo) {
                const today = getTodayString();
                effectiveFrom = today;
                effectiveTo = today;
            }

            if (effectiveFrom || effectiveTo) {
                const createdAt = r.created_at ? new Date(r.created_at).getTime() : null;
                if (createdAt !== null) {
                    if (effectiveFrom) {
                        const fromDate = new Date(effectiveFrom).getTime();
                        if (createdAt < fromDate) return false;
                    }
                    if (effectiveTo) {
                        const toEnd = new Date(effectiveTo + "T23:59:59.999").getTime();
                        if (createdAt > toEnd) return false;
                    }
                }
            }

            return true;
        });
    }, [requests, filter, dateFrom, dateTo]);

    const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => filteredRequests.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filteredRequests, safePage]);

    const handleConfirm = async () => {
        if (!confirmAction || !confirmTarget) return;
        const req = confirmTarget;
        const isLastPending = filter === "pending" && filteredRequests.length === 1;
        setBusyId(req.id);
        setConfirmOpen(false);
        try {
            if (confirmAction === "approve") {
                await approveCpBoothChangeRequest(req.id, {
                    admin_user_id: user?.id ?? null,
                });
                showToast(`CP request for ${req.control_no || req.brand} approved successfully.`, "success");
            }
            await refresh();
            if (isLastPending) {
                setFilter("approved");
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            showToast(`Approval failed: ${msg}`);
        } finally {
            setBusyId(null);
            closeConfirm();
        }
    };

    const handleApprove = (req: CpBoothChangeRequest) => {
        openConfirm("approve", req);
    };

    const handleReject = (req: CpBoothChangeRequest) => {
        setRejectTarget(req);
        setRejectNoteValue("");
        setRejectNoteOpen(true);
    };

    const handleRejectSubmit = async () => {
        if (!rejectTarget) return;
        const note = rejectNoteValue.trim();
        if (!note) {
            showToast("Please add a note explaining why before rejecting.");
            return;
        }
        const isLastPending = filter === "pending" && filteredRequests.length === 1;
        setBusyId(rejectTarget.id);
        setRejectNoteOpen(false);
        try {
            await rejectCpBoothChangeRequest(rejectTarget.id, {
                admin_user_id: user?.id ?? null,
                admin_notes: note,
            });
            showToast(`CP request for ${rejectTarget.control_no || rejectTarget.brand} rejected.`, "success");
            await refresh();
            if (isLastPending) {
                setFilter("rejected");
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            showToast(`Rejection failed: ${msg}`);
        } finally {
            setBusyId(null);
            setRejectTarget(null);
        }
    };

    const handleRejectNoteClose = () => {
        setRejectNoteOpen(false);
        setRejectTarget(null);
        setRejectNoteValue("");
    };

    const confirmTitle = "Approve CP Booth Change";

    const confirmMessage = `Are you sure you want to approve CP booth change for ${confirmTarget?.brand} ${confirmTarget?.model} → ${confirmTarget?.requested_booth_code}?`;

    const confirmLabel = "Approve";

    const getStatusBadgeClass = (status: string): string => {
        const n = status.toLowerCase();
        if (n === "pending") return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200";
        if (n === "approved") return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200";
        if (n === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200";
        if (n === "cancelled") return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
        return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    };

    return (
        <div className="w-full max-w-full space-y-5">
            <Toast open={toastOpen} message={toastMessage} type={toastType} onClose={() => setToastOpen(false)} position="top-center" />
            {error && <div className="relative rounded-xl border border-red-200/60 bg-red-50/95 backdrop-blur-xl px-4 py-3 text-sm font-medium text-red-700 shadow-lg">{error}</div>}

            {/* Filter tabs */}
            <div
                className="mb-5 border-b pb-0 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"
                style={{ borderColor: "rgba(146,199,207,0.25)" }}
            >
                <div className="flex gap-1 overflow-x-auto">
                    {(
                        [
                            ["pending", "Pending"],
                            ["approved", "Approved"],
                            ["rejected", "Rejected"],
                            ["cancelled", "Cancelled"],
                        ] as Array<[CpRequestStatus, string]>
                    ).map(([value, label]) => {
                        const isActive = filter === value;
                        const count = counts[value];
                        return (
                            <button
                                key={value}
                                onClick={() => setFilter(value)}
                                className="flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-t-xl cursor-pointer"
                                style={{
                                    background: isActive
                                        ? "rgba(146,199,207,0.15)"
                                        : "transparent",
                                    border: isActive
                                        ? "1px solid rgba(146,199,207,0.25)"
                                        : "1px solid transparent",
                                    borderBottom: isActive
                                        ? "1px solid white"
                                        : "1px solid transparent",
                                    color: isActive
                                        ? darkMode
                                            ? "#FFFFFF"
                                            : "#1F2937"
                                        : "#6B7280",
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = "rgba(146,199,207,0.06)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = "transparent";
                                    }
                                }}
                            >
                                {label}
                                {isActive && (
                                    <span className="ml-1 text-xs opacity-70" style={{ color: "#6B7280" }}>({count})</span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap justify-end items-center gap-3 pb-2 xl:pb-1">
                    {/* Date range filter - visible for non-pending statuses */}
                    {filter !== "pending" && (
                        <div className="flex items-center gap-2">
                            <CalendarDays size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                                className="h-9 rounded-lg border px-2.5 py-1.5 text-xs outline-none transition-all duration-200 focus:border-teal/60 focus:ring-2 focus:ring-teal/35 placeholder:text-gray-400 dark:placeholder:text-gray-400"
                                style={{
                                    background: darkMode ? "rgba(31,41,55,0.70)" : "rgba(255,255,255,0.78)",
                                    border: darkMode ? "1px solid rgba(75,85,99,0.55)" : "1px solid rgba(146,199,207,0.30)",
                                    color: darkMode ? "#F3F4F6" : "#1F2937",
                                    boxShadow: darkMode ? "none" : "inset 0 1px 0 rgba(255,255,255,0.70)",
                                    width: "auto",
                                    minWidth: "140px"
                                }}
                                title="From date"
                            />
                            <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                                className="h-9 rounded-lg border px-2.5 py-1.5 text-xs outline-none transition-all duration-200 focus:border-teal/60 focus:ring-2 focus:ring-teal/35 placeholder:text-gray-400 dark:placeholder:text-gray-400"
                                style={{
                                    background: darkMode ? "rgba(31,41,55,0.70)" : "rgba(255,255,255,0.78)",
                                    border: darkMode ? "1px solid rgba(75,85,99,0.55)" : "1px solid rgba(146,199,207,0.30)",
                                    color: darkMode ? "#F3F4F6" : "#1F2937",
                                    boxShadow: darkMode ? "none" : "inset 0 1px 0 rgba(255,255,255,0.70)",
                                    width: "auto",
                                    minWidth: "140px"
                                }}
                                title="To date"
                            />
                            {(dateFrom || dateTo) && (
                                <button
                                    onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
                                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                    title="Clear date filter"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    )}
                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Card-based layout */}
            <div className="space-y-3">
                {loading ? (
                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-10 text-center text-sm text-gray-500 shadow-sm">
                        Loading...
                    </div>
                ) : requests.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-10 text-center text-sm text-gray-500 shadow-sm">
                        No {filter} requests.
                    </div>
                ) : (
                    paginated.map((req) => {
                        const isPending = req.status === "pending";
                        const isDisabled = busyId === req.id;
                        return (
                            <div
                                key={req.id}
                                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base font-semibold text-gray-800">
                                                {req.brand} {req.model || ""}
                                            </span>
                                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${getStatusBadgeClass(req.status)}`}>{req.status}</span>
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">
                                            Requested by <span className="font-medium text-gray-700">{req.requested_by_name || "—"}</span>
                                            {" · "}
                                            {new Date(req.created_at).toLocaleString()}
                                        </p>
                                    </div>

                                    {isPending && (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleApprove(req)}
                                                disabled={isDisabled}
                                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                                                style={{ background: "linear-gradient(135deg, #10B981, #34D399)" }}
                                            >
                                                <CheckCircle2 size={13} /> Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(req)}
                                                disabled={isDisabled}
                                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                                                style={{ background: "linear-gradient(135deg, #EF4444, #F87171)" }}
                                            >
                                                <XCircle size={13} /> Reject
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 grid gap-2 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Serial</div>
                                        <div className="text-sm text-gray-700">{req.serial_number || "—"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Control No.</div>
                                        <div className="text-sm text-gray-700">{req.control_no || "—"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Request booth</div>
                                        <div className="text-sm font-medium" style={{ color: teal }}>
                                            {getRequestedBoothLabel(req)}
                                        </div>
                                    </div>
                                    {req.status !== "rejected" && (
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reason</div>
                                            <div className="text-sm text-gray-700">
                                                {req.reason ? (
                                                    <span className="line-clamp-2" title={req.reason}>{req.reason}</span>
                                                ) : (
                                                    <span className="text-gray-400 italic">No reason provided</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {req.status === "rejected" && (
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Admin note</div>
                                            <div className="text-sm text-gray-700">
                                                {req.admin_notes ? (
                                                    <span className="line-clamp-2" title={req.admin_notes}>{req.admin_notes}</span>
                                                ) : (
                                                    <span className="text-gray-400 italic">No admin note provided</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {(req.status === "approved" || req.status === "rejected") && (
                                    <div className="mt-2 text-xs" style={{ color: darkMode ? "#9CA3AF" : "#6B7280" }}>
                                        {req.status === "approved" ? "Approved by:" : "Rejected by:"}{" "}
                                        <span className="font-semibold" style={{ color: darkMode ? "#F3F4F6" : "#1F2937" }}>
                                            {req.admin_name || "—"}
                                        </span>
                                        {req.decided_at && <> · {new Date(req.decided_at).toLocaleString()}</>}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {!loading && filteredRequests.length > 0 && (
                <Pagination currentPage={safePage} totalPages={totalPages} totalItems={filteredRequests.length} onPageChange={setPage} pageSize={PAGE_SIZE} />
            )}

            {/* Approve Confirmation Modal */}
            <ConfirmationModal
                open={confirmOpen}
                title={confirmTitle}
                message={confirmMessage}
                confirmLabel={confirmLabel}
                cancelLabel="Cancel"
                onConfirm={handleConfirm}
                onCancel={closeConfirm}
                isLoading={busyId !== null}
                loadingLabel="Approving..."
            />

            {/* Reject Note Modal */}
            <EditModal
                open={rejectNoteOpen}
                title="Reject CP Booth Change"
                subtitle="Add a note explaining why this request is being rejected."
                onClose={handleRejectNoteClose}
                accentColor="rose"
            >
                <div className="flex flex-col gap-4">
                    {rejectTarget && (
                        <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500">Device</span>
                                <span className="font-semibold text-gray-800">{rejectTarget.brand} {rejectTarget.model}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500">Serial</span>
                                <span className="text-gray-700">{rejectTarget.serial_number || "—"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500">To booth</span>
                                <span className="font-semibold" style={{ color: teal }}>{getRequestedBoothLabel(rejectTarget)}</span>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            Rejection Note <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={rejectNoteValue}
                            onChange={(e) => setRejectNoteValue(e.target.value)}
                            placeholder="Explain why this request is being rejected..."
                            rows={3}
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                    <button
                        onClick={handleRejectNoteClose}
                        className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleRejectSubmit}
                        disabled={!rejectNoteValue.trim()}
                        className="rounded-xl bg-linear-to-r from-rose to-rose-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose/25 hover:shadow-xl hover:shadow-rose/30 hover:from-rose-dark hover:to-rose transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Reject
                    </button>
                </div>
            </EditModal>

        </div>
    );
}