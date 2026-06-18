import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, History, CheckCircle2, AlertCircle, Info, Search, X, UserCog } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { fetchPosRecords, fetchBoothInfo, fetchOperators } from "../../pos/services";
import type { OperatorInfo, PosRecord, BoothInfo } from "../../pos/types";
import {
    listBoothChangeRequests,
    type BoothChangeRequest,
} from "../../requests/services/boothChangeRequests";
import {
    listOperatorChangeRequests,
    type OperatorChangeRequest,
} from "../../requests/services/operatorChangeRequests";
import { Pagination, Toast } from "../../../shared/components";
import BoothChangeRequestHistory from "../components/BoothChangeRequestHistory";
import RequestBoothChangeModal from "../components/RequestBoothChangeModal";
import AssignSubOperatorModal from "../components/AssignSubOperatorModal";
import OperatorChangeRequestHistory from "../components/OperatorChangeRequestHistory";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const PAGE_SIZE = 10;
const teal = "#92C7CF";
const tealLight = "#AAD7D9";

type NoticeType = "success" | "error" | "info";

interface Notice {
    id: number;
    type: NoticeType;
    message: string;
}

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
}

interface OperatorPosPageProps {
    searchQuery?: string;
    refreshKey?: number;
}

const uniqueById = (items: PosRecord[]) => {
    const map = new Map<number, PosRecord>();
    for (const item of items) {
        map.set(Number(item.id), item);
    }
    return Array.from(map.values());
};

