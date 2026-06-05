import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import {
    approveBoothChangeRequest,
    listBoothChangeRequests,
    rejectBoothChangeRequest,
    type BoothChangeRequest,
    type RequestStatus,
} from "../services/boothChangeRequests";
import { ConfirmationModal, EditModal } from "../components";
import { Toast, type ToastType } from "../../../shared/components";

const teal = "#92C7CF";

export default function RequestResetPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<BoothChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<RequestStatus | "all">("pending");
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
    const [confirmTarget, setConfirmTarget] = useState<BoothChangeRequest | null>(null);

    // Reject note modal state
    const [rejectNoteOpen, setRejectNoteOpen] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<BoothChangeRequest | null>(null);
    const [rejectNoteValue, setRejectNoteValue] = useState("");

    const openConfirm = (action: "approve" | "reject", req: BoothChangeRequest) => {
        setConfirmAction(action);
        setConfirmTarget(req);
        setConfirmOpen(true);
    };

    const closeConfirm = () => {
        setConfirmOpen(false);
        setConfirmAction(null);
        setConfirmTarget(null);
    };

    const refresh = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await listBoothChangeRequests(
                filter === "all" ? {} : { status: filter }
            );
            setRequests(data);
        } catch (err) {
            setError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    const counts = useMemo(() => {
        const c = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
        for (const r of requests) c[r.status]++;
        return c;
    }, [requests]);

    const handleConfirm = async () => {
        if (!confirmAction || !confirmTarget) return;
        const req = confirmTarget;
        setBusyId(req.id);
        setConfirmOpen(false);
        try {
            if (confirmAction === "approve") {
                await approveBoothChangeRequest(req.id, {
                    admin_user_id: user?.id ?? null,
                });
                showToast(`Request for ${req.device_no} approved successfully.`, "success");
            }
            await refresh();
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            showToast(`Approval failed: ${msg}`);
        } finally {
            setBusyId(null);
            closeConfirm();
        }
    };

    const handleApprove = (req: BoothChangeRequest) => {
        openConfirm("approve", req);
    };

    const handleReject = (req: BoothChangeRequest) => {
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
        setBusyId(rejectTarget.id);
        setRejectNoteOpen(false);
        try {
            await rejectBoothChangeRequest(rejectTarget.id, {
                admin_user_id: user?.id ?? null,
                admin_notes: note,
            });
            showToast(`Request for ${rejectTarget.device_no} rejected.`, "success");
            await refresh();
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

    const confirmTitle = "Approve Booth Change";

    const confirmMessage = `Are you sure you want to approve booth change for ${confirmTarget?.device_no} → ${confirmTarget?.requested_booth_code}?`;

    const confirmLabel = "Approve";

    const getStatusBadgeClass = (status: string): string => {
        const n = status.toLowerCase();
        if (n === "pending") return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200";
        if (n === "approved") return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200";
        if (n === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200";
        if (n === "cancelled") return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
        return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    };

    const inputStyle = {
        background: darkMode ? "rgba(31,41,55,0.70)" : "rgba(255,255,255,0.78)",
        border: darkMode ? "1px solid rgba(75,85,99,0.55)" : "1px solid rgba(146,199,207,0.30)",
        color: darkMode ? "#F3F4F6" : "#1F2937",
        boxShadow: darkMode ? "none" : "inset 0 1px 0 rgba(255,255,255,0.70)",
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
                            ["all", "All"],
                        ] as Array<[RequestStatus | "all", string]>
                    ).map(([value, label]) => {
                        const isActive = filter === value;
                        const count = value !== "all" ? counts[value] : requests.length;
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
                <div className="flex justify-end items-end gap-3 pb-2 xl:pb-1">
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

            {/* Card-based layout (matching AssignOutletPage) */}
            <div className="space-y-3">
                {loading ? (
                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-10 text-center text-sm text-gray-500 shadow-sm">
                        Loading...
                    </div>
                ) : requests.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-10 text-center text-sm text-gray-500 shadow-sm">
                        No {filter === "all" ? "" : filter} requests.
                    </div>
                ) : (
                    requests.map((req) => {
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
                                                {req.device_no || `POS #${req.pos_record_id}`}
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

                                <div className="mt-3 grid gap-2 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-3">
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Serial</div>
                                        <div className="text-sm text-gray-700">{req.serial_number || "—"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Move from</div>
                                        <div className="text-sm text-gray-700">{req.current_booth_code || "—"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Move to</div>
                                        <div className="text-sm font-medium" style={{ color: teal }}>
                                            {req.requested_booth_code || `#${req.requested_booth_id}`}
                                            {req.requested_by_name && <span className="block text-xs font-normal text-gray-500">by {req.requested_by_name}</span>}
                                        </div>
                                    </div>
                                </div>

                                {req.reason && (
                                    <p className="mt-3 rounded-lg border px-3 py-2 text-sm"
                                        style={{
                                            background: darkMode ? "rgba(55,65,81,0.50)" : "rgba(0,0,0,0.03)",
                                            borderColor: darkMode ? "rgba(75,85,99,0.40)" : "rgba(0,0,0,0.08)",
                                            color: darkMode ? "#F3F4F6" : "#374151",
                                        }}
                                    >
                                        <span className="text-xs font-semibold uppercase tracking-wide"
                                            style={{ color: darkMode ? "#9CA3AF" : "#6B7280" }}>
                                            Reason
                                        </span>
                                        <br />
                                        {req.reason}
                                    </p>
                                )}

                                {req.admin_notes && (
                                    <p className="mt-2 text-xs" style={{ color: darkMode ? "#9CA3AF" : "#6B7280" }}>
                                        <span className="font-semibold" style={{ color: darkMode ? "#F3F4F6" : "#1F2937" }}>Admin note:</span>{" "}
                                        {req.admin_notes}
                                        {req.admin_name && <> — {req.admin_name}</>}
                                    </p>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

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
                title="Reject Booth Change"
                subtitle="Add a note explaining why this request is being rejected."
                onClose={handleRejectNoteClose}
                accentColor="rose"
            >
                <div className="flex flex-col gap-4">
                    {rejectTarget && (
                        <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500">Device</span>
                                <span className="font-semibold text-gray-800">{rejectTarget.device_no}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500">From</span>
                                <span className="text-gray-700">{rejectTarget.current_booth_code || "—"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500">To</span>
                                <span className="font-semibold" style={{ color: teal }}>{rejectTarget.requested_booth_code || `#${rejectTarget.requested_booth_id}`}</span>
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
                        className="rounded-xl bg-gradient-to-r from-rose to-rose-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose/25 hover:shadow-xl hover:shadow-rose/30 hover:from-rose-dark hover:to-rose transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Reject
                    </button>
                </div>
            </EditModal>

        </div>
    );
}