import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, ChevronLeft, ChevronRight, History, Monitor, RefreshCw, Search } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { fetchPosRecords, fetchBoothInfo, fetchOperators } from "../../pos/services";
import type { OperatorInfo, PosRecord, BoothInfo } from "../../pos/types";
import {
    listBoothChangeRequests,
    type BoothChangeRequest,
} from "../../pos/services/boothChangeRequests";
import BoothChangeRequestHistory from "../components/BoothChangeRequestHistory";
import RequestBoothChangeModal from "../components/RequestBoothChangeModal";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const PAGE_SIZE = 10;
const teal = "#92C7CF";
const tealLight = "#AAD7D9";

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
}

export default function MyPosPage() {
    const { user } = useAuth();
    const [me, setMe] = useState<Me | null>(null);
    const [allOperators, setAllOperators] = useState<OperatorInfo[]>([]);
    const [records, setRecords] = useState<PosRecord[]>([]);
    const [booths, setBooths] = useState<BoothInfo[]>([]);
    const [requests, setRequests] = useState<BoothChangeRequest[]>([]);
    const [pendingRequests, setPendingRequests] = useState<BoothChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filterOperatorId, setFilterOperatorId] = useState<number | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);

    const [requesting, setRequesting] = useState<PosRecord | null>(null);

    const handleRefresh = async () => {
        setFilterOperatorId("all");
        setSearchQuery("");
        setPage(1);
        await refresh();
    };

    const refresh = async () => {
        if (!user?.id) return;
        try {
            setLoading(true);
            setError("");
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

            const filterParams: Parameters<typeof fetchPosRecords>[0] = {
                user_id: String(user.id),
            };
            if (
                meSafe &&
                meSafe.parent_operator_id === null &&
                filterOperatorId !== "all" &&
                typeof filterOperatorId === "number"
            ) {
                filterParams.as_operator_id = String(filterOperatorId);
            }

            const [posData, boothData, reqData, pendingReqData, ops] = await Promise.all([
                fetchPosRecords(filterParams),
                fetchBoothInfo(),
                listBoothChangeRequests({ userId: user.id }),
                listBoothChangeRequests({ status: "pending" }),
                fetchOperators().catch(() => [] as OperatorInfo[]),
            ]);
            setRecords(posData);
            setBooths(boothData);
            setRequests(reqData);
            setPendingRequests(pendingReqData);
            setAllOperators(ops);
        } catch (err) {
            setError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, filterOperatorId]);

    const myOperator = useMemo(() => {
        const myOpId = me?.operator_id != null ? Number(me.operator_id) : null;
        if (myOpId != null) return allOperators.find((o) => Number(o.id) === myOpId) ?? null;
        const myUserId = user?.id != null ? Number(user.id) : null;
        if (myUserId != null) return allOperators.find((o) => o.user_id != null && Number(o.user_id) === myUserId) ?? null;
        return null;
    }, [me, allOperators, user?.id]);

    const isMainOperator = myOperator !== null && myOperator.parent_operator_id == null;
    const myDirectSubs = useMemo(() => {
        if (!isMainOperator || !myOperator) return [] as OperatorInfo[];
        const myId = Number(myOperator.id);
        return allOperators.filter((o) => o.parent_operator_id != null && Number(o.parent_operator_id) === myId);
    }, [isMainOperator, myOperator, allOperators]);

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
        return (
            pendingByPosId.get(Number(rec.id)) ||
            (deviceNo ? pendingByPosId.get(Number(deviceNo)) : undefined) ||
            (deviceNo ? pendingByDeviceNo.get(deviceNo) : undefined)
        );
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

    const pageNumbers = useMemo(() => {
        const pages: (number | "...")[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (safePage > 3) pages.push("...");
            const start = Math.max(2, safePage - 1);
            const end = Math.min(totalPages - 1, safePage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (safePage < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    }, [totalPages, safePage]);

    const inputStyle = {
        background: "rgba(255,255,255,0.58)",
        border: "1px solid rgba(146,199,207,0.28)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
        backdropFilter: "blur(8px)",
    };

    return (
        <div className="w-full max-w-full space-y-5">
            {/* Header */}
            <div className="relative rounded-2xl p-5 border border-white/50 backdrop-blur-xl bg-white/30 shadow-lg overflow-hidden">
                <div
                    className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15 blur-3xl pointer-events-none"
                    style={{ background: teal }}
                />
                <div className="relative flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-11 w-11 items-center justify-center rounded-xl shadow-md transition-transform duration-300 hover:scale-110"
                            style={{
                                background: `linear-gradient(135deg, ${teal}20, ${tealLight}20)`,
                                color: teal,
                            }}
                        >
                            <Monitor className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-800">POS Devices</h1>
                            <p className="text-sm text-gray-600">Devices assigned to you. Request a booth change for any of them below.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative">
                            <Search
                                size={14}
                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setPage(1);
                                }}
                                placeholder="Search device no. or SN…"
                                className="h-10 w-44 rounded-xl pl-8 pr-3 text-sm text-gray-800 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#92C7CF]/35 focus:border-[#92C7CF]/60 placeholder:text-gray-400"
                                style={inputStyle}
                            />
                        </div>
                        {/* Sub-operator filter */}
                        {isMainOperator && myDirectSubs.length > 0 && (
                            <select
                                value={filterOperatorId === "all" ? "all" : String(filterOperatorId)}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setFilterOperatorId(v === "all" ? "all" : Number(v));
                                    setSearchQuery("");
                                    setPage(1);
                                }}
                                className="h-10 rounded-xl px-3 text-sm text-gray-800 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#92C7CF]/35 focus:border-[#92C7CF]/60"
                                style={inputStyle}
                            >
                                <option value="all">All devices</option>
                                {myDirectSubs.map((s) => (
                                    <option key={s.id} value={String(s.id)}>
                                        {s.operator}
                                    </option>
                                ))}
                            </select>
                        )}
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="group inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-white/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            style={{
                                border: "1px solid rgba(146,199,207,0.20)",
                                background: "rgba(255,255,255,0.25)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                            }}
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="relative rounded-xl border border-red-200/60 bg-red-50/95 backdrop-blur-xl px-4 py-3 text-sm font-medium text-red-700 shadow-lg flex items-center gap-2">
                    <span>{error}</span>
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
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-gray-100 text-gray-600"
                                                    }`}>
                                                    {rec.status || "—"}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right">
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
                    <div className="flex items-center justify-between border-t border-white/40 px-4 py-3">
                        <p className="text-xs text-gray-500">
                            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, searchedRecords.length)} of {searchedRecords.length}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition hover:bg-white/40 disabled:opacity-30 disabled:pointer-events-none"
                                aria-label="Previous page"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {pageNumbers.map((p, i) =>
                                p === "..." ? (
                                    <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition ${p === safePage
                                            ? "text-white"
                                            : "text-gray-500 hover:bg-white/40"
                                            }`}
                                        style={p === safePage ? {
                                            background: `linear-gradient(135deg, ${teal}, ${tealLight})`,
                                            boxShadow: `0 2px 8px rgba(146,199,207,0.30)`,
                                        } : {}}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition hover:bg-white/40 disabled:opacity-30 disabled:pointer-events-none"
                                aria-label="Next page"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Request History */}
            <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                <div className="border-b border-white/40 px-5 py-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <History size={16} />
                        My Booth Change Requests
                    </h2>
                </div>
                <div className="p-5">
                    <BoothChangeRequestHistory requests={requests} onChanged={refresh} userId={user?.id ?? null} />
                </div>
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
                    await refresh();
                }}
            />
        </div>
    );
}
