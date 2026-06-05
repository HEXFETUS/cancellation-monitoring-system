import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, CheckCircle2, XCircle, Search, RefreshCw, Filter } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { Pagination, Toast } from "../../../shared/components";
import {
    approveOperatorChangeRequest,
    cancelOperatorChangeRequest,
    listOperatorChangeRequests,
    rejectOperatorChangeRequest,
    type OperatorChangeRequest,
} from "../services/operatorChangeRequests";

const teal = "#92C7CF";
const tealLight = "#AAD7D9";
const PAGE_SIZE = 10;

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "cancelled";

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "cancelled", label: "Cancelled" },
];

export default function AssignPosPage() {
    const { user } = useAuth();
    const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark");
    const [requests, setRequests] = useState<OperatorChangeRequest[]>([]);
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
            const data = await listOperatorChangeRequests().catch(() => [] as OperatorChangeRequest[]);
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
            if (statusFilter !== "all" && (r.status || "").toLowerCase() !== statusFilter) return false;
            if (!q) return true;
            return (r.device_no || "").toLowerCase().includes(q) ||
                (r.serial_number || "").toLowerCase().includes(q) ||
                (r.from_operator || "").toLowerCase().includes(q) ||
                (r.to_operator || "").toLowerCase().includes(q) ||
                (r.requested_by_name || "").toLowerCase().includes(q) ||
                (r.area || "").toLowerCase().includes(q) ||
                (r.current_booth_code || "").toLowerCase().includes(q);
        });
    }, [requests, search, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => filteredRequests.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filteredRequests, safePage]);

    const counts = useMemo(() => {
        const c: Record<StatusFilter, number> = { all: requests.length, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
        for (const r of requests) {
            const s = (r.status || "").toLowerCase() as StatusFilter;
            if (s in c && s !== "all") c[s] += 1;
        }
        return c;
    }, [requests]);

    const handleApprove = async (req: OperatorChangeRequest) => {
        if (!user?.id) return;
        try {
            setBusyId(req.id);
            await approveOperatorChangeRequest(req.id, { admin_user_id: user.id });
            showToast("success", `Approved request for ${req.device_no || `POS #${req.pos_record_id}`}.`);
            await load();
        } catch (e) { showToast("error", e instanceof Error ? e.message : "Failed to approve request"); }
        finally { setBusyId(null); }
    };

    const handleReject = async (req: OperatorChangeRequest) => {
        if (!user?.id) return;
        try {
            setBusyId(req.id);
            await rejectOperatorChangeRequest(req.id, { admin_user_id: user.id });
            showToast("info", `Rejected request for ${req.device_no || `POS #${req.pos_record_id}`}.`);
            await load();
        } catch (e) { showToast("error", e instanceof Error ? e.message : "Failed to reject request"); }
        finally { setBusyId(null); }
    };

    const handleForceCancel = async (req: OperatorChangeRequest) => {
        if (!user?.id) return;
        try {
            setBusyId(req.id);
            await cancelOperatorChangeRequest(req.id, user.id);
            showToast("warning", `Cancelled request for ${req.device_no || `POS #${req.pos_record_id}`}.`);
            await load();
        } catch (e) { showToast("error", e instanceof Error ? e.message : "Failed to cancel request"); }
        finally { setBusyId(null); }
    };

    const inputStyle = {
        background: darkMode ? "rgba(31,41,55,0.70)" : "rgba(255,255,255,0.78)",
        border: darkMode ? "1px solid rgba(75,85,99,0.55)" : "1px solid rgba(146,199,207,0.30)",
        color: darkMode ? "#F3F4F6" : "#1F2937",
        boxShadow: darkMode ? "none" : "inset 0 1px 0 rgba(255,255,255,0.70)",
    };

    const getStatusBadgeStyle = (status: string): React.CSSProperties => {
        const n = status.toLowerCase();
        if (n === "pending") return darkMode ? { backgroundColor: "rgba(146,64,14,0.60)", color: "#FDE68A" } : { backgroundColor: "#FEF3C7", color: "#B45309" };
        if (n === "approved") return darkMode ? { backgroundColor: "rgba(22,101,52,0.60)", color: "#BBF7D0" } : { backgroundColor: "#DCFCE7", color: "#15803D" };
        if (n === "rejected") return darkMode ? { backgroundColor: "rgba(153,27,27,0.60)", color: "#FECACA" } : { backgroundColor: "#FEE2E2", color: "#B91C1C" };
        if (n === "cancelled") return darkMode ? { backgroundColor: "rgba(55,65,81,0.80)", color: "#D1D5DB" } : { backgroundColor: "#E5E7EB", color: "#374151" };
        return darkMode ? { backgroundColor: "rgba(55,65,81,0.80)", color: "#D1D5DB" } : { backgroundColor: "#F3F4F6", color: "#4B5563" };
    };

    const closeToast = () => setToast((t) => ({ ...t, open: false }));

    return (
        <div className="w-full max-w-full space-y-5">
            <Toast open={toast.open} message={toast.message} type={toast.type} onClose={closeToast} position="top-center" />
            {error && <div className="relative rounded-xl border border-red-200/60 bg-red-50/95 backdrop-blur-xl px-4 py-3 text-sm font-medium text-red-700 shadow-lg">{error}</div>}

            <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-white/40 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft size={18} style={{ color: teal }} />
                        <div>
                            <h1 className="text-base font-semibold text-gray-800">Assign POS Requests</h1>
                            <p className="text-xs text-gray-500">Review and approve operator change requests for POS devices.</p>
                        </div>
                    </div>
                    <button type="button" onClick={load} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#92C7CF]/50" aria-label="Refresh"><RefreshCw size={16} /></button>
                </div>
                <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500"><Filter size={13} /> Status</span>
                        {STATUS_OPTIONS.map((opt) => {
                            const isActive = statusFilter === opt.id;
                            const count = counts[opt.id] ?? 0;
                            return (
                                <button key={opt.id} type="button" onClick={() => setStatusFilter(opt.id)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200" style={{ background: isActive ? `linear-gradient(135deg, ${teal}, ${tealLight})` : darkMode ? "rgba(75,85,99,0.30)" : "rgba(146,199,207,0.15)", color: isActive ? "#FFFFFF" : darkMode ? "#E5E7EB" : "#374151", boxShadow: isActive ? "0 2px 6px rgba(146,199,207,0.30)" : "none" }}>
                                    {opt.label}
                                    <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold" style={{ background: isActive ? "rgba(255,255,255,0.30)" : darkMode ? "rgba(75,85,99,0.60)" : "rgba(146,199,207,0.30)", color: isActive ? "#FFFFFF" : darkMode ? "#E5E7EB" : "#374151" }}>{count}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="relative w-full lg:w-72">
                        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search device, serial, operator..." className="h-9 w-full rounded-lg pl-8 pr-3 text-sm outline-none transition-all duration-200 focus:border-[#92C7CF]/60 focus:ring-2 focus:ring-[#92C7CF]/35 placeholder:text-gray-400 dark:placeholder:text-gray-400" style={inputStyle} />
                    </div>
                </div>
            </div>

            <AssignPosTable
                requests={paginated}
                loading={loading}
                empty={filteredRequests.length === 0}
                busyId={busyId}
                darkMode={darkMode}
                teal={teal}
                inputStyle={inputStyle}
                getStatusBadgeStyle={getStatusBadgeStyle}
                onApprove={handleApprove}
                onReject={handleReject}
                onCancel={handleForceCancel}
            />

            {!loading && filteredRequests.length > 0 && (
                <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                    <Pagination currentPage={safePage} totalPages={totalPages} totalItems={filteredRequests.length} onPageChange={setPage} pageSize={PAGE_SIZE} />
                </div>
            )}
        </div>
    );
}

interface AssignPosTableProps {
    requests: OperatorChangeRequest[];
    loading: boolean;
    empty: boolean;
    busyId: number | null;
    darkMode: boolean;
    teal: string;
    inputStyle: React.CSSProperties;
    getStatusBadgeStyle: (status: string) => React.CSSProperties;
    onApprove: (req: OperatorChangeRequest) => void;
    onReject: (req: OperatorChangeRequest) => void;
    onCancel: (req: OperatorChangeRequest) => void;
}

function AssignPosTable({ requests, loading, empty, busyId, teal, getStatusBadgeStyle, onApprove, onReject, onCancel }: AssignPosTableProps) {
    return (
        <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-white/40 bg-gradient-to-r from-[#92C7CF]/10 to-[#AAD7D9]/10">
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Device</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Area / Booth</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">From</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">To</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Loading…</td></tr>
                        ) : empty ? (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No assign-POS requests match the current filter.</td></tr>
                        ) : (
                            requests.map((r) => {
                                const deviceLabel = r.device_no || `POS #${r.pos_record_id}`;
                                const isPending = r.status?.toLowerCase() === "pending";
                                const isDisabled = busyId === r.id;
                                return (
                                    <tr key={r.id} className="border-b border-white/30 transition hover:bg-[#92C7CF]/8">
                                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">
                                            <div className="flex flex-col">
                                                <span style={{ color: teal }}>{deviceLabel}</span>
                                                <span className="text-xs text-gray-500 font-mono">SN: {r.serial_number || "—"}</span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            <div className="flex flex-col">
                                                <span>{r.area || "—"}</span>
                                                <span className="text-xs text-gray-500">{r.current_booth_code || "—"}</span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{r.from_operator || "Unassigned"}</td>
                                        <td className="whitespace-nowrap px-4 py-3 font-medium" style={{ color: teal }}>
                                            {r.to_operator || "—"}
                                            {r.requested_by_name && <span className="block text-xs font-normal text-gray-500">by {r.requested_by_name}</span>}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide" style={getStatusBadgeStyle(r.status)}>{r.status}</span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                            {isPending ? (
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button onClick={() => onApprove(r)} disabled={isDisabled} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "linear-gradient(135deg, #10B981, #34D399)" }}>
                                                        <CheckCircle2 size={13} /> Approve
                                                    </button>
                                                    <button onClick={() => onReject(r)} disabled={isDisabled} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "linear-gradient(135deg, #EF4444, #F87171)" }}>
                                                        <XCircle size={13} /> Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => onCancel(r)} disabled={isDisabled} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-700 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50" style={{ background: "rgba(232,180,184,0.40)", border: "1px solid rgba(232,180,184,0.80)" }}>
                                                    <XCircle size={13} /> Cancel
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
