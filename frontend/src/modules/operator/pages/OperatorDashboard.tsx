import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    ArrowRightLeft,
    CheckCircle2,
    Clock,
    Monitor,
    XCircle,
    Ban,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { fetchOperators, fetchPosRecords, fetchBoothInfo } from "../../pos/services";
import type { BoothInfo, OperatorInfo, PosRecord } from "../../pos/types";
import {
    listBoothChangeRequests,
    type BoothChangeRequest,
} from "../../pos/services/boothChangeRequests";
import RequestBoothChangeModal from "../components/RequestBoothChangeModal";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const teal = "#92C7CF";
const tealLight = "#AAD7D9";

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
    operator_name: string | null;
}

export default function OperatorDashboard() {
    const { user } = useAuth();
    const [me, setMe] = useState<Me | null>(null);
    const [records, setRecords] = useState<PosRecord[]>([]);
    const [booths, setBooths] = useState<BoothInfo[]>([]);
    const [requests, setRequests] = useState<BoothChangeRequest[]>([]);
    const [operators, setOperators] = useState<OperatorInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Booth change request modal
    const [requesting, setRequesting] = useState<PosRecord | null>(null);

    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        (async () => {
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
                    }
                    : null;

                const [pos, reqs, ops, bh] = await Promise.all([
                    fetchPosRecords({ user_id: String(user.id) }),
                    listBoothChangeRequests({ userId: user.id }),
                    fetchOperators().catch(() => [] as OperatorInfo[]),
                    fetchBoothInfo().catch(() => [] as BoothInfo[]),
                ]);
                if (!cancelled) {
                    setMe(meSafe);
                    setRecords(pos);
                    setRequests(reqs);
                    setOperators(ops);
                    setBooths(bh);
                }
            } catch (err: any) {
                if (!cancelled) setError(err.message || "Failed to load");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id]);

    // IDs of sub-operators whose parent is the logged-in operator
    const subOperatorIds = useMemo(() => {
        if (!me?.operator_id) return new Set<number>();
        return new Set(
            operators
                .filter((op) => op.parent_operator_id === me.operator_id)
                .map((op) => op.id)
        );
    }, [operators, me?.operator_id]);

    const hasSubs = subOperatorIds.size > 0;

    // Split records into main (directly owned) and sub (owned by sub-operators)
    const mainRecords = useMemo(
        () => (me?.operator_id ? records.filter((r) => r.operator_id === me.operator_id) : []),
        [records, me?.operator_id]
    );

    const subRecords = useMemo(
        () => records.filter((r) => r.operator_id != null && subOperatorIds.has(r.operator_id)),
        [records, subOperatorIds]
    );

    function computeStats(recs: PosRecord[]) {
        const total = recs.length;
        const active = recs.filter((r) => (r.status || "").toLowerCase() === "active").length;
        const inactive = recs.filter((r) => (r.status || "").toLowerCase() === "inactive").length;
        const pending = recs.filter((r) => (r.status || "").toLowerCase() === "pending").length;
        const approved = recs.filter((r) => (r.status || "").toLowerCase() === "approved").length;
        const rejected = recs.filter((r) => (r.status || "").toLowerCase() === "rejected").length;
        const cancelled = recs.filter((r) => (r.status || "").toLowerCase() === "cancelled").length;
        return { total, active, inactive, pending, approved, rejected, cancelled };
    }

    const mainStats = useMemo(() => computeStats(mainRecords), [mainRecords]);
    const subStats = useMemo(() => computeStats(subRecords), [subRecords]);

    const recent = requests.slice(0, 5);

    return (
        <div className="space-y-7">
            {/* Welcome banner */}
            <div className="relative rounded-3xl border border-white/40 bg-white/20 p-6 shadow-lg backdrop-blur-xl">
                <div
                    className="absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-15 blur-3xl pointer-events-none"
                    style={{ background: teal }}
                />
                <div className="relative">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        Welcome back
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-ink">
                        {user?.name || "Operator"}
                    </h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Here's a quick look at your devices and recent requests.
                    </p>
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* ── Main operator device status cards ── */}
            <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-muted">
                    Your Devices
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        label="My Devices"
                        value={loading ? "—" : mainStats.total}
                        icon={Monitor}
                        color={teal}
                    />
                    <StatCard
                        label="Active"
                        value={loading ? "—" : mainStats.active}
                        icon={CheckCircle2}
                        color="#6BBF6B"
                    />
                    <StatCard
                        label="Inactive"
                        value={loading ? "—" : mainStats.inactive}
                        icon={Activity}
                        color="#E8B4B8"
                    />
                </div>

                <div className="mt-2 grid gap-4 sm:grid-cols-4">
                    <StatCard
                        label="Pending"
                        value={loading ? "—" : mainStats.pending}
                        icon={Clock}
                        color="#F2D7B5"
                    />
                    <StatCard
                        label="Approved"
                        value={loading ? "—" : mainStats.approved}
                        icon={CheckCircle2}
                        color={tealLight}
                    />
                    <StatCard
                        label="Rejected"
                        value={loading ? "—" : mainStats.rejected}
                        icon={XCircle}
                        color="#E8B4B8"
                    />
                    <StatCard
                        label="Cancelled"
                        value={loading ? "—" : mainStats.cancelled}
                        icon={Ban}
                        color="#9CA3AF"
                    />
                </div>
            </div>

            {/* ── Sub-operator device status cards (only if subs exist) ── */}
            {hasSubs && (
                <div>
                    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-muted">
                        Sub-Operator Devices
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard
                            label="Sub Devices"
                            value={loading ? "—" : subStats.total}
                            icon={Monitor}
                            color={tealLight}
                        />
                        <StatCard
                            label="Active"
                            value={loading ? "—" : subStats.active}
                            icon={CheckCircle2}
                            color="#6BBF6B"
                        />
                        <StatCard
                            label="Inactive"
                            value={loading ? "—" : subStats.inactive}
                            icon={Activity}
                            color="#E8B4B8"
                        />
                    </div>

                    <div className="mt-2 grid gap-4 sm:grid-cols-4">
                        <StatCard
                            label="Pending"
                            value={loading ? "—" : subStats.pending}
                            icon={Clock}
                            color="#F2D7B5"
                        />
                        <StatCard
                            label="Approved"
                            value={loading ? "—" : subStats.approved}
                            icon={CheckCircle2}
                            color={tealLight}
                        />
                        <StatCard
                            label="Rejected"
                            value={loading ? "—" : subStats.rejected}
                            icon={XCircle}
                            color="#E8B4B8"
                        />
                        <StatCard
                            label="Cancelled"
                            value={loading ? "—" : subStats.cancelled}
                            icon={Ban}
                            color="#9CA3AF"
                        />
                    </div>
                </div>
            )}

            {/* Recent requests + CTA */}
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-warm bg-card p-5 shadow-sm lg:col-span-2">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-ink">
                            Recent Booth Change Requests
                        </h2>
                        <Link
                            to="/app/my-pos"
                            className="text-xs font-medium text-teal hover:underline"
                        >
                            View all →
                        </Link>
                    </div>

                    {loading ? (
                        <p className="text-sm text-ink-subtle">Loading...</p>
                    ) : recent.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-warm bg-cream/50 px-3 py-4 text-center text-sm text-ink-subtle">
                            No requests yet.
                        </p>
                    ) : (
                        <ul className="divide-y divide-warm/60">
                            {recent.map((r) => (
                                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-ink">
                                            {r.device_no || `POS #${r.pos_record_id}`}
                                            <span className="text-ink-muted">
                                                {" "}— {r.current_booth_code || "—"} → {r.requested_booth_code || `#${r.requested_booth_id}`}
                                            </span>
                                        </p>
                                        <p className="text-xs text-ink-subtle">
                                            {new Date(r.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <StatusPill status={r.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="rounded-2xl border border-warm bg-card p-5 shadow-sm">
                    <h2 className="text-base font-semibold text-ink">Quick action</h2>
                    <p className="mt-1 text-sm text-ink-muted">
                        Need to move a device to a different booth?
                    </p>
                    <Link
                        to="/app/my-pos"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark"
                    >
                        <ArrowRightLeft size={16} />
                        Go to My POS
                    </Link>
                </div>
            </div>

            <RequestBoothChangeModal
                open={!!requesting}
                posRecord={requesting}
                booths={booths}
                onClose={() => setRequesting(null)}
                onSubmitted={async () => {
                    setRequesting(null);
                    // Re-fetch to update state
                    try {
                        const [pos, reqs] = await Promise.all([
                            fetchPosRecords({ user_id: String(user!.id) }),
                            listBoothChangeRequests({ userId: user!.id }),
                        ]);
                        setRecords(pos);
                        setRequests(reqs);
                    } catch (_) { }
                }}
            />
        </div>
    );
}

function StatCard({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
}) {
    return (
        <div className="rounded-2xl border border-warm bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {label}
                </p>
                <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: `${color}20`, color }}
                >
                    <Icon size={16} />
                </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
        </div>
    );
}

function StatusPill({ status }: { status: BoothChangeRequest["status"] }) {
    const colors: Record<BoothChangeRequest["status"], string> = {
        pending: "bg-peach/40 text-ink",
        approved: "bg-teal-light/60 text-ink",
        rejected: "bg-rose/40 text-ink",
        cancelled: "bg-warm text-ink-muted",
    };
    return (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${colors[status]}`}>
            {status}
        </span>
    );
}