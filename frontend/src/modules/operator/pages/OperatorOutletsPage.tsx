import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pagination, Toast } from "../../../shared/components";
import {
    History,
    Plus,
    RefreshCw,
    Search,
    Send,
    X,
    XCircle,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { fetchBoothInfo, fetchOperators } from "../../pos/services";
import type { BoothInfo, OperatorInfo } from "../../pos/types";
import {
    cancelBoothOperatorChangeRequest,
    createBoothOperatorChangeRequest,
    listBoothOperatorChangeRequests,
    type BoothOperatorChangeRequest,
} from "../../pos/services/boothOperatorChangeRequests";
import ConfirmationModal from "../../pos/components/ConfirmationModal";

const OUTLETS_PER_PAGE = 10;

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const teal = "#92C7CF";
const tealLight = "#AAD7D9";

/**
 * Derive the area from a booth code prefix. Mirrors the logic used in the
 * backend (see booth-change-request.routes.js):
 *   - MOE-/MOW- → MISOR
 *   - CDO-      → CDO
 *   - any other → Unassigned
 */
function deriveArea(boothCode: string | null | undefined): string {
    const code = String(boothCode || "").trim().toUpperCase();
    if (!code) return "Unassigned";
    if (code.startsWith("MOE-") || code.startsWith("MOW-")) return "MISOR";
    if (code.startsWith("CDO-")) return "CDO";
    return "Unassigned";
}

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
}

