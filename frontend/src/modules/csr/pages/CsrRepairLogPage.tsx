import { FileText } from "lucide-react";

const teal = "#92C7CF";
const tealLight = "#AAD7D9";

const repairLogs = [
    { id: "RL-001", pos: "POS-A102", details: "Screen replaced", date: "2026-05-28", tech: "Tech 1" },
    { id: "RL-002", pos: "POS-B204", details: "Printer cleaned", date: "2026-05-27", tech: "Tech 2" },
    { id: "RL-003", pos: "POS-C305", details: "Software updated", date: "2026-05-26", tech: "Tech 1" },
];

export default function CsrRepairLogPage() {
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
                                <th className="px-5 py-4">Log ID</th>
                                <th className="px-5 py-4">POS Terminal</th>
                                <th className="px-5 py-4">Repair Details</th>
                                <th className="px-5 py-4">Date Completed</th>
                                <th className="px-5 py-4">Technician</th>
                            </tr>
                        </thead>
                        <tbody>
                            {repairLogs.map((record, idx, arr) => (
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
                                    <td className="px-5 py-3.5 text-gray-700">{record.details}</td>
                                    <td className="px-5 py-3.5 text-gray-500">{record.date}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{record.tech}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}