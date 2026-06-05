import { useEffect, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { listDiagnosisLogs } from "../services/diagnosisLogs";
import type { DiagnosisLog } from "../services/diagnosisLogs";
import { Pagination } from "../../../shared/components";

const teal = "#92C7CF";
const tealLight = "#AAD7D9";
const tealLink = "#2A7A8C";

function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

export default function CsrRepairLogPage() {
    const [logs, setLogs] = useState<DiagnosisLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const filteredLogs = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return logs;
        return logs.filter(
            (log) =>
                (log.device_no ?? "").toLowerCase().includes(q) ||
                (log.serial_number ?? "").toLowerCase().includes(q)
        );
    }, [logs, search]);

    useEffect(() => { setPage(1); }, [search]);

    const totalPages = Math.ceil(filteredLogs.length / pageSize);
    const pagedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await listDiagnosisLogs();
                if (!cancelled) setLogs(data);
            } catch (err: unknown) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load repair logs");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="space-y-6">
            <div className="relative rounded-3xl p-6 border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg overflow-hidden">
                <div
                    className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15 blur-3xl pointer-events-none"
                    style={{ background: teal }}
                />
                <div className="relative flex items-center gap-4">
                    <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl shadow-md"
                        style={{
                            background: `linear-gradient(135deg, ${teal}20, ${tealLight}20)`,
                            color: teal,
                        }}
                    >
                        <FileText className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Repair Log</h1>
                        <p className="text-sm text-gray-600">History of completed repair activities</p>
                    </div>
                    <div className="ml-auto flex items-center">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search POS / Serial Number…"
                                className="pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200/60 dark:border-gray-700 bg-white/40 dark:bg-gray-800/70 backdrop-blur-sm text-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-300/50 dark:focus:ring-teal/50 focus:border-teal-300 dark:focus:border-teal w-64"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative rounded-3xl border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="px-5 py-10 text-center text-sm text-gray-500">Loading repair logs…</div>
                    ) : error ? (
                        <div className="px-5 py-10 text-center text-sm text-red-500">{error}</div>
                    ) : logs.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-gray-500">No repair logs found.</div>
                    ) : (
                        <>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr
                                        className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                                        style={{ borderBottom: "1px solid rgba(146,199,207,0.15)" }}
                                    >
                                        <th className="px-5 py-4">Requested At</th>
                                        <th className="px-5 py-4">POS / Serial Number</th>
                                        <th className="px-5 py-4">Requested By</th>
                                        <th className="px-5 py-4">Forwarded At</th>
                                        <th className="px-5 py-4">Technician</th>
                                        <th className="px-5 py-4">Returned At</th>
                                        <th className="px-5 py-4">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedLogs.map((log, idx, arr) => (
                                        <tr
                                            key={log.id}
                                            className="transition-all duration-200 hover:bg-white/10"
                                            style={{
                                                borderBottom: idx < arr.length - 1
                                                    ? "1px solid rgba(146,199,207,0.08)"
                                                    : "none",
                                            }}
                                        >
                                            <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">
                                                {formatDate(log.requested_at)}
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                {log.device_no || log.serial_number ? (
                                                    <span>
                                                        <span className="text-gray-600">POS: </span>
                                                        <span style={{ color: tealLink }}>{log.device_no || "—"}</span>
                                                        <span className="text-gray-600"> / SN: </span>
                                                        <span style={{ color: tealLink }}>{log.serial_number || "—"}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-700">{log.requested_by || "—"}</td>
                                            <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">
                                                {formatDateTime(log.forwarded_at)}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-700">{log.repaired_by || "-"}</td>
                                            <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">
                                                {formatDateTime(log.returned_at)}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-700">{log.remarks || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                totalItems={filteredLogs.length}
                                onPageChange={setPage}
                                pageSize={pageSize}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}