export default function OperatorPosPage({ searchQuery: externalSearch = "", refreshKey = 0 }: OperatorPosPageProps = {}) {
    const { user } = useAuth();
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem("theme") === "dark";
    });
    const [allOperators, setAllOperators] = useState<OperatorInfo[]>([]);
    const [myOperatorId, setMyOperatorId] = useState<number | null>(null);
    const [myParentOperatorId, setMyParentOperatorId] = useState<number | null>(null);
    const [records, setRecords] = useState<PosRecord[]>([]);
    const [booths, setBooths] = useState<BoothInfo[]>([]);
    const [requests, setRequests] = useState<BoothChangeRequest[]>([]);
    const [pendingRequests, setPendingRequests] = useState<BoothChangeRequest[]>([]);
    const [pendingOperatorRequests, setPendingOperatorRequests] = useState<OperatorChangeRequest[]>([]);
    const [operatorRequests, setOperatorRequests] = useState<OperatorChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filterOperatorId, setFilterOperatorId] = useState<number | "all">("all");
    const searchQuery = externalSearch;
    const [page, setPage] = useState(1);

    const [requesting, setRequesting] = useState<PosRecord | null>(null);
    const [assigning, setAssigning] = useState<PosRecord | null>(null);

    // Inline notice (toast shown above the table, on the left side)
    const [notice, setNotice] = useState<Notice | null>(null);

    // Search query for the Booth Change Requests history card.
    const [historySearch, setHistorySearch] = useState("");
    // Search query for the Operator Change Requests history card.
    const [opHistorySearch, setOpHistorySearch] = useState("");

    // Floating toast state (top-center)
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<"success" | "error" | "info" | "warning">("success");

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

    const inputStyle = {
        background: darkMode ? "rgba(31,41,55,0.70)" : "rgba(255,255,255,0.78)",
        border: darkMode ? "1px solid rgba(75,85,99,0.55)" : "1px solid rgba(146,199,207,0.30)",
        color: darkMode ? "#F3F4F6" : "#1F2937",
        boxShadow: darkMode ? "none" : "inset 0 1px 0 rgba(255,255,255,0.70)",
    };

    const showNotice = useCallback((type: NoticeType, message: string) => {
        setNotice({ id: Date.now(), type, message });
    }, []);

    const showFloatingToast = useCallback((type: "success" | "error" | "info" | "warning", message: string) => {
        setToastType(type);
        setToastMessage(message);
        setToastOpen(true);
    }, []);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => {
            setNotice((current) => (current?.id === notice.id ? null : current));
        }, 5000);
        return () => clearTimeout(timer);
    }, [notice]);

    const refreshData = useCallback(async () => {
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
            const [boothData, reqData, pendingReqData, ops, pendingOpReqData, allOpReqData] = await Promise.all([
                fetchBoothInfo(),
                listBoothChangeRequests({ userId: user.id }),
                listBoothChangeRequests({ status: "pending" }),
                fetchOperators().catch(() => [] as OperatorInfo[]),
                listOperatorChangeRequests({ status: "pending" }),
                listOperatorChangeRequests(),
            ]);

            const myOperatorId = meSafe?.operator_id ?? null;
            const isMainOperator = meSafe?.parent_operator_id === null;

            let posData: PosRecord[];
            if (isMainOperator && filterOperatorId !== "all" && typeof filterOperatorId === "number") {
                // Main operator filtering a specific sub-operator
                posData = await fetchPosRecords({ operator_id: String(filterOperatorId) });
            } else {
                // Let the backend resolve the operator hierarchy:
                //   - Main operators get their own records + all sub-operator records
                //   - Sub-operators get their own records + parent operator records + sibling sub-operator records
                posData = await fetchPosRecords({ user_id: String(user.id) });
            }

            setMyOperatorId(meSafe?.operator_id ?? null);
            setMyParentOperatorId(meSafe?.parent_operator_id ?? null);
            setRecords(posData);
            setBooths(boothData);
            setRequests(reqData);
            setPendingRequests(pendingReqData);
            setAllOperators(ops);
            setPendingOperatorRequests(pendingOpReqData);
            setOperatorRequests(allOpReqData);

            // Detect status changes from approved/rejected perspective
            if (!isInitialLoad.current) {
                for (const req of reqData) {
                    const prevStatus = prevStatuses.get(req.id);
                    const currentStatus = (req.status || "").toLowerCase();
                    if (prevStatus === "pending" && (currentStatus === "approved" || currentStatus === "rejected")) {
                        const deviceInfo = req.device_no || `POS #${req.pos_record_id}`;
                        if (currentStatus === "approved") {
                            showFloatingToast("success", `Booth change request for ${deviceInfo} has been approved.`);
                        } else {
                            showFloatingToast("error", `Booth change request for ${deviceInfo} has been rejected.`);
                        }
                    }
                }
            }

            // Update the status map for next comparison
            const newStatusMap = new Map<number, string>();
            for (const req of reqData) {
                newStatusMap.set(req.id, (req.status || "").toLowerCase());
            }
            prevRequestStatusMap.current = newStatusMap;
            isInitialLoad.current = false;
        } catch (err) {
            setError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [user, filterOperatorId, showFloatingToast]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // Re-fetch when refreshKey changes from parent
    useEffect(() => {
        if (refreshKey > 0) {
            setFilterOperatorId("all");
            setPage(1);
            refreshData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey]);

    // Reset page when search query changes
    useEffect(() => {
        setPage(1);
    }, [searchQuery]);

    const pendingByPosId = useMemo(() => {
        const map = new Map<number, BoothChangeRequest>();
        for (const r of pendingRequests) {
            if ((r.status || "").toLowerCase() === "pending") {
                map.set(Number(r.pos_record_id), r);
            }
        }
        return map;
    }, [pendingRequests]);

    const pendingByDeviceNo = useMemo(() => {
        const map = new Map<string, BoothChangeRequest>();
        for (const r of pendingRequests) {
            if ((r.status || "").toLowerCase() === "pending" && r.device_no) {
                map.set(String(r.device_no).trim(), r);
            }
        }
        return map;
    }, [pendingRequests]);

    const getPendingRequest = (rec: PosRecord | null) => {
        if (!rec) return undefined;
        const deviceNo = String(rec.device_no || "").trim();
        const byPosId = pendingByPosId.get(Number(rec.id));
        if (byPosId) return byPosId;
        if (deviceNo) {
            const byDeviceNo = pendingByDeviceNo.get(deviceNo);
            if (byDeviceNo) return byDeviceNo;
        }
        return undefined;
    };

    // Lookup for pending operator change requests (used by "Assign to Sub Op" button)
    const getPendingOperatorRequest = (rec: PosRecord | null): OperatorChangeRequest | undefined => {
        if (!rec) return undefined;
        return pendingOperatorRequests.find((r) => Number(r.pos_record_id) === Number(rec.id) && (r.status || "").toLowerCase() === "pending");
    };

    const unavailableBoothIds = useMemo(
        () => pendingRequests.map((r) => Number(r.requested_booth_id)).filter((id) => Number.isFinite(id)),
        [pendingRequests]
    );

    const searchedRecords = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return records;
        return records.filter(
            (r) =>
                (r.device_no || "").toLowerCase().includes(q) ||
                (r.serial_number || r.serial_no || "").toLowerCase().includes(q)
        );
    }, [records, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(searchedRecords.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginatedRecords = useMemo(
        () => searchedRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
        [searchedRecords, safePage]
    );

    const noticeStyleMap: Record<NoticeType, { wrapper: string; icon: React.ReactNode }> = {
        success: {
            wrapper: "border-green-200 bg-green-50 text-green-700",
            icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
        },
        error: {
            wrapper: "border-red-200 bg-red-50 text-red-700",
            icon: <AlertCircle className="h-4 w-4 text-red-600" />,
        },
        info: {
            wrapper: "border-blue-200 bg-blue-50 text-blue-700",
            icon: <Info className="h-4 w-4 text-blue-600" />,
        },
    };

    return (
        <div className="w-full max-w-full space-y-5">
            {error && (
                <div className="relative rounded-xl border border-red-200/60 bg-red-50/95 backdrop-blur-xl px-4 py-3 text-sm font-medium text-red-700 shadow-lg flex items-center gap-2">
                    <span>{error}</span>
                </div>
            )}

            {/* Floating toast (top-center) */}
            <Toast open={toastOpen} message={toastMessage} type={toastType} onClose={() => setToastOpen(false)} position="top-center" />

            {/* Inline notice (toast) - shown above the table, on the left side */}
            {notice && (
                <div className="flex justify-start">
                    <div
                        role="status"
                        className={`inline-flex max-w-md items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-md backdrop-blur-xl transition-all duration-300 ${noticeStyleMap[notice.type].wrapper}`}
                    >
                        <span className="shrink-0">{noticeStyleMap[notice.type].icon}</span>
                        <span className="flex-1">{notice.message}</span>
                        <button
                            onClick={() => setNotice(null)}
                            className="shrink-0 rounded-full p-0.5 opacity-70 transition hover:bg-black/5 hover:opacity-100"
                            aria-label="Dismiss notice"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Table Card */}
            <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/40 bg-gradient-to-r from-[#92C7CF]/10 to-[#AAD7D9]/10">
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Device No.</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Serial</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Area</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Booth</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Operator</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Loading...</td></tr>
                            ) : searchedRecords.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No devices match your search.</td></tr>
                            ) : records.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No POS devices assigned to you yet.</td></tr>
                            ) : (
                                paginatedRecords.map((rec) => {
                                    const pending = getPendingRequest(rec);
                                    return (
                                        <tr key={rec.id} className="border-b border-white/30 transition hover:bg-[#92C7CF]/8">
                                            <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{rec.device_no}</td>
                                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">{rec.serial_number}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-700">{rec.area || "—"}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-700">{rec.booth_code || "—"}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-500">{rec.operator || "—"}</td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${rec.status === "Active"
                                                    ? "bg-green-100 text-green-700 dark:bg-green-800/60 dark:text-green-200"
                                                    : "bg-gray-100 text-gray-600 dark:bg-gray-700/80 dark:text-gray-300"
                                                    }`}>
                                                    {rec.status || "—"}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (!pending) setRequesting(rec);
                                                        }}
                                                        disabled={!!pending}
                                                        title={pending ? "This device has a pending booth change request." : undefined}
                                                        className="group inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-700 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
                                                        style={{
                                                            background: pending
                                                                ? "rgba(242,215,181,0.60)"
                                                                : `linear-gradient(135deg, ${teal}30, ${tealLight}20)`,
                                                            border: pending
                                                                ? "1px solid rgba(242,215,181,0.80)"
                                                                : "1px solid rgba(146,199,207,0.30)",
                                                            opacity: pending ? 0.75 : 1,
                                                        }}
                                                    >
                                                        <ArrowRightLeft size={13} />
                                                        {pending ? `Pending: ${pending.requested_booth_code || `#${pending.requested_booth_id}`}` : "Request Booth Change"}
                                                    </button>
                                                    {myParentOperatorId == null && (
                                                        (() => {
                                                            const opPending = getPendingOperatorRequest(rec);
                                                            return (
                                                                <button
                                                                    onClick={() => {
                                                                        if (!opPending) setAssigning(rec);
                                                                    }}
                                                                    disabled={!!opPending}
                                                                    title={opPending ? "This device has a pending operator change request." : undefined}
                                                                    className="group inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-700 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
                                                                    style={{
                                                                        background: opPending
                                                                            ? "rgba(242,215,181,0.60)"
                                                                            : `linear-gradient(135deg, ${teal}30, ${tealLight}20)`,
                                                                        border: opPending
                                                                            ? "1px solid rgba(242,215,181,0.80)"
                                                                            : "1px solid rgba(146,199,207,0.30)",
                                                                        opacity: opPending ? 0.75 : 1,
                                                                    }}
                                                                >
                                                                    <UserCog size={13} />
                                                                    {opPending ? `Pending: ${opPending.to_operator || `#${opPending.id}`}` : "Assign to Sub Op"}
                                                                </button>
                                                            );
                                                        })()
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

                {/* Pagination */}
                {!loading && searchedRecords.length > 0 && (
                    <Pagination
                        currentPage={safePage}
                        totalPages={totalPages}
                        totalItems={searchedRecords.length}
                        onPageChange={setPage}
                        pageSize={PAGE_SIZE}
                    />
                )}
            </div>

            {/* Two-column request history layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Booth Change Requests History */}
                <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-white/40 px-5 py-3">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <History size={16} />
                            Booth Change Requests
                        </h2>
                        <div className="relative w-44">
                            <Search
                                size={14}
                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                            />
                            <input
                                type="text"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                placeholder="Search…"
                                className="h-9 w-44 rounded-xl pl-8 pr-3 text-sm outline-none transition-all duration-200 focus:border-[#92C7CF]/60 focus:ring-2 focus:ring-[#92C7CF]/35 placeholder:text-gray-400 dark:placeholder:text-gray-400"
                                style={inputStyle}
                            />
                        </div>
                    </div>
                    <div className="p-5">
                        <BoothChangeRequestHistory
                            requests={requests}
                            search={historySearch}
                            onChanged={refreshData}
                            userId={user?.id ?? null}
                            onCancelled={(r) =>
                                showNotice(
                                    "info",
                                    `Booth change request for device ${r.device_no || `#${r.pos_record_id}`} was cancelled.`
                                )
                            }
                            onCancelError={(message) => showNotice("error", message)}
                        />
                    </div>
                </div>

                {/* Sub-Op Assign Request History */}
                {myParentOperatorId == null && (
                <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-white/40 px-5 py-3">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <UserCog size={16} />
                            Sub-Op Assign Requests
                        </h2>
                        <div className="relative w-44">
                            <Search
                                size={14}
                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                            />
                            <input
                                type="text"
                                value={opHistorySearch}
                                onChange={(e) => setOpHistorySearch(e.target.value)}
                                placeholder="Search…"
                                className="h-9 w-44 rounded-xl pl-8 pr-3 text-sm outline-none transition-all duration-200 focus:border-[#92C7CF]/60 focus:ring-2 focus:ring-[#92C7CF]/35 placeholder:text-gray-400 dark:placeholder:text-gray-400"
                                style={inputStyle}
                            />
                        </div>
                    </div>
                    <div className="p-5">
                        <OperatorChangeRequestHistory
                            requests={operatorRequests}
                            search={opHistorySearch}
                            onChanged={refreshData}
                            userId={user?.id ?? null}
                            onCancelled={(r) =>
                                showNotice(
                                    "info",
                                    `Operator change request for device ${r.device_no || `#${r.pos_record_id}`} was cancelled.`
                                )
                            }
                            onCancelError={(message) => showNotice("error", message)}
                        />
                    </div>
                </div>
                )}
            </div>

            <RequestBoothChangeModal
                open={!!requesting}
                posRecord={requesting}
                booths={booths}
                operators={allOperators}
                unavailableBoothIds={unavailableBoothIds}
                hasPendingRequest={!!getPendingRequest(requesting)}
                onClose={() => setRequesting(null)}
                onSubmitted={async () => {
                    setRequesting(null);
                    await refreshData();
                    showNotice("success", "Booth change request submitted successfully.");
                }}
                onError={(message) => showNotice("error", message)}
            />

            <AssignSubOperatorModal
                open={!!assigning}
                posRecord={assigning}
                operators={allOperators}
                currentOperatorId={myOperatorId}
                onClose={() => setAssigning(null)}
                onSubmitted={async () => {
                    setAssigning(null);
                    await refreshData();
                    showNotice("success", "Sub-operator assignment request submitted successfully.");
                }}
                onError={(message) => showNotice("error", message)}
            />
        </div>
    );
}
