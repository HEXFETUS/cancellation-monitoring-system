import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, ArrowRightLeft, History, Search, X, CheckCircle2, AlertCircle, Info, UserCog, Map as MapIcon } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { Pagination, Toast } from "../../../shared/components";
import { fetchBoothInfo, fetchOperators } from "../../pos/services";
import { convertCpArea } from "../services/cellphones";
import ConfirmationModal from "../../pos/components/ConfirmationModal";
import EditModal from "../../pos/components/EditModal";
import type { BoothInfo, OperatorInfo } from "../../pos/types";
import {
    listCpBoothChangeRequests,
    type CpBoothChangeRequest,
} from "../../requests/services/cpBoothChangeRequests";
import {
    listCpOperatorChangeRequests,
    type CpOperatorChangeRequest,
} from "../../requests/services/cpOperatorChangeRequests";
import CpBoothChangeRequestModal from "../components/CpBoothChangeRequestModal";
import EditCpModal from "../components/EditCpModal";
import AssignCpToSubOperatorModal from "../components/AssignCpToSubOperatorModal";
import CpBoothChangeRequestHistory from "../components/CpBoothChangeRequestHistory";
import CpOperatorChangeRequestHistory from "../components/CpOperatorChangeRequestHistory";

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

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
}

interface MyCpPageProps {
    searchQuery?: string;
    refreshKey?: number;
}

const PAGE_SIZE = 20;

