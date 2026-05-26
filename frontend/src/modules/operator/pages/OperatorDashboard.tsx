import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    ArrowRightLeft,
    CheckCircle2,
    Clock,
    Monitor,
    XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { fetchPosRecords } from "../../pos/services";
import type { PosRecord } from "../../pos/types";
import {
    listBoothChangeRequests,
    type BoothChangeRequest,
} from "../../pos/services/boothChangeRequests";

const teal = "#92C7CF";
const tealLight = "#AAD7D9";

export default function OperatorDashboard() {
    const { user } = useAuth();
    const [records, setRecords] = useState<PosRecord[]>([]);
    const [requests, setRequests] = useState<BoothChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError("");
                const [pos, reqs] = await Promise.all([
                    fetchPosRecords({ user_id: String(user.id) }),
                    listBoothChangeRequests({ userId: user.id }),
                ]);
                if (!cancelled) {
                    setRecords(pos);
                    setRequests(reqs);
                }
            } catch (err: any) {
                if (!cancelled) setError(err.message || "Failed to load");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id]);

    const stats = useMemo(() => {
        const total = records.length;
        const active = records.filter((r) => (r.status || "").toLowerCase() === "active").length;
        const inactive = total - active;
        return { total, active, inactive };
    }, [records]);

    const requestStats = useMemo(() => {
        const c = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
        for (const r of requests) c[r.status]++;
        return c;
    }, [requests]);

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

            {/* My POS stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="My Devices"
                    value={loading ? "—" : stats.total}
                    icon={Monitor}
                    color={teal}
                />
                <StatCard
                    label="Active"
                    value={loading ? "—" : stats.active}
                    icon={CheckCircle2}
                    color="#6BBF6B"
                />
                <StatCard
                    label="Inactive"
                    value={loading ? "—" : stats.inactive}
                    icon={Activity}
                    color="#E8B4B8"
                />
            </div>

            {/* My request stats */}
            <div className="grid gap-4 sm:grid-cols-4">
                <StatCard
                    label="Pending"
                    value={loading ? "—" : requestStats.pending}
                    icon={Clock}
                    color="#F2D7B5"
                />
                <StatCard
                    label="Approved"
                    value={loading ? "—" : requestStats.approved}
                    icon={CheckCircle2}
                    color={tealLight}
                />
                <StatCard
                    label="Rejected"
                    value={loading ? "—" : requestStats.rejected}
                    icon={XCircle}
                    color="#E8B4B8"
                />
                <StatCard
                    label="Cancelled"
                    value={loading ? "—" : requestStats.cancelled}
                    icon={ArrowRightLeft}
                    color="#9CA3AF"
                />
            </div>

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
