import { useEffect, useMemo, useState } from "react";
import { listDiagnosisLogs } from "../services/diagnosisLogs";
import type { DiagnosisLog } from "../services/diagnosisLogs";

const teal = "#92C7CF";
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

interface RepairLogPageProps {
    search?: string;
    onSearchChange?: (value: string) => void;
}

export default function RepairLogPage({ search: searchProp, onSearchChange }: RepairLogPageProps = {}) {
    const [internalSearch, setInternalSearch] = useState("");
    const search = searchProp ?? internalSearch;
    const setSearch = onSearchChange ?? setInternalSearch;

    const [logs, setLogs] = useState<DiagnosisLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const filteredLogs = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return logs;
        return logs.filter(
            (log) =>
                (log.device_no ?? "").toLowerCase().includes(q) ||
                (log.serial_number ?? "").toLowerCase().includes(q)
        );
    }, [logs, search]);

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
        <div className="relative rounded-3xl border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
                {loading ? (
                    <div className="px-5 py-10 text-center text-sm text-gray-500">Loading repair logs…</div>
                ) : error ? (
                    <div className="px-5 py-10 text-center text-sm text-red-500">{error}</div>
                ) : logs.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-gray-500">No repair logs found.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr
                                className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                                style={{ borderBottom: "1px solid rgba(146,199,207,0.15)", background: "rgba(255,253,245,0.7)" }}
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
                            {filteredLogs.map((log, idx, arr) => (
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
                )}
            </div>
        </div>
    );
}