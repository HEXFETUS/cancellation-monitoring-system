import type { RepairRecord } from "../services/repairRecords";

interface CsrBatchForRepairModalProps {
    records: RepairRecord[];
    loading?: boolean;
    onCancel: () => void;
    onProceed: () => void;
}

function formatDate(dateStr: string): string {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
    } catch {
        return dateStr;
    }
}

export default function CsrBatchForRepairModal({
    records,
    loading = false,
    onCancel,
    onProceed,
}: CsrBatchForRepairModalProps) {
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
            <div className="relative z-10 w-full max-w-3xl rounded-xl border border-warm bg-white p-6 shadow-2xl">
                <h2 className="text-2xl font-semibold text-gray-800">For Repair</h2>
                <p className="mt-2 text-sm text-gray-500">
                    Review the following repair records before proceeding.
                </p>

                <div className="mt-5 max-h-[50vh] overflow-auto rounded-lg border border-gray-200">
                    <table className="w-full min-w-[560px] text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-left font-semibold text-gray-700">
                                <th className="px-3 py-3">Date</th>
                                <th className="px-3 py-3 text-center">POS No</th>
                                <th className="px-3 py-3 text-center">Serial No</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-3 py-8 text-center text-gray-400">
                                        No repair requests available.
                                    </td>
                                </tr>
                            ) : (
                                records.map((record, index) => (
                                    <tr
                                        key={record.id}
                                        className="text-gray-700"
                                        style={{
                                            borderTop: index === 0 ? "1px solid rgba(229,231,235,0.8)" : undefined,
                                            borderBottom: index < records.length - 1 ? "1px solid rgba(229,231,235,0.8)" : undefined,
                                        }}
                                    >
                                        <td className="px-3 py-3">{formatDate(record.date)}</td>
                                        <td className="px-3 py-3 text-center font-medium text-gray-800">{record.device_no || "-"}</td>
                                        <td className="px-3 py-3 text-center">{record.serial_number || "-"}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onProceed}
                        disabled={loading || records.length === 0}
                        className="rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                            background: "linear-gradient(to right, #92C7CF, #AAD7D9)",
                            boxShadow: "0 4px 16px rgba(146,199,207,0.25)",
                        }}
                    >
                        {loading ? (
                            <span className="inline-flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Processing...
                            </span>
                        ) : (
                            "Proceed"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
