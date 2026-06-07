import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    ArrowRightLeft,
    CheckCircle2,
    Monitor,
    Store,
    History,
    Send,
    ChevronRight,
    RefreshCw,
    UserCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { fetchOperators, fetchPosRecords, fetchBoothInfo } from "../../pos/services";
import type { BoothInfo, OperatorInfo, PosRecord } from "../../pos/types";
import {
    listBoothChangeRequests,
    type BoothChangeRequest,
} from "../../requests/services/boothChangeRequests";
import {
    listOperatorChangeRequests,
    type OperatorChangeRequest,
} from "../../requests/services/operatorChangeRequests";
import {
    listBoothOperatorChangeRequests,
    type BoothOperatorChangeRequest,
} from "../../requests/services/boothOperatorChangeRequests";
import RequestBoothChangeModal from "../components/RequestBoothChangeModal";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const teal = "#92C7CF";
const tealLight = "#AAD7D9";

// Build a fully qualified URL for a stored profile picture path. The DB stores
// the relative `/uploads/...` path; the static handler lives on the same
// backend origin as the API, so we prefix with API_BASE_URL.
function resolveAvatarUrl(p?: string | null) {
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    return `${API_BASE_URL}${p}`;
}

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
    operator_name: string | null;
    profile_picture?: string | null;
}

type SectionId = "devices" | "requests";

const SECTION_HEADERS: Record<SectionId, { title: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
    devices: { title: "Your Devices & Outlets", icon: Monitor },
    requests: { title: "Recent Requests", icon: Send },
};

function SectionHeader({ section }: { section: SectionId }) {
    const { title, icon: Icon } = SECTION_HEADERS[section];
    return (
        <div className="flex items-center gap-2 mb-3">
            <span
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: `${teal}20`, color: teal }}
            >
                <Icon size={14} />
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                {title}
            </h2>
        </div>
    );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={`relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden ${className}`}
        >
            {children}
        </div>
    );
}

