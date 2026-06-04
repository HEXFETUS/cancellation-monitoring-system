import { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

type ToastProps = {
    open: boolean;
    message: string;
    type?: ToastType;
    duration?: number;
    onClose: () => void;
    position?: "bottom-right" | "top-left" | "top-right" | "top-center";
};

const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    error: <AlertCircle className="h-5 w-5 text-red-600" />,
    info: <Info className="h-5 w-5 text-blue-600" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
};

const bgMap: Record<ToastType, string> = {
    success: "border-green-200 bg-green-50",
    error: "border-red-200 bg-red-50",
    info: "border-blue-200 bg-blue-50",
    warning: "border-amber-200 bg-amber-50",
};

const positionClassMap: Record<string, string> = {
    "top-left": "top-6 left-6",
    "top-right": "top-6 right-6",
    "bottom-right": "bottom-6 right-6",
    "top-center": "top-6 left-1/2 -translate-x-1/2",
};

export default function Toast({
    open,
    message,
    type = "error",
    duration = 4000,
    onClose,
    position = "top-center",
}: ToastProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (open) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(onClose, 200);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [open, duration, onClose]);

    if (!open && !visible) return null;

    return (
        <div
            className={`fixed z-[70] max-w-sm transition-all duration-300 ${positionClassMap[position]} ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
        >
            <div
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${bgMap[type]}`}
            >
                <span className="mt-0.5 shrink-0">{iconMap[type]}</span>
                <p className="text-sm font-medium text-ink flex-1">{message}</p>
                <button
                    onClick={() => {
                        setVisible(false);
                        setTimeout(onClose, 200);
                    }}
                    className="shrink-0 rounded-full p-0.5 text-ink-muted hover:bg-black/5 hover:text-ink transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}