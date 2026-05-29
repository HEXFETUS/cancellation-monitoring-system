import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { Send, RotateCcw, Ticket, AlertTriangle, UserX, CheckCircle2, XCircle, Hash, Store, Smartphone } from "lucide-react";
import { addHumanForceRecord } from "../services";

const teal = "#92C7CF";

const reasonOptions = [
    { value: "", label: "Select a reason…" },
    { value: "HUMAN ERROR", label: "HUMAN ERROR" },
    { value: "FORCE CANCEL", label: "FORCE CANCEL" },
];

export default function ReasonForDenyPage() {
    const { user } = useAuth();
    const [generalValue, setGeneralValue] = useState("");
    const [generalReason, setGeneralReason] = useState("");
    const [generalSending, setGeneralSending] = useState(false);

    const [cellphoneTicketNumber, setCellphoneTicketNumber] = useState("");
    const [cellphoneReferenceCode, setCellphoneReferenceCode] = useState("");
    const [cellphoneBoothCode, setCellphoneBoothCode] = useState("");
    const [cellphoneReason, setCellphoneReason] = useState("");
    const [cellphoneSending, setCellphoneSending] = useState(false);

    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Auto-dismiss toast after 5 seconds
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => setMessage(null), 5000);
        return () => clearTimeout(timer);
    }, [message]);

    function handleClearGeneral() {
        setGeneralValue("");
        setGeneralReason("");
        setMessage(null);
    }

    function handleClearCellphone() {
        setCellphoneTicketNumber("");
        setCellphoneReferenceCode("");
        setCellphoneBoothCode("");
        setCellphoneReason("");
        setMessage(null);
    }

    async function handleSendGeneral() {
        if (!generalValue.trim()) {
            setMessage({ type: "error", text: "Please enter a ticket number or reference code." });
            return;
        }
        if (!generalReason) {
            setMessage({ type: "error", text: "Please select a reason for denied ticket." });
            return;
        }

        setGeneralSending(true);
        setMessage(null);

        try {
            const result = await updateTicketReason({
                ticket_number: generalValue.trim(),
                reaseon_for_deny: generalReason,
            });
            if (result.sheet_warning) {
                setMessage({
                    type: "error",
                    text: `${result.message || `Ticket updated.`} ⚠️ Sheet warning: ${result.sheet_warning}`,
                });
            } else {
                setMessage({
                    type: "success",
                    text: result.message || `Record saved with reason: ${generalReason}`,
                });
            }
            setGeneralValue("");
            setGeneralReason("");
        } catch (err) {
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Failed to save record.",
            });
        } finally {
            setGeneralSending(false);
        }
    }

    async function handleSendCellphone() {
        if (!cellphoneTicketNumber.trim()) {
            setMessage({ type: "error", text: "Please enter a cellphone ticket number." });
            return;
        }
        if (!cellphoneReason) {
            setMessage({ type: "error", text: "Please select a reason for cellphone denied ticket." });
            return;
        }

        setCellphoneSending(true);
        setMessage(null);

        try {
            const result = await addHumanForceRecord({
                ticket_number: cellphoneTicketNumber.trim(),
                reference_code: cellphoneReferenceCode.trim() || undefined,
                booth_code: cellphoneBoothCode.trim() || undefined,
                reaseon_for_deny: cellphoneReason,
                cancelled_by: user?.name || undefined,
            });
            if (result.sheet_warning) {
                setMessage({
                    type: "error",
                    text: `${result.message || `Ticket "${cellphoneTicketNumber}" updated.`} ⚠️ Sheet warning: ${result.sheet_warning}`,
                });
            } else {
                setMessage({
                    type: "success",
                    text: result.message || `Ticket "${cellphoneTicketNumber}" updated with reason: ${cellphoneReason}`,
                });
            }
            setCellphoneTicketNumber("");
            setCellphoneReferenceCode("");
            setCellphoneBoothCode("");
            setCellphoneReason("");
        } catch (err) {
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Failed to save record.",
            });
        } finally {
            setCellphoneSending(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* ─────────────── Decorative Header ─────────────── */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/40 via-white/20 to-white/5 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 sm:p-8 hover:shadow-2xl">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-teal/15 to-teal-light/5 blur-3xl transition-all duration-700 group-hover:scale-110" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-gradient-to-br from-teal-light/10 to-warm/20 blur-3xl transition-all duration-700 group-hover:scale-110" />
                <div className="pointer-events-none absolute right-1/3 top-1/4 h-20 w-20 rounded-full bg-emerald-500/5 blur-2xl" />
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                        backgroundSize: "24px 24px",
                    }}
                />

                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal via-teal-light to-teal text-white shadow-lg shadow-teal/30 ring-1 ring-white/20 transition-all duration-300 group-hover:shadow-teal/40 group-hover:scale-105">
                            <Ticket className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-ink sm:text-3xl">
                                Reason for Deny
                            </h1>
                            <p className="mt-1 text-xs text-ink-muted/80">
                                Log a FORCE CANCEL or HUMAN ERROR entry for a ticket
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─────────────── Message Banner ─────────────── */}
            {message && (
                <div
                    className={`animate-[slideDown_0.4s_cubic-bezier(0.16,1,0.3,1)] rounded-2xl border px-5 py-3.5 text-sm font-medium shadow-lg backdrop-blur-md ${
                        message.type === "error"
                            ? "border-rose/30 bg-gradient-to-r from-rose/10 to-rose/5 text-rose-dark ring-1 ring-rose/20"
                            : "border-emerald-200/40 bg-gradient-to-r from-emerald-50/80 to-emerald-50/40 text-emerald-700 ring-1 ring-emerald-200/30"
                    }`}
                >
                    <span className="inline-flex items-center gap-2.5">
                        <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full ${
                                message.type === "error" ? "bg-rose/15" : "bg-emerald-100/80"
                            }`}
                        >
                            {message.type === "error" ? (
                                <XCircle className="h-4 w-4 shrink-0" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            )}
                        </span>
                        <span>{message.text}</span>
                    </span>
                </div>
            )}

            {/* ─────────────── First Form Card: Ticket / Reference Code ─────────────── */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/40 via-white/20 to-white/5 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 sm:p-8 hover:shadow-2xl">
                <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-teal/5 blur-3xl transition-all duration-700 group-hover:scale-110" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-amber-500/5 blur-3xl transition-all duration-700 group-hover:scale-110" />
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                        backgroundSize: "20px 20px",
                    }}
                />

                <div className="relative">
                    <div className="mb-6 flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal/10 to-teal-light/10 ring-1 ring-teal/20">
                            <Ticket className="h-4 w-4 text-teal" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70">
                            Ticket Details
                        </span>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                        {/* ── Ticket Number / Reference Code (combined) ── */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted/70">
                                Ticket Number / Reference Code
                            </label>
                            <div className="group/input relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                    <Hash className="h-4 w-4 text-ink-muted/50" />
                                </div>
                                <input
                                    type="text"
                                    value={generalValue}
                                    onChange={(e) => setGeneralValue(e.target.value)}
                                    placeholder="Enter ticket number or reference code"
                                    className="h-11 w-full rounded-2xl border border-white/30 bg-white/50 pl-10 pr-4 text-sm text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-teal/50 focus:bg-white/70 focus:ring-2 focus:ring-teal/20 hover:border-white/50"
                                />
                            </div>
                        </div>

                        {/* ── Reason for Denied Ticket ── */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted/70">
                                Reason for Denied Ticket
                            </label>
                            <div className="group/input relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-4">
                                    {generalReason === "FORCE CANCEL" ? (
                                        <AlertTriangle className="h-4 w-4 text-orange-400" />
                                    ) : generalReason === "HUMAN ERROR" ? (
                                        <UserX className="h-4 w-4 text-purple-400" />
                                    ) : (
                                        <AlertTriangle className="h-4 w-4 text-ink-muted/50" />
                                    )}
                                </div>
                                <select
                                    value={generalReason}
                                    onChange={(e) => setGeneralReason(e.target.value)}
                                    className="h-11 w-full appearance-none rounded-2xl border border-white/30 bg-white/50 pl-10 pr-10 text-sm text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-teal/50 focus:bg-white/70 focus:ring-2 focus:ring-teal/20 hover:border-white/50"
                                >
                                    {reasonOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-4">
                                    <svg
                                        className="h-4 w-4 text-ink-muted/50"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Action Buttons ── */}
                    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/20 pt-6">
                        <button
                            type="button"
                            onClick={handleSendGeneral}
                            disabled={generalSending}
                            className="group/btn inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-2xl bg-gradient-to-br from-teal via-teal-light to-teal px-6 text-sm font-semibold text-white shadow-lg shadow-teal/25 ring-1 ring-white/20 transition-all duration-200 hover:from-teal-dark hover:via-teal hover:to-teal-dark hover:shadow-teal/40 hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-teal/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100"
                        >
                            <Send className={`h-4 w-4 transition-transform duration-300 ${generalSending ? "animate-pulse" : "group-hover/btn:translate-x-0.5"}`} />
                            {generalSending ? "Sending…" : "Send"}
                        </button>

                        <button
                            type="button"
                            onClick={handleClearGeneral}
                            disabled={generalSending}
                            className="group/btn inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-2xl border border-white/30 bg-white/40 px-6 text-sm font-semibold text-ink-muted shadow-sm backdrop-blur-sm ring-1 ring-white/20 transition-all duration-200 hover:bg-white/60 hover:text-ink hover:shadow-md active:scale-[0.98] focus:ring-2 focus:ring-teal/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100"
                        >
                            <RotateCcw className="h-4 w-4 transition-transform duration-300 group-hover/btn:-rotate-12" />
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            {/* ─────────────── Second Form Card: Cellphone Cancellation ─────────────── */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/40 via-white/20 to-white/5 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 sm:p-8 hover:shadow-2xl">
                <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-teal/5 blur-3xl transition-all duration-700 group-hover:scale-110" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-amber-500/5 blur-3xl transition-all duration-700 group-hover:scale-110" />
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                        backgroundSize: "20px 20px",
                    }}
                />

                <div className="relative">
                    <div className="mb-6 flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal/10 to-teal-light/10 ring-1 ring-teal/20">
                            <Smartphone className="h-4 w-4 text-teal" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70">
                            Cellphone Cancellation
                        </span>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                        {/* ── Ticket Number ── */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted/70">
                                Ticket Number
                            </label>
                            <div className="group/input relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                    <Ticket className="h-4 w-4 text-ink-muted/50" />
                                </div>
                                <input
                                    type="text"
                                    value={cellphoneTicketNumber}
                                    onChange={(e) => setCellphoneTicketNumber(e.target.value)}
                                    placeholder="e.g. BAR1-K39H-RVCM-4GKB"
                                    className="h-11 w-full rounded-2xl border border-white/30 bg-white/50 pl-10 pr-4 text-sm text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-teal/50 focus:bg-white/70 focus:ring-2 focus:ring-teal/20 hover:border-white/50"
                                />
                            </div>
                        </div>

                        {/* ── Reference Code ── */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted/70">
                                Reference Code
                            </label>
                            <div className="group/input relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                    <Hash className="h-4 w-4 text-ink-muted/50" />
                                </div>
                                <input
                                    type="text"
                                    value={cellphoneReferenceCode}
                                    onChange={(e) => setCellphoneReferenceCode(e.target.value)}
                                    placeholder="e.g. REF-12345"
                                    className="h-11 w-full rounded-2xl border border-white/30 bg-white/50 pl-10 pr-4 text-sm text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-teal/50 focus:bg-white/70 focus:ring-2 focus:ring-teal/20 hover:border-white/50"
                                />
                            </div>
                        </div>

                        {/* ── Booth Code ── */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted/70">
                                Booth Code
                            </label>
                            <div className="group/input relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                    <Store className="h-4 w-4 text-ink-muted/50" />
                                </div>
                                <input
                                    type="text"
                                    value={cellphoneBoothCode}
                                    onChange={(e) => setCellphoneBoothCode(e.target.value)}
                                    placeholder="e.g. BOOTH-01"
                                    className="h-11 w-full rounded-2xl border border-white/30 bg-white/50 pl-10 pr-4 text-sm text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-teal/50 focus:bg-white/70 focus:ring-2 focus:ring-teal/20 hover:border-white/50"
                                />
                            </div>
                        </div>

                        {/* ── Reason for Denied Ticket ── */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted/70">
                                Reason for Denied Ticket
                            </label>
                            <div className="group/input relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-4">
                                    {cellphoneReason === "FORCE CANCEL" ? (
                                        <AlertTriangle className="h-4 w-4 text-orange-400" />
                                    ) : cellphoneReason === "HUMAN ERROR" ? (
                                        <UserX className="h-4 w-4 text-purple-400" />
                                    ) : (
                                        <AlertTriangle className="h-4 w-4 text-ink-muted/50" />
                                    )}
                                </div>
                                <select
                                    value={cellphoneReason}
                                    onChange={(e) => setCellphoneReason(e.target.value)}
                                    className="h-11 w-full appearance-none rounded-2xl border border-white/30 bg-white/50 pl-10 pr-10 text-sm text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-teal/50 focus:bg-white/70 focus:ring-2 focus:ring-teal/20 hover:border-white/50"
                                >
                                    {reasonOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-4">
                                    <svg
                                        className="h-4 w-4 text-ink-muted/50"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Action Buttons ── */}
                    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/20 pt-6">
                        <button
                            type="button"
                            onClick={handleSendCellphone}
                            disabled={cellphoneSending}
                            className="group/btn inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-2xl bg-gradient-to-br from-teal via-teal-light to-teal px-6 text-sm font-semibold text-white shadow-lg shadow-teal/25 ring-1 ring-white/20 transition-all duration-200 hover:from-teal-dark hover:via-teal hover:to-teal-dark hover:shadow-teal/40 hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-teal/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100"
                        >
                            <Send className={`h-4 w-4 transition-transform duration-300 ${cellphoneSending ? "animate-pulse" : "group-hover/btn:translate-x-0.5"}`} />
                            {cellphoneSending ? "Sending…" : "Send"}
                        </button>

                        <button
                            type="button"
                            onClick={handleClearCellphone}
                            disabled={cellphoneSending}
                            className="group/btn inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-2xl border border-white/30 bg-white/40 px-6 text-sm font-semibold text-ink-muted shadow-sm backdrop-blur-sm ring-1 ring-white/20 transition-all duration-200 hover:bg-white/60 hover:text-ink hover:shadow-md active:scale-[0.98] focus:ring-2 focus:ring-teal/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100"
                        >
                            <RotateCcw className="h-4 w-4 transition-transform duration-300 group-hover/btn:-rotate-12" />
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            {/* Inject keyframes */}
            <style>{`
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}