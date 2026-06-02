import { AlertTriangle, X } from "lucide-react";

type ConfirmationModalProps = {
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    loadingLabel?: string;
    hideCancel?: boolean;
    children?: React.ReactNode;
};

export default function ConfirmationModal({
    open,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    isLoading = false,
    loadingLabel = "Saving...",
    hideCancel = false,
    children,
}: ConfirmationModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 px-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                {/* Header accent bar */}
                <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500" />

                <div className="p-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-50">
                            <AlertTriangle className="h-7 w-7 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-ink">{title}</h3>
                            <p className="text-sm text-ink-muted mt-1">{message}</p>
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
                                onClick={onCancel}
                                className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                            >
                                {cancelLabel}
                            </button>
                        )}
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="flex-1 rounded-xl bg-gradient-to-r from-teal to-teal-dark py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? loadingLabel : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}