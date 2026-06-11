import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Search, RefreshCw } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { Pagination, Toast, ConfirmationModal } from "../../../shared/components";
import { EditModal } from "../components";
import {
    approveCpOperatorChangeRequest,
    listCpOperatorChangeRequests,
    rejectCpOperatorChangeRequest,
    type CpOperatorChangeRequest,
} from "../services/cpOperatorChangeRequests";

const teal = "#92C7CF";
const PAGE_SIZE = 10;

type StatusFilter = "pending" | "approved" | "rejected" | "cancelled";

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "cancelled", label: "Cancelled" },
];

const getFromOperator = (request: CpOperatorChangeRequest) => request.old_operator || request.from_operator || "Unassigned";

export default function AssignCpPage() {
    const { user } = useAuth();
    const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark");
    const [requests, setRequests] = useState<CpOperatorChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
    const [page, setPage] = useState(1);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [toast, setToast] = useState<{ open: boolean; message: string; type: "success" | "error" | "info" | "warning" }>({ open: false, message: "", type: "success" });

    useEffect(() => {
        const syncTheme = () => setDarkMode(document.documentElement.classList.contains("dark"));
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("storage", syncTheme);
        syncTheme();
        return () => { observer.disconnect(); window.removeEventListener("storage", syncTheme); };
    }, []);

    const showToast = useCallback((type: "success" | "error" | "info" | "warning", message: string) => {
        setToast({ open: true, type, message });
    }, []);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const data = await listCpOperatorChangeRequests().catch(() => [] as CpOperatorChangeRequest[]);
            setRequests(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load requests");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [search, statusFilter]);

    const filteredRequests = useMemo(() => {
        const q = search.trim().toLowerCase();
        return requests.filter((r) => {
            if ((r.status || "").toLowerCase() !== statusFilter) return false;
            if (!q) return true;
            return (r.brand || "").toLowerCase().includes(q) ||
                (r.model || "").toLowerCase().includes(q) ||
                (r.control_no || "").toLowerCase().includes(q) ||
                (r.serial_number || "").toLowerCase().includes(q) ||
                (r.old_operator || "").toLowerCase().includes(q) ||
                (r.from_operator || "").toLowerCase().includes(q) ||
                (r.to_operator || "").toLowerCase().includes(q) ||
                (r.requested_by_name || "").toLowerCase().includes(q) ||
                (r.reason || "").toLowerCase().includes(q);
        });
    }, [requests, search, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => filteredRequests.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filteredRequests, safePage]);

    const counts = useMemo(() => {
        const c: Record<StatusFilter, number> = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
        for (const r of requests) {
            const s = (r.status || "").toLowerCase() as StatusFilter;
            if (s in c) c[s] += 1;
        }
        return c;
    }, [requests]);

    const inputStyle = {
        background: darkMode ? "rgba(31,41,55,0.70)" : "rgba(255,255,255,0.78)",
        border: darkMode ? "1px solid rgba(75,85,99,0.55)" : "1px solid rgba(146,199,207,0.30)",
        color: darkMode ? "#F3F4F6" : "#1F2937",
        boxShadow: darkMode ? "none" : "inset 0 1px 0 rgba(255,255,255,0.70)",
    };

    const closeToast = () => setToast((t) => ({ ...t, open: false }));

    // Approve confirmation modal
    const [approveTarget, setApproveTarget] = useState<CpOperatorChangeRequest | null>(null);
    const [rejectNoteTarget, setRejectNoteTarget] = useState<CpOperatorChangeRequest | null>(null);
    const [rejectNote, setRejectNote] = useState("");

    const openApprove = (req: CpOperatorChangeRequest) => setApproveTarget(req);
    const closeApprove = () => setApproveTarget(null);

    const openReject = (req: CpOperatorChangeRequest) => {
        setRejectNoteTarget(req);
        setRejectNote("");
    };
    const closeReject = () => {
        setRejectNoteTarget(null);
        setRejectNote("");
    };

    const confirmApprove = async () => {
        const req = approveTarget;
        if (!req || !user?.id) return;
        const isLastPending = statusFilter === "pending" && counts.pending === 1;
        setBusyId(req.id);
        setApproveTarget(null);
        try {
            await approveCpOperatorChangeRequest(req.id, { admin_user_id: user.id });
            showToast("success", `Approved request for ${req.brand || ""} ${req.model || ""} (${req.control_no || ""}).`);
            await load();
            if (isLastPending) {
                setStatusFilter("approved");
            }
        } catch (e) {
            showToast("error", e instanceof Error ? e.message : "Failed to approve request");
        } finally {
            setBusyId(null);
        }
    };

    const submitReject = async () => {
        const req = rejectNoteTarget;
        const note = rejectNote.trim();
        if (!req || !user?.id) return;
        if (!note) {
            showToast("error", "Please add a rejection note before saving.");
            return;
        }
        const isLastPending = statusFilter === "pending" && counts.pending === 1;
        setBusyId(req.id);
        setRejectNoteTarget(null);
        setRejectNote("");
        try {
            await rejectCpOperatorChangeRequest(req.id, { admin_user_id: user.id, admin_notes: note });
            showToast("info", `Rejected request for ${req.brand || ""} ${req.model || ""} (${req.control_no || ""}).`);
            await load();
            if (isLastPending) {
                setStatusFilter("rejected");
            }
        } catch (e) {
            showToast("error", e instanceof Error ? e.message : "Failed to reject request");
        } finally {
            setBusyId(null);
        }
    };

    const getStatusBadgeClass = (status: string): string => {
        const n = status.toLowerCase();
        if (n === "pending") return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200";
        if (n === "approved") return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200";
        if (n === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200";
        if (n === "cancelled") return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
        return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    };

    const deviceLabel = (r: CpOperatorChangeRequest) => {
        return `${r.brand || ""} ${r.model || ""}`.trim() || `CP #${r.cellphone_id}`;
    };

    return (
        <div className="w-full max-w-full space-y-5">
            <Toast open={toast.open} message={toast.message} type={toast.type} onClose={closeToast} position="top-center" />
            {error && <div className="relative rounded-xl border border-red-200/60 bg-red-50/95 backdrop-blur-xl px-4 py-3 text-sm font-medium text-red-700 shadow-lg">{error}</div>}

            {/* Filter tabs */}
            <div
                className="mb-5 border-b pb-0 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"
                style={{ borderColor: "rgba(146,199,207,0.25)" }}
            >
                <div className="flex gap-1 overflow-x-auto">
                    {STATUS_OPTIONS.map((opt) => {
                        const isActive = statusFilter === opt.id;
                        const count = counts[opt.id] ?? 0;
                        return (
                            <button
                                key={opt.id}
                                onClick={() => setStatusFilter(opt.id)}
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
                                {opt.label}
                                {isActive && (
                                    <span className="ml-1 text-xs opacity-70" style={{ color: "#6B7280" }}>({count})</span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex justify-end items-end gap-3 pb-2 xl:pb-1">
                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brand, model, serial, operator..." className="h-9 w-full rounded-lg pl-8 pr-3 text-sm outline-none transition-all duration-200 focus:border-teal/60 focus:ring-2 focus:ring-teal/35 placeholder:text-gray-400 dark:placeholder:text-gray-400" style={inputStyle} />
                    </div>
                    <button
                        onClick={load}
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
                ) : filteredRequests.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-10 text-center text-sm text-gray-500 shadow-sm">
                        No assign-CP requests match the current filter.
                    </div>
                ) : (
                    paginated.map((r) => {
                        const isPending = r.status?.toLowerCase() === "pending";
                        const isDisabled = busyId === r.id;
                        return (
                            <div
                                key={r.id}
                                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base font-semibold text-gray-800">{deviceLabel(r)}</span>
                                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${getStatusBadgeClass(r.status)}`}>{r.status}</span>
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">
                                            <span className="font-mono text-xs text-gray-400">SN: {r.serial_number || "—"}</span>
                                            {" · CN: "}
                                            <span className="font-mono text-xs text-gray-400">{r.control_no || "—"}</span>
                                            {" · "}
                                            Requested by <span className="font-medium text-gray-700">{r.requested_by_name || "—"}</span>
                                            {" · "}
                                            {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                                        </p>
                                    </div>

                                    {isPending && (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => openApprove(r)}
                                                disabled={isDisabled}
                                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                                                style={{ background: "linear-gradient(135deg, #10B981, #34D399)" }}
                                            >
                                                <CheckCircle2 size={13} /> Approve
                                            </button>
                                            <button
                                                onClick={() => openReject(r)}
                                                disabled={isDisabled}
                                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                                                style={{ background: "linear-gradient(135deg, #EF4444, #F87171)" }}
                                            >
                                                <XCircle size={13} /> Reject
                                            </button>
                                        </div>
                                    )}

                                </div>

                                <div className="mt-3 grid gap-2 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-4">
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Device</div>
                                        <div className="text-sm text-gray-700">{r.brand || "—"} {r.model || ""}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">From</div>
                                        <div className="text-sm text-gray-700">
                                            {getFromOperator(r)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">To</div>
                                        <div className="text-sm font-medium" style={{ color: teal }}>
                                            {r.to_operator || "—"}
                                        </div>
                                    </div>
                                    {statusFilter !== "rejected" ? (
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reason</div>
                                            <div className="text-sm text-gray-700">
                                                {r.reason ? (
                                                    <span className="line-clamp-2" title={r.reason}>{r.reason}</span>
                                                ) : (
                                                    <span className="text-gray-400 italic">No reason provided</span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Admin note</div>
                                            <div className="text-sm text-gray-700">
                                                {r.admin_notes ? (
                                                    <span className="line-clamp-2" title={r.admin_notes}>{r.admin_notes}</span>
                                                ) : (
                                                    <span className="text-gray-400 italic">No admin note provided</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {(statusFilter === "approved" || statusFilter === "rejected") && (
                                    <div className="mt-2 text-xs" style={{ color: darkMode ? "#9CA3AF" : "#6B7280" }}>
                                        {statusFilter === "approved" ? "Approved by:" : "Rejected by:"}{" "}
                                        <span className="font-semibold" style={{ color: darkMode ? "#F3F4F6" : "#1F2937" }}>
                                            {r.decided_by_name || "—"}
                                        </span>
                                        {r.decided_at && <> · {new Date(r.decided_at).toLocaleString()}</>}
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

            {/* Approve confirmation modal */}
            <ConfirmationModal
                open={approveTarget !== null}
                title="Approve CP Operator Change"
                message={
                    approveTarget
                        ? `Are you sure you want to approve the operator change for ${deviceLabel(approveTarget)} (${getFromOperator(approveTarget)} → ${approveTarget.to_operator || "—"})?`
                        : ""
                }
                confirmLabel="Approve"
                cancelLabel="Cancel"
                onConfirm={confirmApprove}
                onCancel={closeApprove}
                isLoading={busyId !== null}
                loadingLabel="Approving..."
            />

            {/* Reject note modal */}
            <EditModal
                open={rejectNoteTarget !== null}
                title="Reject CP Operator Change"
                subtitle="Add a note explaining why this request is being rejected."
                onClose={closeReject}
                accentColor="rose"
            >
                <div className="flex flex-col gap-4">
                    {rejectNoteTarget && (
                        <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500">Device</span>
                                <span className="font-semibold text-gray-800">{deviceLabel(rejectNoteTarget)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500">From</span>
                                <span className="text-gray-700">{getFromOperator(rejectNoteTarget)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500">To</span>
                                <span className="font-semibold" style={{ color: teal }}>{rejectNoteTarget.to_operator || "—"}</span>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            Rejection Note <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Explain why this request is being rejected..."
                            rows={3}
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={closeReject}
                        className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submitReject}
                        disabled={!rejectNote.trim()}
                        className="rounded-xl bg-linear-to-r from-rose to-rose-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose/25 hover:shadow-xl hover:shadow-rose/30 hover:from-rose-dark hover:to-rose transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Reject
                    </button>
                </div>
            </EditModal>
        </div>
    );
}