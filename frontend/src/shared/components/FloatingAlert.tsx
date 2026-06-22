import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

type FloatingAlertProps = {
    message: string;
    count?: number;
    onClose?: () => void;
};

export default function FloatingAlert({ message, onClose }: FloatingAlertProps) {
    // `count` is accepted on the prop type for API compatibility with
    // future callers that may want to surface a numeric badge inside the
    // alert body. The current rendering is text-only via `message`, so
    // the prop is intentionally not destructured here.
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    return (
        <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] max-w-xl w-[calc(100%-2rem)] transition-all duration-300"
        >
            <div
                className="flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-xl"
                style={{
                    background: "rgba(254,226,226,0.92)",
                    borderColor: "rgba(239,68,68,0.30)",
                    boxShadow: "0 4px 20px rgba(239,68,68,0.15)",
                }}
            >
                <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "rgba(239,68,68,0.15)" }}
                >
                    <AlertTriangle className="h-4 w-4" style={{ color: "#DC2626" }} />
                </span>
                <p className="text-sm font-medium flex-1" style={{ color: "#991B1B" }}>
                    {message}
                </p>
                <button
                    onClick={() => {
                        setDismissed(true);
                        onClose?.();
                    }}
                    className="shrink-0 rounded-full p-1 transition-colors hover:bg-red-200/50"
                    style={{ color: "#991B1B" }}
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}