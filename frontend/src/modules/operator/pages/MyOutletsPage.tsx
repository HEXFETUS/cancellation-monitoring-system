import { useEffect, useMemo, useState } from "react";
import { Building2, RefreshCw, Search } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { fetchBoothInfo, fetchOperators } from "../../pos/services";
import type { BoothInfo, OperatorInfo } from "../../pos/types";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const teal = "#92C7CF";
const tealLight = "#AAD7D9";

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
}

export default function MyOutletsPage() {
    const { user } = useAuth();
    const [me, setMe] = useState<Me | null>(null);
    const [booths, setBooths] = useState<BoothInfo[]>([]);
    const [operators, setOperators] = useState<OperatorInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const loadData = async () => {
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

            const [boothData, ops] = await Promise.all([
                fetchBoothInfo().catch(() => [] as BoothInfo[]),
                fetchOperators().catch(() => [] as OperatorInfo[]),
            ]);
            setBooths(boothData);
            setOperators(ops);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const myOperator = useMemo(() => {
        const myOpId = me?.operator_id != null ? Number(me.operator_id) : null;
        if (myOpId != null) return operators.find((o) => Number(o.id) === myOpId) ?? null;
        const myUserId = user?.id != null ? Number(user.id) : null;
        if (myUserId != null) return operators.find((o) => o.user_id != null && Number(o.user_id) === myUserId) ?? null;
        return null;
    }, [me, operators, user?.id]);

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
                (b.operator || "").toLowerCase().includes(q)
        );
    }, [myBooths, searchQuery]);

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
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-800">Outlets</h1>
                            <p className="text-sm text-gray-600">Booths and outlets assigned to you</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search
                                size={14}
                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search outlets…"
                                className="h-10 w-44 rounded-xl pl-8 pr-3 text-sm text-gray-800 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#92C7CF]/35 focus:border-[#92C7CF]/60 placeholder:text-gray-400"
                                style={inputStyle}
                            />
                        </div>
                        <button
                            onClick={loadData}
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
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Operator</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Booth Code</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Coordinate</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">Loading...</td>
                                </tr>
                            ) : filteredBooths.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">No outlets assigned to you.</td>
                                </tr>
                            ) : (
                                filteredBooths.map((booth) => {
                                    const opName = booth.operator || operatorNameMap.get(Number(booth.operator_id)) || "—";
                                    return (
                                        <tr key={booth.id} className="border-b border-white/30 transition hover:bg-[#92C7CF]/8">
                                            <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{opName}</td>
                                            <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-medium" style={{ color: teal }}>{booth.booth_code}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-500">{booth.coordinate || "—"}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-700">{booth.booth_location || "—"}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}