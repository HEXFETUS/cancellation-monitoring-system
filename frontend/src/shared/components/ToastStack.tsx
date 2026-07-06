import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastStackType = "success" | "error" | "info" | "warning";

export interface StackToast {
    /** Stable unique id — used for de-duplication and keying. */
    id: string;
    message: string;
    type?: ToastStackType;
}

type Position = "top-right" | "top-left" | "top-center" | "bottom-right";

interface ToastStackProps {
    toasts: StackToast[];
    onDismiss: (id: string) => void;
    /** Auto-dismiss delay in ms. */
    duration?: number;
    position?: Position;
}

const iconMap: Record<ToastStackType, React.ReactNode> = {
    success: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    error: <AlertCircle className="h-5 w-5 text-red-600" />,
    info: <Info className="h-5 w-5 text-blue-600" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
};

const bgMap: Record<ToastStackType, string> = {
    success: "border-green-200 bg-green-50",
    error: "border-red-200 bg-red-50",
    info: "border-blue-200 bg-blue-50",
    warning: "border-amber-200 bg-amber-50",
};

const positionClassMap: Record<Position, string> = {
    "top-right": "top-6 right-6 items-end",
    "top-left": "top-6 left-6 items-start",
    "top-center": "top-6 left-1/2 -translate-x-1/2 items-center",
    "bottom-right": "bottom-6 right-6 items-end",
};

function ToastCard({
    toast,
    duration,
    onDismiss,
}: {
    toast: StackToast;
    duration: number;
    onDismiss: (id: string) => void;
}) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Fade in on next frame, hold for `duration`, then fade out and remove.
        const raf = requestAnimationFrame(() => setVisible(true));
        const hideTimer = setTimeout(() => setVisible(false), duration);
        const removeTimer = setTimeout(() => onDismiss(toast.id), duration + 300);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(hideTimer);
            clearTimeout(removeTimer);
        };
    }, [toast.id, duration, onDismiss]);

    const type = toast.type ?? "info";

    return (
        <div
            className={`pointer-events-auto w-[min(22rem,calc(100vw-2rem))] transition-all duration-300 ${visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                }`}
        >
            <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${bgMap[type]}`}>
                <span className="mt-0.5 shrink-0">{iconMap[type]}</span>
                <p className="flex-1 text-sm font-medium text-ink">{toast.message}</p>
                <button
                    onClick={() => {
                        setVisible(false);
                        setTimeout(() => onDismiss(toast.id), 200);
                    }}
                    className="shrink-0 rounded-full p-0.5 text-ink-muted transition-colors hover:bg-black/5 hover:text-ink"
                    aria-label="Dismiss notification"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}

/**
 * Renders a vertical stack of auto-dismissing toasts in a fixed corner.
 * Stacking (flex column + gap) keeps multiple toasts from overlapping.
 */
export default function ToastStack({
    toasts,
    onDismiss,
    duration = 5000,
    position = "top-right",
}: ToastStackProps) {
    if (toasts.length === 0) return null;

    return (
        <div className={`pointer-events-none fixed z-[80] flex flex-col gap-2 ${positionClassMap[position]}`}>
            {toasts.map((t) => (
                <ToastCard key={t.id} toast={t} duration={duration} onDismiss={onDismiss} />
            ))}
        </div>
    );
}