export default function OperatorDashboard() {
    const { user } = useAuth();
    const [me, setMe] = useState<Me | null>(null);
    const [records, setRecords] = useState<PosRecord[]>([]);
    const [booths, setBooths] = useState<BoothInfo[]>([]);
    const [requests, setRequests] = useState<BoothChangeRequest[]>([]);
    const [operators, setOperators] = useState<OperatorInfo[]>([]);
    const [posRequests, setPosRequests] = useState<OperatorChangeRequest[]>([]);
    const [outletRequests, setOutletRequests] = useState<BoothOperatorChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Booth change request modal
    const [requesting, setRequesting] = useState<PosRecord | null>(null);

    const fetchAll = async () => {
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
                    operator_name: meData.operator_name ?? null,
                    profile_picture: meData.profile_picture ?? null,
                }
                : null;

            const [pos, reqs, ops, bh, posReqs, outletReqs] = await Promise.all([
                fetchPosRecords({ user_id: String(user.id) }),
                listBoothChangeRequests({ userId: user.id }),
                fetchOperators().catch(() => [] as OperatorInfo[]),
                fetchBoothInfo().catch(() => [] as BoothInfo[]),
                listOperatorChangeRequests({ userId: user.id }).catch(
                    () => [] as OperatorChangeRequest[]
                ),
                listBoothOperatorChangeRequests({ userId: user.id }).catch(
                    () => [] as BoothOperatorChangeRequest[]
                ),
            ]);
            setMe(meSafe);
            setRecords(pos);
            setRequests(reqs);
            setOperators(ops);
            setBooths(bh);
            setPosRequests(posReqs);
            setOutletRequests(outletReqs);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // Resolve the logged-in user's operator profile
    const myOperator = useMemo(() => {
        const myOpId = me?.operator_id != null ? Number(me.operator_id) : null;
        if (myOpId != null) return operators.find((o) => Number(o.id) === myOpId) ?? null;
        const myUserId = user?.id != null ? Number(user.id) : null;
        if (myUserId != null) return operators.find((o) => o.user_id != null && Number(o.user_id) === myUserId) ?? null;
        return null;
    }, [me, operators, user?.id]);

    const isSubOperator = useMemo(() => {
        return myOperator !== null && myOperator.parent_operator_id != null;
    }, [myOperator]);

    // IDs of sub-operators whose parent is the logged-in operator
    const subOperatorIds = useMemo(() => {
        if (!myOperator) return new Set<number>();
        const myId = Number(myOperator.id);
        return new Set(
            operators
                .filter((op) => op.parent_operator_id != null && Number(op.parent_operator_id) === myId)
                .map((op) => Number(op.id))
        );
    }, [operators, myOperator]);

    // Records owned directly by the logged-in operator
    const mainRecords = useMemo(() => {
        if (!myOperator) return [];
        const myOpId = Number(myOperator.id);
        return records.filter((r) => r.operator_id != null && Number(r.operator_id) === myOpId);
    }, [records, myOperator]);

    // Records owned by sub-operators
    const subRecords = useMemo(
        () => records.filter((r) => r.operator_id != null && subOperatorIds.has(Number(r.operator_id))),
        [records, subOperatorIds]
    );

    // Combined records (main + sub) for the "Your Devices" section
    const allRecords = useMemo(() => [...mainRecords, ...subRecords], [mainRecords, subRecords]);

    function computeStats(recs: PosRecord[]) {
        const total = recs.length;
        const active = recs.filter((r) => (r.status || "").toLowerCase() === "active").length;
        const inactive = recs.filter((r) => (r.status || "").toLowerCase() === "inactive").length;
        return { total, active, inactive };
    }

    const combinedStats = useMemo(() => computeStats(allRecords), [allRecords]);

    const operatorBreakdown = useMemo(() => {
        if (!myOperator || isSubOperator) return [];

        const counts = new Map<number, ReturnType<typeof computeStats>>();
        const outletMap = new Map<number, BoothInfo[]>();
        for (const op of [myOperator, ...operators.filter((op) => subOperatorIds.has(Number(op.id)))]) {
            const opId = Number(op.id);
            const opRecords = records.filter((r) => r.operator_id != null && Number(r.operator_id) === opId);
            counts.set(opId, computeStats(opRecords));
            outletMap.set(
                opId,
                booths
                    .filter((b) => b.operator_id != null && Number(b.operator_id) === opId)
                    .sort((a, b) => String(a.booth_code || "").localeCompare(String(b.booth_code || "")))
            );
        }

        return [
            {
                id: Number(myOperator.id),
                name: myOperator.operator || me?.operator_name || "My operator",
                role: "main" as const,
                stats: counts.get(Number(myOperator.id)) ?? { total: 0, active: 0, inactive: 0 },
                outlets: outletMap.get(Number(myOperator.id)) ?? [],
            },
            ...operators
                .filter((op) => subOperatorIds.has(Number(op.id)))
                .map((op) => ({
                    id: Number(op.id),
                    name: op.operator,
                    role: "sub" as const,
                    stats: counts.get(Number(op.id)) ?? { total: 0, active: 0, inactive: 0 },
                    outlets: outletMap.get(Number(op.id)) ?? [],
                })),
        ];
    }, [booths, me?.operator_name, myOperator, isSubOperator, operators, records, subOperatorIds]);

    // Total outlets with area breakdown
    const { totalOutlets, cdoCount, misorCount } = useMemo(() => {
        const ownerIds = new Set<number>();
        if (myOperator) {
            ownerIds.add(Number(myOperator.id));
            for (const subId of subOperatorIds) ownerIds.add(subId);
        }
        const ownedBooths = ownerIds.size > 0
            ? booths.filter((b) => b.operator_id != null && ownerIds.has(Number(b.operator_id)))
            : booths;
        const total = ownedBooths.length;
        let cdo = 0;
        let misor = 0;
        for (const b of ownedBooths) {
            const code = String(b.booth_code || "").trim().toUpperCase();
            if (code.startsWith("MOE-") || code.startsWith("MOW-")) {
                misor++;
            } else if (code.startsWith("CDO-")) {
                cdo++;
            }
        }
        return { totalOutlets: total, cdoCount: cdo, misorCount: misor };
    }, [booths, myOperator, subOperatorIds]);

    const recentBoothRequests = useMemo(() => requests.slice(0, 5), [requests]);
    const recentPosRequests = useMemo(() => posRequests.slice(0, 5), [posRequests]);
    const recentOutletRequests = useMemo(() => outletRequests.slice(0, 5), [outletRequests]);

    const unavailableBoothIds = useMemo(
        () =>
            requests
                .filter((r) => (r.status || "").toLowerCase() === "pending")
                .map((r) => Number(r.requested_booth_id))
                .filter((id) => Number.isFinite(id)),
        [requests]
    );

    // Resolve the user's profile picture URL (prefers the freshest fetch from
    // /api/users/me over the cached auth user).
    const avatarUrl = resolveAvatarUrl(me?.profile_picture ?? user?.profile_picture);
    const displayName = user?.name || "Operator";

    return (
        <div className="w-full max-w-full space-y-6">
            {/* ── Error banner ── */}
            {error && (
                <div className="relative rounded-xl border border-red-200/60 bg-red-50/95 backdrop-blur-xl px-4 py-3 text-sm font-medium text-red-700 shadow-lg flex items-center gap-2">
                    <span>{error}</span>
                </div>
            )}

            {/* ── Welcome banner ── */}
            <GlassCard>
                <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: teal }} />
                <div className="relative px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            {/* Avatar with glow */}
                            <div className="relative shrink-0">
                                <div
                                    className="absolute inset-0 rounded-2xl blur-md opacity-40"
                                    style={{
                                        background: `linear-gradient(135deg, ${teal}, ${tealLight})`,
                                    }}
                                />
                                {avatarUrl ? (
                                    <div
                                        className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-lg ring-1 ring-white/40"
                                    >
                                        <img
                                            src={avatarUrl}
                                            alt={displayName}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg"
                                        style={{
                                            background: `linear-gradient(135deg, ${teal} 0%, ${tealLight} 100%)`,
                                        }}
                                    >
                                        <UserCircle size={26} />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Welcome back
                                </p>
                                <h1 className="mt-0.5 text-2xl font-bold text-gray-800 truncate">
                                    {displayName}
                                </h1>
                                <p className="mt-0.5 text-sm text-gray-500">
                                    Here's a quick look at your devices and recent requests.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={fetchAll}
                            disabled={loading}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 bg-white/50 text-gray-500 shadow-sm transition hover:bg-white/80 disabled:opacity-50 shrink-0"
                            aria-label="Refresh"
                        >
                            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>
            </GlassCard>

            {/* ── Devices & Outlets section ── */}
            <div>
                <SectionHeader section="devices" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <DeviceStatCard
                        label="Total Devices"
                        value={loading ? "—" : combinedStats.total}
                        icon={Monitor}
                        color={teal}
                        subtitle={myOperator?.operator || ""}
                    />
                    <DeviceStatCard
                        label="Active"
                        value={loading ? "—" : combinedStats.active}
                        icon={CheckCircle2}
                        color="#6BBF6B"
                        subtitle="Operational"
                    />
                    <DeviceStatCard
                        label="Inactive"
                        value={loading ? "—" : combinedStats.inactive}
                        icon={Activity}
                        color="#E8B4B8"
                        subtitle="Needs attention"
                    />
                    <DeviceStatCard
                        label="Total Outlets"
                        value={loading ? "—" : totalOutlets}
                        icon={Store}
                        color={teal}
                        subtitle={
                            loading
                                ? ""
                                : `${cdoCount} CDO  ·  ${misorCount} MISOR`
                        }
                    />
                </div>

                {!loading && operatorBreakdown.length > 1 && (
                    <GlassCard className="mt-4">
                        <div className="border-b border-white/40 bg-gradient-to-r from-[#92C7CF]/10 to-[#AAD7D9]/10 px-5 py-3">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                    <UserCircle size={15} />
                                    Devices & outlets by operator
                                </h3>
                                <span className="text-xs font-medium text-gray-500">
                                    you + {operatorBreakdown.length - 1} sub{operatorBreakdown.length === 2 ? "" : "s"}
                                </span>
                            </div>
                        </div>
                        <div className={`overflow-x-auto ${operatorBreakdown.length > 10 ? "max-h-[520px] overflow-y-auto" : ""}`}>
                            <table className="w-full text-left text-sm">
                                <thead className={operatorBreakdown.length > 10 ? "sticky top-0 z-10" : ""}>
                                    <tr className="border-b border-white/50 bg-white">
                                        <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                            Operator
                                        </th>
                                        <th className="min-w-[220px] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                            Outlets
                                        </th>
                                        <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                                            Total Outlets
                                        </th>
                                        <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                                            Devices
                                        </th>
                                        <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                                            Active
                                        </th>
                                        <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                                            Inactive
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {operatorBreakdown.map((row) => (
                                        <tr key={row.id} className="border-b border-white/40 last:border-0">
                                            <td className="px-5 py-3">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span className="truncate font-medium text-gray-800">{row.name}</span>
                                                    <span
                                                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                                        style={{
                                                            background: row.role === "main" ? "rgba(255,255,255,0.65)" : `${teal}25`,
                                                            color: row.role === "main" ? "#6B7280" : teal,
                                                        }}
                                                    >
                                                        {row.role}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                {row.outlets.length === 0 ? (
                                                    <span className="text-xs text-gray-400">No outlets assigned</span>
                                                ) : (
                                                    <div className="flex max-w-xl flex-wrap gap-1.5">
                                                        {row.outlets.slice(0, 5).map((outlet) => (
                                                            <span
                                                                key={outlet.id}
                                                                className="inline-flex max-w-[150px] items-center rounded-full bg-white/55 px-2 py-1 font-mono text-[11px] font-medium text-gray-700 ring-1 ring-white/60"
                                                                title={[outlet.booth_code, outlet.booth_location].filter(Boolean).join(" - ")}
                                                            >
                                                                <span className="truncate">{outlet.booth_code || `Booth #${outlet.id}`}</span>
                                                            </span>
                                                        ))}
                                                        {row.outlets.length > 5 && (
                                                            <span className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold text-gray-500 ring-1 ring-white/60">
                                                                +{row.outlets.length - 5} more
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-right font-semibold text-gray-800">{row.outlets.length}</td>
                                            <td className="px-5 py-3 text-right font-semibold text-gray-800">{row.stats.total}</td>
                                            <td className="px-5 py-3 text-right text-gray-600">{row.stats.active}</td>
                                            <td className="px-5 py-3 text-right text-gray-600">{row.stats.inactive}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </GlassCard>
                )}
            </div>

            {/* ── Recent Requests section — only rendered when at least one card is visible ── */}
            {!loading && (
                <div>
                    <SectionHeader section="requests" />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {/* Request POS History — hidden for sub-operators */}
                        {!isSubOperator && (
                            <GlassCard>
                                <div className="border-b border-white/40 bg-gradient-to-r from-[#92C7CF]/10 to-[#AAD7D9]/10 px-5 py-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                            <Send size={15} />
                                            Request POS History
                                        </h3>
                                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                                            {posRequests.length}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4">
                                    {recentPosRequests.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-[#92C7CF]/20 bg-white/30 px-4 py-6 text-center">
                                            <Send size={28} className="mx-auto text-gray-300 mb-2" />
                                            <p className="text-sm text-gray-500">No POS requests yet.</p>
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-gray-100">
                                            {recentPosRequests.map((r) => (
                                                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm font-semibold text-gray-800 truncate">
                                                                {r.device_no || `POS #${r.pos_record_id}`}
                                                            </span>
                                                            <RequestStatusPill status={r.status} size="sm" />
                                                        </div>
                                                        <p className="mt-0.5 text-xs text-gray-500 truncate">
                                                            {r.from_operator || "Unassigned"}
                                                            <span className="mx-1 text-gray-300">→</span>
                                                            <span style={{ color: teal }} className="font-medium">
                                                                {r.to_operator || "—"}
                                                            </span>
                                                        </p>
                                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                                                        </p>
                                                    </div>
                                                </li>
                                            ))}
                                            <li className="pt-2">
                                                <Link
                                                    to="/app/my-pos"
                                                    className="group inline-flex items-center gap-1 text-xs font-medium transition"
                                                    style={{ color: teal }}
                                                >
                                                    View all
                                                    <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                                                </Link>
                                            </li>
                                        </ul>
                                    )}
                                </div>
                            </GlassCard>
                        )}

                        {/* Request Outlet History — hidden for sub-operators */}
                        {!isSubOperator && (
                            <GlassCard>
                                <div className="border-b border-white/40 bg-gradient-to-r from-[#92C7CF]/10 to-[#AAD7D9]/10 px-5 py-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                            <History size={15} />
                                            Request Outlet History
                                        </h3>
                                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                                            {outletRequests.length}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4">
                                    {recentOutletRequests.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-[#92C7CF]/20 bg-white/30 px-4 py-6 text-center">
                                            <History size={28} className="mx-auto text-gray-300 mb-2" />
                                            <p className="text-sm text-gray-500">No outlet requests yet.</p>
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-gray-100">
                                            {recentOutletRequests.map((r) => (
                                                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm font-semibold text-gray-800 truncate">
                                                                {r.booth_code || `Booth #${r.booth_info_id}`}
                                                            </span>
                                                            <RequestStatusPill status={r.status} size="sm" />
                                                        </div>
                                                        <p className="mt-0.5 text-xs text-gray-500 truncate">
                                                            {r.current_operator || "Unassigned"}
                                                            <span className="mx-1 text-gray-300">→</span>
                                                            <span style={{ color: teal }} className="font-medium">
                                                                {r.to_operator || "—"}
                                                            </span>
                                                        </p>
                                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                                                        </p>
                                                    </div>
                                                </li>
                                            ))}
                                            <li className="pt-2">
                                                <Link
                                                    to="/app/my-outlets"
                                                    className="group inline-flex items-center gap-1 text-xs font-medium transition"
                                                    style={{ color: teal }}
                                                >
                                                    View all
                                                    <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                                                </Link>
                                            </li>
                                        </ul>
                                    )}
                                </div>
                            </GlassCard>
                        )}

                        {/* Booth Change Requests — always visible */}
                        <GlassCard>
                            <div className="border-b border-white/40 bg-gradient-to-r from-[#92C7CF]/10 to-[#AAD7D9]/10 px-5 py-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                        <ArrowRightLeft size={15} />
                                        Booth Change Requests
                                    </h3>
                                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                                        {requests.length}
                                    </span>
                                </div>
                            </div>
                            <div className="p-4">
                                {recentBoothRequests.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-[#92C7CF]/20 bg-white/30 px-4 py-6 text-center">
                                        <ArrowRightLeft size={28} className="mx-auto text-gray-300 mb-2" />
                                        <p className="text-sm text-gray-500">No booth change requests yet.</p>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-gray-100">
                                        {recentBoothRequests.map((r) => (
                                            <li key={r.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-semibold text-gray-800 truncate">
                                                            {r.device_no || `POS #${r.pos_record_id}`}
                                                        </span>
                                                        <BoothStatusPill status={r.status} />
                                                    </div>
                                                    <p className="mt-0.5 text-xs text-gray-500 truncate">
                                                        <span className="font-mono">{r.old_booth_code || r.current_booth_code || "—"}</span>
                                                        <span className="mx-1 text-gray-300">→</span>
                                                        <span className="font-mono" style={{ color: teal }}>
                                                            {r.requested_booth_code || `#${r.requested_booth_id}`}
                                                        </span>
                                                    </p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                                        {new Date(r.created_at).toLocaleString()}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                        <li className="pt-2">
                                            <Link
                                                to="/app/my-pos"
                                                className="group inline-flex items-center gap-1 text-xs font-medium transition"
                                                style={{ color: teal }}
                                            >
                                                View all
                                                <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                                            </Link>
                                        </li>
                                    </ul>
                                )}
                            </div>
                        </GlassCard>
                    </div>
                </div>
            )}

            {/* ── Quick action — hidden for sub-operators */}
            {!isSubOperator && (
                <GlassCard>
                    <div className="p-5 flex flex-col items-center text-center">
                        <span
                            className="flex h-10 w-10 items-center justify-center rounded-xl mb-3"
                            style={{ background: `${teal}20`, color: teal }}
                        >
                            <ArrowRightLeft size={18} />
                        </span>
                        <h3 className="text-base font-semibold text-gray-800">Quick action</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Need to request a new POS device under your account?
                        </p>
                        <Link
                            to="/app/request-pos?tab=request-pos"
                            className="mt-4 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                            style={{
                                background: `linear-gradient(135deg, ${teal}, ${tealLight})`,
                                boxShadow: `0 2px 8px rgba(146,199,207,0.30)`,
                            }}
                        >
                            <Send size={15} />
                            Assign POS
                        </Link>
                    </div>
                </GlassCard>
            )}

            <RequestBoothChangeModal
                open={!!requesting}
                posRecord={requesting}
                booths={booths}
                operators={operators}
                unavailableBoothIds={unavailableBoothIds}
                onClose={() => setRequesting(null)}
                onSubmitted={async () => {
                    setRequesting(null);
                    try {
                        const [pos, reqs] = await Promise.all([
                            fetchPosRecords({ user_id: String(user!.id) }),
                            listBoothChangeRequests({ userId: user!.id }),
                        ]);
                        setRecords(pos);
                        setRequests(reqs);
                    } catch {
                        setError("Booth change submitted, but refresh failed.");
                    }
                }}
            />
        </div>
    );
}

/* ──────────────────────────────────────────────
 *  Sub-components
 * ────────────────────────────────────────────── */

function DeviceStatCard({
    label,
    value,
    icon: Icon,
    color,
    subtitle,
}: {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    subtitle: string;
}) {
    return (
        <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(135deg, ${color}08, ${color}04)` }} />
            <div className="relative p-5">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {label}
                    </p>
                    <span
                        className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                        style={{ background: `${color}20`, color }}
                    >
                        <Icon size={17} />
                    </span>
                </div>
                <p className="mt-2 text-3xl font-bold text-gray-800">{value}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}40, ${color}10)` }} />
        </div>
    );
}

function BoothStatusPill({ status }: { status: BoothChangeRequest["status"] }) {
    const colors: Record<BoothChangeRequest["status"], string> = {
        pending: "bg-amber-100 text-amber-700",
        approved: "bg-green-100 text-green-700",
        rejected: "bg-red-100 text-red-700",
        cancelled: "bg-gray-100 text-gray-500",
    };
    return (
        <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[status]}`}>
            {status}
        </span>
    );
}

function RequestStatusPill({ status, size = "md" }: { status: string | null | undefined; size?: "sm" | "md" }) {
    const colorMap: Record<string, string> = {
        pending: "bg-amber-100 text-amber-700",
        approved: "bg-green-100 text-green-700",
        rejected: "bg-red-100 text-red-700",
        cancelled: "bg-gray-100 text-gray-500",
    };
    const normalized = (status || "").toLowerCase();
    const cls = colorMap[normalized] || "bg-gray-100 text-gray-500";
    const sizeCls = size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";
    return (
        <span className={`inline-block shrink-0 rounded-full font-semibold uppercase tracking-wide ${sizeCls} ${cls}`}>
            {status}
        </span>
    );
}
