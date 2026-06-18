import { useMemo, useState, type RefObject } from "react";
import { Bluetooth, Loader2, Plug, Printer, Settings2, Usb, X } from "lucide-react";
import {
    LABEL_PRESETS,
    PRINT_TASK_OPTIONS,
    useNiimbot,
    type NiimbotTransport,
} from "./niimbot";
import { renderThermalLabelCanvas, type ThermalLabelLine } from "./renderThermalLabelCanvas";

interface Props {
    /** Container holding the QR <svg> to print (e.g. the preview modal's ref). */
    svgContainerRef: RefObject<HTMLDivElement | null>;
    /** Text lines drawn alongside the QR on the thermal label. */
    lines: ThermalLabelLine[];
    className?: string;
}

const STATUS_LABEL: Record<string, string> = {
    disconnected: "Not connected",
    connecting: "Connecting…",
    connected: "Connected",
    printing: "Printing…",
    error: "Error",
};

export default function NiimbotPrintControls({ svgContainerRef, lines, className }: Props) {
    const n = useNiimbot();
    const [quantity, setQuantity] = useState(1);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const anySupported = n.serialSupported || n.bleSupported;
    const connected = n.status === "connected" || n.status === "printing";
    const busy = n.status === "printing" || n.status === "connecting";

    const currentPresetId = useMemo(() => {
        const p = LABEL_PRESETS.find(
            (x) => x.widthMm === n.settings.labelWidthMm && x.heightMm === n.settings.labelHeightMm
        );
        return p?.id ?? "custom";
    }, [n.settings.labelWidthMm, n.settings.labelHeightMm]);

    if (!anySupported) {
        return (
            <div className={`rounded-lg border border-warm bg-cream px-3 py-2 text-xs text-ink-muted ${className ?? ""}`}>
                Direct label printing needs Chrome or Edge (Web Serial / Bluetooth). On other
                browsers, use <span className="font-medium">Download PNG</span> and print from the NIIMBOT app.
            </div>
        );
    }

    const handleConnect = async (transport: NiimbotTransport) => {
        setLocalError(null);
        await n.connect(transport);
    };

    const handlePrint = async () => {
        setLocalError(null);
        const svg = svgContainerRef.current?.querySelector("svg");
        if (!svg) {
            setLocalError("Couldn't find the QR to print.");
            return;
        }
        try {
            const canvas = await renderThermalLabelCanvas(svg as SVGSVGElement, {
                widthMm: n.settings.labelWidthMm,
                heightMm: n.settings.labelHeightMm,
                lines,
            });
            await n.printCanvas(canvas, quantity);
        } catch (e) {
            setLocalError(e instanceof Error ? e.message : "Print failed.");
        }
    };

    return (
        <div className={`rounded-xl border border-warm bg-card p-3 text-left ${className ?? ""}`}>
            {/* Status + connect */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                    <span
                        className={`inline-block h-2 w-2 rounded-full ${
                            connected ? "bg-teal" : n.status === "error" ? "bg-rose-500" : "bg-ink-subtle/40"
                        }`}
                    />
                    <span className="font-medium text-ink">NIIMBOT</span>
                    <span className="text-ink-muted">
                        {STATUS_LABEL[n.status] ?? n.status}
                        {n.detectedTask ? ` · ${n.detectedTask}` : ""}
                    </span>
                </div>

                {connected ? (
                    <button
                        onClick={() => n.disconnect()}
                        className="inline-flex items-center gap-1 rounded-lg border border-warm bg-card px-2 py-1 text-xs text-ink-muted hover:bg-cream"
                    >
                        <X size={13} /> Disconnect
                    </button>
                ) : (
                    <div className="flex items-center gap-1.5">
                        {n.serialSupported && (
                            <button
                                onClick={() => handleConnect("serial")}
                                disabled={busy}
                                className="inline-flex items-center gap-1 rounded-lg border border-warm bg-card px-2 py-1 text-xs font-medium text-ink hover:bg-cream disabled:opacity-50"
                                title="Connect over USB-C"
                            >
                                {busy ? <Loader2 size={13} className="animate-spin" /> : <Usb size={13} />} USB
                            </button>
                        )}
                        {n.bleSupported && (
                            <button
                                onClick={() => handleConnect("ble")}
                                disabled={busy}
                                className="inline-flex items-center gap-1 rounded-lg border border-warm bg-card px-2 py-1 text-xs font-medium text-ink hover:bg-cream disabled:opacity-50"
                                title="Connect over Bluetooth"
                            >
                                {busy ? <Loader2 size={13} className="animate-spin" /> : <Bluetooth size={13} />} Bluetooth
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Label size + quantity + print */}
            <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-[11px] text-ink-muted">
                    Label size
                    <select
                        value={currentPresetId}
                        onChange={(e) => {
                            const p = LABEL_PRESETS.find((x) => x.id === e.target.value);
                            if (p) n.updateSettings({ labelWidthMm: p.widthMm, labelHeightMm: p.heightMm });
                        }}
                        className="rounded-lg border border-warm bg-card px-2 py-1 text-xs text-ink focus:border-teal focus:outline-none"
                    >
                        {currentPresetId === "custom" && <option value="custom">Custom</option>}
                        {LABEL_PRESETS.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-ink-muted">
                    Qty
                    <input
                        type="number"
                        min={1}
                        max={99}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                        className="w-16 rounded-lg border border-warm bg-card px-2 py-1 text-xs text-ink focus:border-teal focus:outline-none"
                    />
                </label>

                <button
                    onClick={handlePrint}
                    disabled={!connected || busy}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                >
                    {n.status === "printing" ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <Printer size={14} />
                    )}
                    Print to NIIMBOT
                </button>

                <button
                    onClick={() => setShowAdvanced((s) => !s)}
                    className="inline-flex items-center gap-1 rounded-lg border border-warm bg-card px-2 py-1.5 text-xs text-ink-muted hover:bg-cream"
                    title="Advanced printer settings"
                >
                    <Settings2 size={14} />
                </button>
            </div>

            {/* Advanced settings */}
            {showAdvanced && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-warm/60 pt-3 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 text-[11px] text-ink-muted">
                        Density
                        <input
                            type="number"
                            min={1}
                            max={5}
                            value={n.settings.density}
                            onChange={(e) =>
                                n.updateSettings({ density: Math.max(1, Math.min(5, Number(e.target.value) || 3)) })
                            }
                            className="rounded-lg border border-warm bg-card px-2 py-1 text-xs text-ink focus:border-teal focus:outline-none"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-ink-muted">
                        Direction
                        <select
                            value={n.settings.direction}
                            onChange={(e) => n.updateSettings({ direction: e.target.value as "left" | "top" })}
                            className="rounded-lg border border-warm bg-card px-2 py-1 text-xs text-ink focus:border-teal focus:outline-none"
                        >
                            <option value="top">Top (no rotation)</option>
                            <option value="left">Left (rotate 90°)</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-ink-muted">
                        Print task
                        <select
                            value={n.settings.printTaskName}
                            onChange={(e) => n.updateSettings({ printTaskName: e.target.value })}
                            className="rounded-lg border border-warm bg-card px-2 py-1 text-xs text-ink focus:border-teal focus:outline-none"
                        >
                            {PRINT_TASK_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                    {t === "auto" ? "Auto (D110 for B21S)" : t}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            )}

            {/* Progress / errors */}
            {n.status === "printing" && n.progress && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <Plug size={12} />
                    Page {n.progress.page}/{n.progress.pagesTotal} · print {n.progress.pagePrintProgress}% · feed{" "}
                    {n.progress.pageFeedProgress}%
                </p>
            )}
            {(localError || n.error) && (
                <p className="mt-2 text-[11px] text-rose-600">{localError || n.error}</p>
            )}
        </div>
    );
}
