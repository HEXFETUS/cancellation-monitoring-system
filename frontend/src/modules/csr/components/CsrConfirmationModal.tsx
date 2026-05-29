import { AlertTriangle, CheckCircle2, Trash2, X } from "lucide-react";

type ConfirmationVariant = "save" | "delete";

interface CsrConfirmationModalProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    loading?: boolean;
    variant?: ConfirmationVariant;
    onCancel: () => void;
    onConfirm: () => void;
}

const teal = "#92C7CF";

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

    const Icon = variant === "delete" ? Trash2 : CheckCircle2;
    const iconColor = variant === "delete" ? "#EF4444" : teal;
    const confirmColor = variant === "delete" ? "#EF4444" : teal;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
            <button
                type="button"
                aria-label="Close confirmation"
                className="absolute inset-0 h-full w-full cursor-default"
                onClick={loading ? undefined : onCancel}
            />
            <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/40 bg-white/90 p-6 shadow-2xl backdrop-blur-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                            style={{
                                background: variant === "delete" ? "rgba(239,68,68,0.10)" : "rgba(146,199,207,0.16)",
                                color: iconColor,
                            }}
                        >
                            <Icon className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-800">{title}</h3>
                            <p className="mt-1 text-sm leading-6 text-gray-600">{message}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="rounded-xl p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {variant === "delete" && (
                    <div className="mb-5 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        This action clears record details and cannot be undone from this screen.
                    </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="h-10 rounded-xl px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ background: confirmColor }}
                    >
                        {loading && (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        )}
                        {loading ? "Please wait..." : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
