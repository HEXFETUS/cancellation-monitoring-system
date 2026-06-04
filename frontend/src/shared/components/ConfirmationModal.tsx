import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export type ConfirmationVariant = "save" | "delete";

export interface ConfirmationModalProps {
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    loadingLabel?: string;
    hideCancel?: boolean;
    variant?: ConfirmationVariant;
    onCancel: () => void;
    onConfirm: () => void;
    children?: React.ReactNode;
}

export default function ConfirmationModal({
    open,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    isLoading = false,
    loadingLabel = "Saving...",
    hideCancel = false,
    variant = "save",
    onCancel,
    onConfirm,
    children,
}: ConfirmationModalProps) {
    if (!open) return null;

    const isDelete = variant === "delete";
    const Icon = isDelete ? AlertTriangle : CheckCircle2;

    // Variant-specific colors
    const accentBarStyle = isDelete
        ? { background: "linear-gradient(to right, #FCA5A5, #EF4444)" }
        : { background: "linear-gradient(to right, #92C7CF, #AAD7D9)" };
    const iconBg = isDelete ? "bg-red-100" : "bg-teal-100";
    const iconRing = isDelete ? "ring-red-50" : "ring-teal-50";
    const iconColor = isDelete ? "text-red-600" : "text-teal-600";
    const shadowRgba = isDelete ? "rgba(239,68,68,0.25)" : "rgba(146,199,207,0.25)";

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                {/* Accent bar */}
                <div className="h-2" style={accentBarStyle} />

                <div className="p-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div
                            className={`flex h-14 w-14 items-center justify-center rounded-full ${iconBg} ring-4 ${iconRing}`}
                        >
                            <Icon className={`h-7 w-7 ${iconColor}`} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-ink">{title}</h3>
                            {message && (
                                <p className="text-sm text-ink-muted mt-1">{message}</p>
                            )}
                            {isDelete && !message && (
                                <p className="text-sm text-ink-muted mt-1">
                                    This action cannot be undone.
                                </p>
                            )}
                        </div>

                        {children && (
                            <div className="w-full divide-y divide-warm/60 rounded-xl bg-gradient-to-br from-cream to-amber-50/50 border border-warm/70 overflow-hidden">
                                {children}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 mt-6">
                        {!hideCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={isLoading}
                                className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {cancelLabel}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                            style={{
                                background: accentBarStyle.background,
                                boxShadow: `0 4px 16px ${shadowRgba}`,
                            }}
                        >
                            {isLoading ? (
                                <span className="inline-flex items-center justify-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    {loadingLabel}
                                </span>
                            ) : (
                                confirmLabel
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
