import { ArrowUpRight } from "lucide-react";

const teal = "#92C7CF";
const tealLight = "#AAD7D9";

const releasedLogs = [
    { id: "REL-001", pos: "POS-D106", summary: "Power supply fixed", date: "2026-05-28", received: "Outlet 3" },
    { id: "REL-002", pos: "POS-E207", summary: "Battery replaced", date: "2026-05-27", received: "Outlet 1" },
    { id: "REL-003", pos: "POS-F308", summary: "Card reader repaired", date: "2026-05-26", received: "Outlet 5" },
];

export default function CsrReleasedLogPage() {
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
                        <ArrowUpRight className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Released Log</h1>
                        <p className="text-sm text-gray-600">POS units released back to operations</p>
                    </div>
                </div>
            </div>

            <div className="relative rounded-3xl border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr
                                className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                                style={{ borderBottom: "1px solid rgba(146,199,207,0.15)" }}
                            >
                                <th className="px-5 py-4">Release ID</th>
                                <th className="px-5 py-4">POS Terminal</th>
                                <th className="px-5 py-4">Repair Summary</th>
                                <th className="px-5 py-4">Released Date</th>
                                <th className="px-5 py-4">Received By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {releasedLogs.map((record, idx, arr) => (
                                <tr
                                    key={record.id}
                                    className="transition-all duration-200 hover:bg-white/10"
                                    style={{
                                        borderBottom: idx < arr.length - 1
                                            ? "1px solid rgba(146,199,207,0.08)"
                                            : "none",
                                    }}
                                >
                                    <td className="px-5 py-3.5 font-medium text-gray-800">{record.id}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{record.pos}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{record.summary}</td>
                                    <td className="px-5 py-3.5 text-gray-500">{record.date}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{record.received}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}