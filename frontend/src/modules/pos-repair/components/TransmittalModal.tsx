import { X } from "lucide-react";
import type { RepairRecord } from "../services/repairRecords";

interface TransmittalModalProps {
    record: RepairRecord;
    onClose: () => void;
}

export default function TransmittalModal({ record, onClose }: TransmittalModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-warm bg-white shadow-2xl">
                <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />
                <div className="p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-ink">Transmittal</h2>
                            <p className="mt-0.5 text-sm text-ink-muted">
                                External technician release requires transmittal processing.
                            </p>
                        </div>
                        <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100">
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>
                    <div className="space-y-2 rounded-xl border border-warm bg-card/60 p-4 text-sm text-ink">
                        <div className="flex justify-between gap-4">
                            <span className="font-semibold">Device No</span>
                            <span>{record.device_no || "-"}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="font-semibold">Serial No</span>
                            <span>{record.serial_number || "-"}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="font-semibold">Technician</span>
                            <span>{record.repaired_by || "-"}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="font-semibold">Billing Code</span>
                            <span>{record.billing_code || "-"}</span>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end border-t border-warm/60 pt-4">
                        <button
                            onClick={onClose}
                            className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:shadow-xl"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
