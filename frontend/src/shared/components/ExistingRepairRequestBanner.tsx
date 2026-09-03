import { AlertTriangle, X } from "lucide-react";

export interface ExistingRepairRequestBannerProps {
    posNumber: string;
    serialNumber: string;
    status: string;
    darkMode: boolean;
    onClose: () => void;
}

function getStatusGuidance(status: string): string {
    switch (status.trim().toLowerCase()) {
        case "for request":
            return "Review this POS in Repair Management → For Request. If the request details are already aligned, proceed with the request.";
        case "for repair":
        case "pending":
            return "This request has already moved into repair processing. Check Repair Management for its latest assigned step.";
        case "undergoing repair":
            return "Repair work is currently in progress for this POS.";
        case "for release":
            return "Repair processing is complete and this POS is awaiting release.";
        default:
            return "Check Repair Management for the latest details before taking further action.";
    }
}

export default function ExistingRepairRequestBanner({
    posNumber,
    serialNumber,
    status,
    darkMode,
    onClose,
}: ExistingRepairRequestBannerProps) {
    const displayStatus = status.trim() || "Existing Repair Request";

    return (
        <div
            role="alert"
            aria-live="polite"
            className={`relative overflow-hidden rounded-2xl border p-4 shadow-lg ${
                darkMode
                    ? "border-amber-700/50 bg-amber-950/45 text-amber-100"
                    : "border-amber-300/80 bg-amber-50/95 text-amber-950"
            }`}
        >
            <div className="flex items-start gap-3 pr-9">
                <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        darkMode ? "bg-amber-900/60 text-amber-300" : "bg-amber-100 text-amber-700"
                    }`}
                >
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold">Existing repair request found</h2>
                        <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                darkMode ? "bg-amber-900/70 text-amber-200" : "bg-amber-200/80 text-amber-900"
                            }`}
                        >
                            {displayStatus}
                        </span>
                    </div>
                    <p className={`mt-1 text-sm ${darkMode ? "text-amber-100/85" : "text-amber-900/80"}`}>
                        POS {posNumber || "—"} · Serial {serialNumber || "—"}
                    </p>
                    <p className={`mt-2 text-sm leading-5 ${darkMode ? "text-amber-100/90" : "text-amber-950/90"}`}>
                        {getStatusGuidance(displayStatus)}
                    </p>
                    <p className={`mt-2 text-xs font-medium ${darkMode ? "text-amber-300/90" : "text-amber-800"}`}>
                        A new repair request cannot be created while this request is active.
                    </p>
                </div>
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label="Close existing repair request message"
                className={`absolute right-3 top-3 rounded-lg p-1.5 transition-colors ${
                    darkMode ? "text-amber-300 hover:bg-amber-900/60" : "text-amber-700 hover:bg-amber-200/70"
                }`}
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}