export default function MyCpPage({ searchQuery: externalSearch = "", refreshKey = 0 }: MyCpPageProps = {}) {
    const { user } = useAuth();
    const [me, setMe] = useState<Me | null>(null);
    const [records, setRecords] = useState<CellphoneRecord[]>([]);
    const [booths, setBooths] = useState<BoothInfo[]>([]);
    const [operators, setOperators] = useState<OperatorInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);

    const [requesting, setRequesting] = useState<CellphoneRecord | null>(null);
    const [viewing, setViewing] = useState<CellphoneRecord | null>(null);
    const [viewMode, setViewMode] = useState<"edit" | "view">("view");
    const [editing, setEditing] = useState<CellphoneRecord | null>(null);
    const [assigningCp, setAssigningCp] = useState<CellphoneRecord | null>(null);

    const [isConvertAreaModalOpen, setIsConvertAreaModalOpen] = useState(false);
    const [convertAreaRecord, setConvertAreaRecord] = useState<CellphoneRecord | null>(null);
    const [newArea, setNewArea] = useState("");
    const [convertAreaError, setConvertAreaError] = useState<string | null>(null);
    const [isConvertAreaConfirmOpen, setIsConvertAreaConfirmOpen] = useState(false);

    const [allRequests, setAllRequests] = useState<CpBoothChangeRequest[]>([]);
    const requests = allRequests;
    const [pendingRequests, setPendingRequests] = useState<CpBoothChangeRequest[]>([]);
    const [pendingOperatorRequests, setPendingOperatorRequests] = useState<CpOperatorChangeRequest[]>([]);
    const [operatorRequests, setOperatorRequests] = useState<CpOperatorChangeRequest[]>([]);
    const [historySearch, setHistorySearch] = useState("");
    const [opHistorySearch, setOpHistorySearch] = useState("");
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<"success" | "error" | "info" | "warning">("success");
    const cpPrevStatusMap = useRef<Record<string, string>>({});
    const isInitialLoad = useRef(true);

    type NoticeType = "success" | "error" | "info";
    interface Notice {
        id: number;
        type: NoticeType;
        message: string;
    }
    const [notice, setNotice] = useState<Notice | null>(null);
    const [darkMode, setDarkMode] = useState(() => {
        return document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
    });

    const showFloatingToast = useCallback((type: "success" | "error" | "info" | "warning", message: string) => {
        setToastType(type);
        setToastMessage(message);
        setToastOpen(true);
    }, []);

    const showNotice = useCallback((type: NoticeType, message: string) => {
        setNotice({ id: Date.now(), type, message });
    }, []);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => {
            setNotice((current) => (current?.id === notice.id ? null : current));
        }, 5000);
        return () => clearTimeout(timer);
    }, [notice]);

    const inputStyle = {
        background: darkMode ? "rgba(31,41,55,0.70)" : "rgba(255,255,255,0.82)",
        border: darkMode ? "1px solid rgba(75,85,99,0.55)" : "1px solid rgba(146,199,207,0.30)",
        color: darkMode ? "#F3F4F6" : "#1F2937",
        boxShadow: darkMode ? "none" : "0 1px 2px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.70)",
    };

    const searchQuery = externalSearch;

    useEffect(() => {
        setPage(1);
    }, [searchQuery]);

    useEffect(() => {
        const sync = () => setDarkMode(document.documentElement.classList.contains("dark"));
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("storage", sync);
        sync();
        return () => {
            observer.disconnect();
            window.removeEventListener("storage", sync);
        };
    }, []);

    useEffect(() => {
        if (refreshKey > 0) refetchAll();
    }, [refreshKey]);

    useEffect(() => {
        if (!user?.id) return;
        fetch(`${API_BASE_URL}/api/users/me?id=${user.id}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                setMe(data ? { id: data.id, operator_id: data.operator_id ?? null, parent_operator_id: data.parent_operator_id ?? null } : null);
            })
            .catch(() => setMe(null));
    }, [user]);

    const refetchAll = useCallback(async () => {
        if (!me?.operator_id || !user?.id) return;
        try {
            setLoading(true);
            setError("");
            const prevStatuses = { ...cpPrevStatusMap.current };

            const [cpData, boothData, ops, reqData, pendingReqData, pendingOpReqData, allOpReqData] = await Promise.all([
                fetch(`${API_BASE_URL}/api/cellphones?operator_id=${me.operator_id}`).then((r) => {
                    if (!r.ok) throw new Error("Failed to fetch cellphones");
                    return r.json();
                }),
                fetchBoothInfo({ user_id: String(user.id) }).catch(() => [] as BoothInfo[]),
                fetchOperators().catch(() => []),
                listCpBoothChangeRequests({ userId: user.id }),
                listCpBoothChangeRequests({ status: "pending" }),
                listCpOperatorChangeRequests({ status: "pending" }),
                listCpOperatorChangeRequests({}),
            ]);

            setRecords(cpData);
            setBooths(boothData);
            setOperators(ops);
            setAllRequests(reqData);
            setPendingRequests(pendingReqData);
            setPendingOperatorRequests(pendingOpReqData);
            setOperatorRequests(allOpReqData);

            if (!isInitialLoad.current) {
                for (const req of reqData) {
                    const prevStatus = String(prevStatuses[req.id] || "");
                    const currentStatus = (req.status || "").toLowerCase();
                    if (prevStatus === "pending" && (currentStatus === "approved" || currentStatus === "rejected")) {
                        const deviceInfo = req.control_no || `CP #${req.cellphone_id}`;
                        if (currentStatus === "approved") {
                            showFloatingToast("success", `Booth change request for ${deviceInfo} has been approved.`);
                        } else {
                            showFloatingToast("error", `Booth change request for ${deviceInfo} has been rejected.`);
                        }
                    }
                }
            }

            const newStatusMap: Record<string, string> = {};
            for (const req of reqData) {
                newStatusMap[req.id] = (req.status || "").toLowerCase();
            }
            cpPrevStatusMap.current = newStatusMap;
            isInitialLoad.current = false;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [me, user?.id, showFloatingToast]);

    const refreshData = refetchAll;

    useEffect(() => {
        if (!me?.operator_id) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        const load = async () => {
            try {
                setLoading(true);
                setError("");

                const [cpData, boothData, ops, reqData, pendingReqData, pendingOpReqData, allOpReqData] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/cellphones?operator_id=${me.operator_id}`).then((r) => {
                        if (!r.ok) throw new Error("Failed to fetch cellphones");
                        return r.json();
                    }),
                    user?.id
                        ? fetchBoothInfo({ user_id: String(user.id) }).catch(() => [] as BoothInfo[])
                        : Promise.resolve([] as BoothInfo[]),
                    fetchOperators().catch(() => []),
                    listCpBoothChangeRequests({ userId: user?.id }).catch(() => [] as CpBoothChangeRequest[]),
                    listCpBoothChangeRequests({ status: "pending" }),
                    listCpOperatorChangeRequests({ status: "pending" }),
                    listCpOperatorChangeRequests({}),
                ]);

                if (!cancelled) {
                    setRecords(cpData);
                    setBooths(boothData);
                    setOperators(ops);
                    setAllRequests(reqData);
                    setPendingRequests(pendingReqData);
                    setPendingOperatorRequests(pendingOpReqData);
                    setOperatorRequests(allOpReqData);
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [me, refreshKey, user?.id]);

    const pendingByCellphoneId = useMemo(() => {
        const map = new Map<string, CpBoothChangeRequest>();
        for (const r of pendingRequests) {
            if ((r.status || "").toLowerCase() === "pending") {
                map.set(String(r.cellphone_id), r);
            }
        }
        return map;
    }, [pendingRequests]);

    const pendingByControlNo = useMemo(() => {
        const map2 = new Map<string, CpBoothChangeRequest>();
        for (const r of pendingRequests) {
            if ((r.status || "").toLowerCase() === "pending" && r.control_no) {
                map2.set(String(r.control_no).trim(), r);
            }
        }
        return map2;
    }, [pendingRequests]);

    const getPendingRequest = (rec: CellphoneRecord | null): CpBoothChangeRequest | undefined => {
        if (!rec) return undefined;
        const byCellphoneId = pendingByCellphoneId.get(String(rec.id));
        if (byCellphoneId) return byCellphoneId;
        if (rec.control_no) {
            const byControlNo = pendingByControlNo.get(String(rec.control_no).trim());
            if (byControlNo) return byControlNo;
        }
        return undefined;
    };

    const getPendingOperatorRequest = (rec: CellphoneRecord | null): CpOperatorChangeRequest | undefined => {
        if (!rec) return undefined;
        return pendingOperatorRequests.find((r) => Number(r.cellphone_id) === Number(rec.id) && (r.status || "").toLowerCase() === "pending");
    };

    const unavailableBoothIds = useMemo(
        () => pendingRequests.map((r) => Number(r.requested_booth_id)).filter((id) => Number.isFinite(id)),
        [pendingRequests]
    );

    const filteredRecords = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return records;
        return records.filter(
            (r) =>
                (r.brand || "").toLowerCase().includes(q) ||
                (r.model || "").toLowerCase().includes(q) ||
                (r.serial_number || "").toLowerCase().includes(q) ||
                (r.control_no || "").toLowerCase().includes(q) ||
                (r.imei1 || "").toLowerCase().includes(q) ||
                (r.imei2 || "").toLowerCase().includes(q)
        );
    }, [records, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginatedRecords = filteredRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
                <div className="relative rounded-xl border border-red-200/60 bg-red-50/95 backdrop-blur-xl px-4 py-3 text-sm font-medium text-red-700 shadow-lg">
                    {error}
                </div>
            )}

            <Toast open={toastOpen} message={toastMessage} type={toastType} onClose={() => setToastOpen(false)} position="top-center" />

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

            <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/40 bg-linear-to-r from-teal/10 to-teal-light/10">
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Control No.</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Brand / Model</th>
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
                            ) : filteredRecords.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                                    {records.length === 0 ? "No CP Device assigned to you." : "No records match your search."}
                                </td></tr>
                            ) : (
                                paginatedRecords.map((rec) => {
                                    const recBoothId = rec.booth_id != null ? Number(rec.booth_id) : null;
                                    const matchedBooth = recBoothId != null ? booths.find(b => Number(b.id) === recBoothId) : null;
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
                                    const opName = (() => {
                                        if (rec.operator_id == null) return "—";
                                        const op = operators.find(o => Number(o.id) === Number(rec.operator_id));
                                        return op?.operator || `#${rec.operator_id}`;
                                    })();
                                    return (
                                        <tr key={rec.id} className="border-b border-white/30 transition hover:bg-teal/8">
                                            <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{rec.control_no}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                                <span className="font-semibold">{rec.brand}</span>
                                                {rec.model && <span className="text-gray-500"> / {rec.model}</span>}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-500">{area}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-500">{boothCode}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-500">{opName}</td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${rec.status === "Active"
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-gray-100 text-gray-500"
                                                        }`}
                                                >
                                                    {rec.status === "Active" ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2 flex-wrap">
                                                    <button
                                                        onClick={() => { setViewing(rec); setViewMode("view"); }}
                                                        title="View Details"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-all duration-200 hover:bg-teal/20 hover:text-teal"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    {me && me.parent_operator_id == null && (
                                                    <button
                                                        onClick={() => {
                                                            setConvertAreaRecord(rec);
                                                            setNewArea("");
                                                            setConvertAreaError(null);
                                                            setIsConvertAreaConfirmOpen(false);
                                                            setIsConvertAreaModalOpen(true);
                                                        }}
                                                        title="Convert Area"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-all duration-200 hover:bg-amber-100 hover:text-amber-600"
                                                    >
                                                        <MapIcon className="h-4 w-4" />
                                                    </button>
                                                    )}
                                                    {(() => {
                                                        const pending = getPendingRequest(rec);
                                                        return (
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
                                                                        : "linear-gradient(135deg, #92C7CF30, #AAD7D920)",
                                                                    border: pending
                                                                        ? "1px solid rgba(242,215,181,0.80)"
                                                                        : "1px solid rgba(146,199,207,0.30)",
                                                                    opacity: pending ? 0.75 : 1,
                                                                }}
                                                            >
                                                                <ArrowRightLeft size={13} />
                                                                {pending ? `Pending: ${pending.requested_booth_code || `#${pending.requested_booth_id}`}` : "Request Booth Change"}
                                                            </button>
                                                        );
                                                    })()}
                                                    {me && me.parent_operator_id == null && (() => {
                                                        const opPending = getPendingOperatorRequest(rec);
                                                        return (
                                                            <button
                                                                onClick={() => {
                                                                    if (!opPending) setAssigningCp(rec);
                                                                }}
                                                                disabled={!!opPending}
                                                                title={opPending ? "This device has a pending operator change request." : undefined}
                                                                className="group inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-700 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
                                                                style={{
                                                                    background: opPending
                                                                        ? "rgba(242,215,181,0.60)"
                                                                        : "linear-gradient(135deg, #92C7CF30, #AAD7D920)",
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
                                                    })()}
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
                    <Pagination
                        currentPage={safePage}
                        totalPages={totalPages}
                        totalItems={filteredRecords.length}
                        onPageChange={setPage}
                        pageSize={PAGE_SIZE}
                    />
                )}
            </div>

            <CpBoothChangeRequestModal
                open={!!requesting}
                cellphone={requesting}
                booths={booths}
                operators={operators}
                unavailableBoothIds={unavailableBoothIds}
                hasPendingRequest={!!getPendingRequest(requesting)}
                onClose={() => setRequesting(null)}
                onSubmitted={async () => {
                    setRequesting(null);
                    if (me?.operator_id) {
                        await refreshData();
                    }
                    showNotice("success", "Booth change request submitted successfully.");
                }}
                onError={(message) => showNotice("error", message)}
            />

            <div className={`grid grid-cols-1 gap-5 ${me && me.parent_operator_id == null ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
                <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-white/40 px-5 py-3">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <History size={16} />
                            CP Booth Change Requests
                        </h2>
                        <div className="relative">
                            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
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
                        <CpBoothChangeRequestHistory
                            requests={requests}
                            search={historySearch}
                            onChanged={refreshData}
                            userId={user?.id ?? null}
                            onCancelled={(r) => showFloatingToast("info", `Booth change request for device ${r.control_no || `#${r.cellphone_id}`} was cancelled.`)}
                            onCancelError={(message) => showFloatingToast("error", message)}
                        />
                    </div>
                </div>

                {me && me.parent_operator_id == null && (
                <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-white/40 px-5 py-3">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <ArrowRightLeft size={16} />
                            CP Sub-Op Assign Requests
                        </h2>
                        <div className="relative">
                            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
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
                        <CpOperatorChangeRequestHistory
                            requests={operatorRequests}
                            search={opHistorySearch}
                            onChanged={refreshData}
                            userId={user?.id ?? null}
                            onCancelled={(r) => showFloatingToast("info", `Operator change request for device ${r.control_no || `#${r.cellphone_id}`} was cancelled.`)}
                            onCancelError={(message) => showFloatingToast("error", message)}
                        />
                    </div>
                </div>
                )}
            </div>

            <EditCpModal
                open={!!viewing || !!editing}
                cellphone={viewing || editing}
                mode={viewMode}
                onClose={() => { setViewing(null); setEditing(null); setViewMode("view"); }}
                onEditClick={() => {
                    if (viewing) {
                        setEditing(viewing);
                        setViewing(null);
                        setViewMode("edit");
                    }
                }}
                onSubmitted={async () => {
                    setViewing(null);
                    setEditing(null);
                    setViewMode("view");
                    if (me?.operator_id) {
                        await refreshData();
                    }
                }}
                isSubOperator={me?.parent_operator_id != null}
            />

            <Toast open={toastOpen} message={toastMessage} type={toastType} onClose={() => setToastOpen(false)} position="top-center" />

            <AssignCpToSubOperatorModal
                open={!!assigningCp}
                cellphone={assigningCp}
                operators={operators}
                currentOperatorId={me?.operator_id ?? null}
                onClose={() => setAssigningCp(null)}
                onSubmitted={async () => {
                    setAssigningCp(null);
                    if (me?.operator_id) {
                        await refreshData();
                    }
                }}
            />

            <EditModal
                open={isConvertAreaModalOpen && convertAreaRecord !== null}
                title="Convert Area"
                subtitle="Update the area assignment for this cellphone"
                onClose={() => {
                    setIsConvertAreaModalOpen(false);
                    setConvertAreaRecord(null);
                    setNewArea("");
                    setConvertAreaError(null);
                    setIsConvertAreaConfirmOpen(false);
                }}
                accentColor="teal"
            >
                {convertAreaRecord && (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Device</label>
                            <input type="text" value={`${convertAreaRecord.brand} ${convertAreaRecord.model}`} disabled className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink/70" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Control No.</label>
                            <input type="text" value={convertAreaRecord.control_no} disabled className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink/70" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                New Area <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={newArea}
                                onChange={(e) => { setNewArea(e.target.value); setConvertAreaError(null); }}
                                className="w-full rounded-xl border bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 transition-all shadow-sm appearance-none cursor-pointer"
                            >
                                <option value="" disabled hidden>-- Select an area --</option>
                                {["CDO", "MISOR"].filter(a => a !== convertAreaRecord.area?.toUpperCase()).map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        </div>
                        {convertAreaError && (
                            <p className="text-xs text-rose-500 flex items-center gap-1">
                                <AlertCircle size={12} />
                                {convertAreaError}
                            </p>
                        )}
                        <div className="flex gap-3 mt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsConvertAreaModalOpen(false);
                                    setConvertAreaRecord(null);
                                    setNewArea("");
                                    setConvertAreaError(null);
                                    setIsConvertAreaConfirmOpen(false);
                                }}
                                className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!newArea) { setConvertAreaError("Please select a new area"); return; }
                                    if (convertAreaRecord.area?.toUpperCase() === newArea) { setConvertAreaError("New area must be different from the current area."); return; }
                                    setConvertAreaError(null);
                                    setIsConvertAreaConfirmOpen(true);
                                }}
                                disabled={!newArea || convertAreaRecord.area?.toUpperCase() === newArea}
                                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: "linear-gradient(to right, #92C7CF, #AAD7D9)", boxShadow: "0 4px 16px rgba(146,199,207,0.25)" }}
                            >
                                Convert Area
                            </button>
                        </div>
                    </div>
                )}
            </EditModal>

            <ConfirmationModal
                open={isConvertAreaConfirmOpen}
                title="Confirm Area Conversion"
                message="Are you sure you want to convert the area of this cellphone? The assigned booth will be removed."
                confirmLabel="Yes, Convert"
                cancelLabel="Cancel"
                isLoading={false}
                onCancel={() => setIsConvertAreaConfirmOpen(false)}
                onConfirm={async () => {
                    if (!convertAreaRecord || !newArea) return;
                    try {
                        const updated = await convertCpArea(convertAreaRecord.id, newArea);
                        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
                        setIsConvertAreaModalOpen(false);
                        setConvertAreaRecord(null);
                        setNewArea("");
                        setConvertAreaError(null);
                        setIsConvertAreaConfirmOpen(false);
                        showFloatingToast("success", `Area for ${updated.control_no} converted to ${newArea} and booth removed.`);
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : "Failed to convert area";
                        setConvertAreaError(msg);
                        setIsConvertAreaConfirmOpen(false);
                    }
                }}
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
