import { X } from "lucide-react";

type EditModalProps = {
    open: boolean;
    title: string;
    subtitle?: string;
    accentColor?: string;
    onClose: () => void;
    children: React.ReactNode;
};

const ACCENT_PRESETS = {
    teal: "from-teal to-teal-dark",
    blue: "from-blue-500 to-indigo-600",
    purple: "from-indigo-500 to-purple-600",
} as const;

export default function EditModal({
    open,
    title,
    subtitle,
    accentColor = "teal",
    onClose,
    children,
}: EditModalProps) {
    if (!open) return null;

    const gradientClass = ACCENT_PRESETS[accentColor as keyof typeof ACCENT_PRESETS] || ACCENT_PRESETS.teal;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm pt-16 px-4">
            <div className="relative w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                {/* Header accent bar */}
                <div className={`h-2 bg-gradient-to-r ${gradientClass}`} />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-ink">{title}</h2>
                            {subtitle && (
                                <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>
                            )}
                        </div>
                        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>

                    {children}
                </div>
            </div>
        </div>
    );
}