export default function OperatorOutletsPage() {
    const { user } = useAuth();
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem("theme") === "dark";
    });
    const [me, setMe] = useState<Me | null>(null);
    const [booths, setBooths] = useState<BoothInfo[]>([]);
    const [operators, setOperators] = useState<OperatorInfo[]>([]);
    const [requests, setRequests] = useState<BoothOperatorChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [outletPage, setOutletPage] = useState(1);

    // Add Outlet modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [typedQuery, setTypedQuery] = useState("");
    const [matchedBooth, setMatchedBooth] = useState<BoothInfo | null>(null);
    const [matchedOperator, setMatchedOperator] = useState<OperatorInfo | null>(null);
    const [matchError, setMatchError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Toast state (inline in toolbar)
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<"success" | "error" | "info" | "warning">("success");

    // Floating toast state (top-center) for status change notifications
    const [floatingToastOpen, setFloatingToastOpen] = useState(false);
    const [floatingToastMessage, setFloatingToastMessage] = useState("");
    const [floatingToastType, setFloatingToastType] = useState<"success" | "error" | "info" | "warning">("success");

    // Track previous request statuses to detect approved/rejected changes
    const prevRequestStatusMap = useRef<Map<number, string>>(new Map());
    const isInitialLoad = useRef(true);

    // Observe dark mode changes on <html>
    useEffect(() => {
        const handleThemeChange = () => {
            setDarkMode(localStorage.getItem("theme") === "dark");
        };
        const observer = new MutationObserver(() => {
            setDarkMode(document.documentElement.classList.contains("dark"));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("storage", handleThemeChange);
        return () => {
            observer.disconnect();
            window.removeEventListener("storage", handleThemeChange);
        };
    }, []);

    const myOperator = useMemo(() => {
        const myOpId = me?.operator_id != null ? Number(me.operator_id) : null;
        if (myOpId != null) return operators.find((o) => Number(o.id) === myOpId) ?? null;
        const myUserId = user?.id != null ? Number(user.id) : null;
        if (myUserId != null) return operators.find((o) => o.user_id != null && Number(o.user_id) === myUserId) ?? null;
        return null;
    }, [me, operators, user?.id]);

    const loadData = useCallback(async () => {
        if (!user?.id) return;
        try {
            setLoading(true);
            setError("");

            // Capture previous statuses before fetching new data
            const prevStatuses = new Map(prevRequestStatusMap.current);

            const meRes = await fetch(`${API_BASE_URL}/api/users/me?id=${user.id}`);
            const meData = meRes.ok ? await meRes.json() : null;
            const meSafe: Me | null = meData
                ? {
                    id: meData.id,
                    operator_id: meData.operator_id ?? null,
                    parent_operator_id: meData.parent_operator_id ?? null,
                }
                : null;
            setMe(meSafe);

            const [boothData, ops, reqs] = await Promise.all([
                fetchBoothInfo().catch(() => [] as BoothInfo[]),
                fetchOperators().catch(() => [] as OperatorInfo[]),
                listBoothOperatorChangeRequests({ userId: user.id }).catch(
                    () => [] as BoothOperatorChangeRequest[]
                ),
            ]);
            setBooths(boothData);
            setOperators(ops);
            setRequests(reqs);

            // Detect status changes from approved/rejected perspective
            if (!isInitialLoad.current) {
                for (const req of reqs) {
                    const prevStatus = prevStatuses.get(req.id);
                    const currentStatus = (req.status || "").toLowerCase();
                    if (prevStatus === "pending" && (currentStatus === "approved" || currentStatus === "rejected")) {
                        const boothInfo = req.booth_code || `Booth #${req.booth_info_id}`;
                        if (currentStatus === "approved") {
                            setFloatingToastType("success");
                            setFloatingToastMessage(`Outlet request for ${boothInfo} has been approved.`);
                            setFloatingToastOpen(true);
                        } else {
                            setFloatingToastType("error");
                            setFloatingToastMessage(`Outlet request for ${boothInfo} has been rejected.`);
                            setFloatingToastOpen(true);
                        }
                    }
                }
            }

            // Update the status map for next comparison
            const newStatusMap = new Map<number, string>();
            for (const req of reqs) {
                newStatusMap.set(req.id, (req.status || "").toLowerCase());
            }
            prevRequestStatusMap.current = newStatusMap;
            isInitialLoad.current = false;
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadData]);

    const isMainOperator = myOperator !== null && myOperator.parent_operator_id == null;

    const subOperatorIds = useMemo(() => {
        if (!isMainOperator || !myOperator) return new Set<number>();
        const myId = Number(myOperator.id);
        return new Set(
            operators
                .filter((o) => o.parent_operator_id != null && Number(o.parent_operator_id) === myId)
                .map((o) => Number(o.id))
        );
    }, [isMainOperator, myOperator, operators]);

    const visibleOperatorIds = useMemo(() => {
        if (!myOperator) return new Set<number>();
        const ids = new Set<number>([Number(myOperator.id)]);
        if (isMainOperator) {
            for (const subId of subOperatorIds) ids.add(subId);
        }
        return ids;
    }, [myOperator, isMainOperator, subOperatorIds]);

    const myBooths = useMemo(() => {
        return booths.filter((b) => b.operator_id != null && visibleOperatorIds.has(Number(b.operator_id)));
    }, [booths, visibleOperatorIds]);

    const operatorNameMap = useMemo(() => {
        const map = new Map<number, string>();
        for (const op of operators) {
            map.set(Number(op.id), op.operator);
        }
        return map;
    }, [operators]);

    const filteredBooths = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return myBooths;
        return myBooths.filter(
            (b) =>
                (b.booth_code || "").toLowerCase().includes(q) ||
                (b.booth_location || "").toLowerCase().includes(q) ||
                (b.coordinate || "").toLowerCase().includes(q) ||
                (b.operator || "").toLowerCase().includes(q) ||
                deriveArea(b.booth_code).toLowerCase().includes(q)
        );
    }, [myBooths, searchQuery]);

    const totalOutletPages = Math.ceil(filteredBooths.length / OUTLETS_PER_PAGE);
    const paginatedBooths = useMemo(() => {
        const start = (outletPage - 1) * OUTLETS_PER_PAGE;
        return filteredBooths.slice(start, start + OUTLETS_PER_PAGE);
    }, [filteredBooths, outletPage]);

    // ---- Add Outlet modal logic ----
    const openAddModal = useCallback(() => {
        setTypedQuery("");
        setMatchedBooth(null);
        setMatchedOperator(null);
        setMatchError("");
        setShowConfirm(false);
        setShowAddModal(true);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setOutletPage(1);
    };

    const closeAddModal = () => {
        if (submitting) return;
        setShowAddModal(false);
    };

    const lookupBooth = (raw: string) => {
        const q = raw.trim();
        if (!q) {
            setMatchedBooth(null);
            setMatchedOperator(null);
            setMatchError("");
            return;
        }
        const needle = q.toLowerCase();
        const found = booths.find((b) => {
            const code = String(b.booth_code || "").toLowerCase();
            return code === needle;
        });
        if (!found) {
            setMatchedBooth(null);
            setMatchedOperator(null);
            setMatchError("No outlet found with that booth code.");
            return;
        }
        const op = operators.find((o) => Number(o.id) === Number(found.operator_id));
        setMatchedBooth(found);
        setMatchedOperator(op ?? null);
        setMatchError("");
    };

    const handleLookup = () => lookupBooth(typedQuery);

    const isAlreadyMine =
        matchedBooth &&
        myOperator &&
        matchedBooth.operator_id != null &&
        Number(matchedBooth.operator_id) === Number(myOperator.id);

    const hasPendingForBooth =
        matchedBooth != null &&
        requests.some(
            (r) =>
                r.booth_info_id === matchedBooth.id &&
                r.status.toLowerCase() === "pending"
        );

    const handleSubmit = async () => {
        if (!matchedBooth || !user?.id) return;
        setSubmitting(true);
        try {
            await createBoothOperatorChangeRequest({
                user_id: user.id,
                booth_id: matchedBooth.id,
            });
            setShowConfirm(false);
            setShowAddModal(false);
            setToastType("success");
            setToastMessage(
                "Request submitted. The admin will review your request shortly."
            );
            setToastOpen(true);
            setTypedQuery("");
            setMatchedBooth(null);
            setMatchedOperator(null);
            setMatchError("");
            await loadData();
        } catch (e) {
            setShowConfirm(false);
            setToastType("error");
            setToastMessage(
                e instanceof Error ? e.message : "Failed to submit request"
            );
            setToastOpen(true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelRequest = async (id: number) => {
        if (!user?.id) return;
        try {
            await cancelBoothOperatorChangeRequest(id, user.id);
            setToastType("info");
            setToastMessage("Request cancelled.");
            setToastOpen(true);
            await loadData();
        } catch (e) {
            setToastType("error");
            setToastMessage(
                e instanceof Error ? e.message : "Failed to cancel request"
            );
            setToastOpen(true);
        }
    };

    const inputStyle = {
        background: darkMode ? "rgba(31,41,55,0.80)" : "rgba(255,255,255,0.78)",
        border: darkMode ? "1px solid rgba(75,85,99,0.55)" : "1px solid rgba(146,199,207,0.30)",
        color: darkMode ? "#F3F4F6" : "#1F2937",
        boxShadow: darkMode ? "none" : "inset 0 1px 0 rgba(255,255,255,0.55)",
        backdropFilter: "blur(8px)",
    };

    const getStatusBadgeStyle = (status: string): React.CSSProperties => {
        const normalized = status.toLowerCase();
        if (normalized === "pending") {
            return darkMode
                ? { backgroundColor: "rgba(146,64,14,0.60)", color: "#FDE68A" }
                : { backgroundColor: "#FEF3C7", color: "#B45309" };
        }
        if (normalized === "approved") {
            return darkMode
                ? { backgroundColor: "rgba(22,101,52,0.60)", color: "#BBF7D0" }
                : { backgroundColor: "#DCFCE7", color: "#15803D" };
        }
        if (normalized === "rejected") {
            return darkMode
                ? { backgroundColor: "rgba(153,27,27,0.60)", color: "#FECACA" }
                : { backgroundColor: "#FEE2E2", color: "#B91C1C" };
        }
        return darkMode
            ? { backgroundColor: "rgba(55,65,81,0.80)", color: "#D1D5DB" }
            : { backgroundColor: "#F3F4F6", color: "#4B5563" };
    };

    return (
        <div className="w-full max-w-full space-y-5">
            {error && (
                <div className="relative rounded-xl border border-red-200/60 bg-red-50/95 backdrop-blur-xl px-4 py-3 text-sm font-medium text-red-700 shadow-lg flex items-center gap-2">
                    <span>{error}</span>
                </div>
            )}

            {/* Floating toast (top-center) for status change notifications */}
            <Toast open={floatingToastOpen} message={floatingToastMessage} type={floatingToastType} onClose={() => setFloatingToastOpen(false)} position="top-center" />

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2">
                {/* Toast */}
                <div className="flex items-center">
                    <Toast open={toastOpen} message={toastMessage} type={toastType} onClose={() => setToastOpen(false)} position="top-left" />
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                        <input
                            value={searchQuery}
                            onChange={handleSearchChange}
                            placeholder="Search booth code..."
                            className="h-9 w-52 rounded-lg py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-400 shadow-sm focus:border-[#92C7CF] dark:focus:border-teal focus:outline-none focus:ring-1 focus:ring-[#92C7CF] dark:focus:ring-teal/50 transition"
                            style={inputStyle}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={openAddModal}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#92C7CF]/50"
                        style={{ background: "linear-gradient(135deg, #92C7CF, #AAD7D9)" }}
                    >
                        <Plus size={15} />
                        Add Outlet
                    </button>
                    <button
                        type="button"
                        onClick={() => loadData()}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#92C7CF]/50"
                        aria-label="Refresh"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Outlets table */}
            <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/40 bg-gradient-to-r from-[#92C7CF]/10 to-[#AAD7D9]/10">
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Operator</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Booth Code</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Area</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Coordinate</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">Loading...</td>
                                </tr>
                            ) : filteredBooths.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">No outlets assigned to you.</td>
                                </tr>
                            ) : (
                                paginatedBooths.map((booth) => {
                                    const opName = booth.operator || operatorNameMap.get(Number(booth.operator_id)) || "\u2014";
                                    const area = deriveArea(booth.booth_code);
                                    return (
                                        <tr key={booth.id} className="border-b border-white/30 transition hover:bg-[#92C7CF]/8">
                                            <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{opName}</td>
                                            <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-medium" style={{ color: teal }}>{booth.booth_code}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-700">{area}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-500">{booth.coordinate || "\u2014"}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-700">{booth.booth_location || "\u2014"}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {totalOutletPages > 1 && (
                    <Pagination
                        currentPage={outletPage}
                        totalPages={totalOutletPages}
                        totalItems={filteredBooths.length}
                        onPageChange={setOutletPage}
                        pageSize={OUTLETS_PER_PAGE}
                    />
                )}
            </div>

            {/* My Request Outlet History (below the outlets table) */}
            <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                <div className="flex items-center gap-2 border-b border-white/40 px-5 py-3">
                    <History size={16} />
                    <h2 className="text-sm font-semibold text-gray-800">
                        Request Outlet History
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/40 bg-gradient-to-r from-[#92C7CF]/10 to-[#AAD7D9]/10">
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Booth</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Area</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">From</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">To</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">No request outlet history yet.</td>
                                </tr>
                            ) : requests.map((r) => (
                                <tr key={r.id} className="border-b border-white/30 transition hover:bg-[#92C7CF]/8">
                                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">
                                        <div className="flex flex-col">
                                            <span className="font-mono" style={{ color: teal }}>{r.booth_code || `Booth #${r.booth_info_id}`}</span>
                                            <span className="text-xs text-gray-500">{r.booth_location || "\u2014"}</span>
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{deriveArea(r.booth_code)}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{r.current_operator || "Unassigned"}</td>
                                    <td className="whitespace-nowrap px-4 py-3 font-medium" style={{ color: teal }}>{r.to_operator || "\u2014"}</td>
                                    <td className="whitespace-nowrap px-4 py-3">
                                        <span
                                            className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
                                            style={getStatusBadgeStyle(r.status)}
                                        >
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleString() : "\u2014"}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right">
                                        {r.status === "pending" ? (
                                            <button
                                                onClick={() => handleCancelRequest(r.id)}
                                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-700"
                                                style={{ background: "rgba(232,180,184,0.40)", border: "1px solid rgba(232,180,184,0.80)" }}
                                            >
                                                <XCircle size={13} /> Cancel
                                            </button>
                                        ) : (
                                            <span className="text-xs text-gray-400">\u2014</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmationModal
                open={showConfirm && !!matchedBooth}
                title="Confirm Outlet Request"
                message="Are you sure you want to request this outlet to be re-assigned under you?"
                confirmLabel="Submit Request"
                cancelLabel="Cancel"
                isLoading={submitting}
                loadingLabel="Submitting..."
                onCancel={() => {
                    if (submitting) return;
                    setShowConfirm(false);
                }}
                onConfirm={handleSubmit}
            >
                {matchedBooth && (
                    <>
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Booth</span>
                            <span className="text-sm font-semibold font-mono" style={{ color: teal }}>
                                {matchedBooth.booth_code} <span className="ml-1 text-xs font-mono font-normal text-ink-muted">({matchedBooth.booth_location || "\u2014"})</span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">From</span>
                            <span className="text-sm font-semibold">{matchedOperator?.operator || "Unassigned"}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">To</span>
                            <span className="text-sm font-semibold" style={{ color: teal }}>{myOperator?.operator || "\u2014"}</span>
                        </div>
                    </>
                )}
            </ConfirmationModal>

            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeAddModal}>
                    <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl p-6 space-y-4 ${darkMode ? "bg-gray-800/95 border-gray-700" : "bg-white/95"}`} onClick={(e) => e.stopPropagation()}>
                        <button onClick={closeAddModal} className={`absolute top-4 right-4 ${darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}><X size={18} /></button>
                        <h2 className={`text-base font-bold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>Add Outlet</h2>
                        <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>Search by booth code to request operator change.</p>
                        <div className="flex gap-2">
                            <input type="text" value={typedQuery} onChange={(e) => { setTypedQuery(e.target.value); setMatchedBooth(null); setMatchedOperator(null); setMatchError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLookup(); } }} placeholder="Type a booth code..." className="h-10 flex-1 rounded-xl px-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#92C7CF]/35" style={inputStyle} />
                            <button onClick={handleLookup} disabled={!typedQuery.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${teal}, ${tealLight})` }}><Search size={14} /> Look up</button>
                        </div>
                        {matchError && <div className="rounded-xl border border-red-200/60 bg-red-50/95 px-4 py-2.5 text-sm font-medium text-red-700">{matchError}</div>}
                        {matchedBooth && !matchError && (
                            <div className={`rounded-xl border p-4 space-y-2 ${darkMode ? "border-gray-700 bg-gray-800/50" : "border-white/40 bg-white/40"}`}>
                                <p className={`text-sm ${darkMode ? "text-gray-200" : "text-gray-700"}`}><span className="font-semibold">Booth:</span> <span style={{ color: teal }} className="font-mono">{matchedBooth.booth_code}</span></p>
                                <p className={`text-sm ${darkMode ? "text-gray-200" : "text-gray-700"}`}><span className="font-semibold">Current operator:</span> <span style={{ color: teal }}>{matchedOperator?.operator || "Unassigned"}</span></p>
                                {isAlreadyMine ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">Already under you.</p> : hasPendingForBooth ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">Pending request exists.</p> : <button onClick={() => setShowConfirm(true)} disabled={submitting} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${teal}, ${tealLight})` }}><Send size={14} /> Request</button>}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}