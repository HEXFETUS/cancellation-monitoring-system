import { useEffect, useMemo, useState } from "react";
import { listReleasedLogs } from "../services/releasedLogs";
import type { ReleasedLog } from "../services/releasedLogs";

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

interface ReleasedLogPageProps {
    search?: string;
    onSearchChange?: (value: string) => void;
}

export default function ReleasedLogPage({ search: searchProp, onSearchChange }: ReleasedLogPageProps = {}) {
    const [internalSearch, setInternalSearch] = useState("");
    const search = searchProp ?? internalSearch;
    const setSearch = onSearchChange ?? setInternalSearch;

    const [logs, setLogs] = useState<ReleasedLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const filteredLogs = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return logs;
        return logs.filter(
            (log) =>
                (log.billing_code ?? "").toLowerCase().includes(q)
        );
    }, [logs, search]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await listReleasedLogs();
                if (!cancelled) setLogs(data);
            } catch (err: unknown) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load released logs");
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
                    <div className="px-5 py-10 text-center text-sm text-gray-500">Loading released logs…</div>
                ) : error ? (
                    <div className="px-5 py-10 text-center text-sm text-red-500">{error}</div>
                ) : logs.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-gray-500">No released logs found.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr
                                className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                                style={{ borderBottom: "1px solid rgba(146,199,207,0.15)", background: "rgba(255,253,245,0.7)" }}
                            >
                                <th className="px-5 py-4">Date</th>
                                <th className="px-5 py-4">Billing Code</th>
                                <th className="px-5 py-4">POS</th>
                                <th className="px-5 py-4">Serial</th>
                                <th className="px-5 py-4">Diagnosis</th>
                                <th className="px-5 py-4">Remarks</th>
                                <th className="px-5 py-4">Released By</th>
                                <th className="px-5 py-4">Received By</th>
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
                                        {formatDate(log.release_date)}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span style={{ color: tealLink }}>{log.billing_code || "—"}</span>
                                    </td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.pos || "—"}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.serial_number || "—"}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.diagnosis || "—"}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.remarks || "—"}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.released_by || "—"}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{log.received_by || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}