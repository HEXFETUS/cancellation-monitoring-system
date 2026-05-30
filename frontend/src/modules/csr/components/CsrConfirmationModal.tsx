import { CheckCircle2, AlertTriangle } from "lucide-react";

type ConfirmationVariant = "save" | "delete";

interface CsrConfirmationModalProps {
    open: boolean;
    title: string;
    message?: string;
    confirmLabel: string;
    cancelLabel?: string;
    loading?: boolean;
    variant?: ConfirmationVariant;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function CsrConfirmationModal({
    open,
    title,
    message,
    confirmLabel,
    cancelLabel = "Cancel",
    loading = false,
    variant = "save",
    onCancel,
    onConfirm,
}: CsrConfirmationModalProps) {
    if (!open) return null;

    const isDelete = variant === "delete";
    const Icon = isDelete ? AlertTriangle : CheckCircle2;

    // Variant-specific colors
    const gradientFrom = isDelete ? "#FCA5A5" : "#92C7CF";
    const gradientTo = isDelete ? "#EF4444" : "#AAD7D9";
    const iconBg = isDelete ? "bg-red-100" : "bg-teal-100";
    const iconRing = isDelete ? "ring-red-50" : "ring-teal-50";
    const iconColor = isDelete ? "text-red-600" : "text-teal-600";
    const shadowRgba = isDelete ? "rgba(239,68,68,0.25)" : "rgba(146,199,207,0.25)";

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
            <button
                type="button"
                aria-label="Close confirmation"
                className="absolute inset-0 h-full w-full cursor-default"
                onClick={loading ? undefined : onCancel}
            />
            <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                {/* Accent bar */}
                <div
                    className="h-2"
                    style={{
                        background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
                    }}
                />

                <div className="p-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div
                            className={`flex h-14 w-14 items-center justify-center rounded-full ${iconBg} ring-4 ${iconRing}`}
                        >
                            <Icon className={`h-7 w-7 ${iconColor}`} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                            {message && (
                                <p className="text-sm text-gray-500 mt-1">{message}</p>
                            )}
                            {isDelete && !message && (
                                <p className="text-sm text-gray-500 mt-1">
                                    This action clears record details and cannot be undone from this screen.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={loading}
                            className="flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                            style={{
                                background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
                                boxShadow: `0 4px 16px ${shadowRgba}`,
                            }}
                        >
                            {loading ? (
                                <span className="inline-flex items-center justify-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Please wait...
                                </span>
                            ) : (
                                confirmLabel
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
