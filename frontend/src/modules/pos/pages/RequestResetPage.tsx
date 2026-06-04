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

    return (
        <div>
            {/* Filter tabs — reports log style */}
            <div className="mb-5 border-b pb-0 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"
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
                                {value !== "all" && isActive && (
                                    <span className="ml-1 text-xs opacity-70" style={{ color: "#6B7280" }}>({counts[value]})</span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex justify-end pb-2 xl:pb-1">
                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            <Toast open={toastOpen} message={toastMessage} type={toastType} onClose={() => setToastOpen(false)} />

            <div className="space-y-3">
                {loading ? (
                    <p className="rounded-xl border border-warm bg-card px-3 py-10 text-center text-sm text-ink-subtle">
                        Loading...
                    </p>
                ) : requests.length === 0 ? (
                    <p className="rounded-xl border border-warm bg-card px-3 py-10 text-center text-sm text-ink-subtle">
                        No {filter === "all" ? "" : filter} requests.
                    </p>
                ) : (
                    requests.map((req) => (
                        <div
                            key={req.id}
                            className="rounded-xl border border-warm bg-card p-4 shadow-sm"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-semibold text-ink">
                                            {req.device_no || `POS #${req.pos_record_id}`}
                                        </span>
                                        <StatusPill status={req.status} />
                                    </div>
                                    <p className="mt-1 text-xs text-ink-muted">
                                        Requested by{" "}
                                        <span className="font-medium text-ink">
                                            {req.requested_by_name || "—"}
                                        </span>
                                        {" · "}
                                        {new Date(req.created_at).toLocaleString()}
                                    </p>
                                </div>

                                {req.status === "pending" && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleApprove(req)}
                                            disabled={busyId === req.id}
                                            className="rounded-lg p-1.5 transition-colors hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Approve"
                                            style={{ color: "#16A34A" }}
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleReject(req)}
                                            disabled={busyId === req.id}
                                            className="rounded-lg p-1.5 transition-colors hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Reject"
                                            style={{ color: "#EF4444" }}
                                        >
                                            <XCircle className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="mt-3 grid gap-2 rounded-lg bg-cream/50 p-3 text-sm sm:grid-cols-3">
                                <Pair label="Serial" value={req.serial_number || "—"} />
                                <Pair
                                    label="Move from"
                                    value={req.current_booth_code || "—"}
                                />
                                <Pair
                                    label="Move to"
                                    value={req.requested_booth_code || `#${req.requested_booth_id}`}
                                />
                            </div>

                            {req.reason && (
                                <p className="mt-3 rounded-lg border border-warm bg-cream px-3 py-2 text-sm text-ink">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                        Reason
                                    </span>
                                    <br />
                                    {req.reason}
                                </p>
                            )}

                            {req.admin_notes && (
                                <p className="mt-3 text-xs text-ink-muted">
                                    <span className="font-semibold text-ink">Admin note:</span>{" "}
                                    {req.admin_notes}
                                    {req.admin_name && ` — ${req.admin_name}`}
                                </p>
                            )}
                        </div>
                    ))
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
                        <div className="rounded-lg bg-cream/50 p-3 text-sm space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-ink-muted">Device</span>
                                <span className="font-semibold text-ink">{rejectTarget.device_no}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-ink-muted">From</span>
                                <span className="text-ink">{rejectTarget.current_booth_code || "—"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-ink-muted">To</span>
                                <span className="font-semibold text-teal">{rejectTarget.requested_booth_code || `#${rejectTarget.requested_booth_id}`}</span>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">
                            Rejection Note <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={rejectNoteValue}
                            onChange={(e) => setRejectNoteValue(e.target.value)}
                            placeholder="Explain why this request is being rejected..."
                            rows={3}
                            className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-warm/60">
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

function Pair({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
            </div>
            <div className="text-sm text-ink">{value}</div>
        </div>
    );
}

function StatusPill({ status }: { status: RequestStatus }) {
    const colorMap: Record<RequestStatus, string> = {
        pending: "bg-peach/40 text-ink",
        approved: "bg-teal-light/60 text-ink",
        rejected: "bg-rose/40 text-ink",
        cancelled: "bg-warm text-ink-muted",
    };
    return (
        <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${colorMap[status]}`}
        >
            {status}
        </span>
    );
}
