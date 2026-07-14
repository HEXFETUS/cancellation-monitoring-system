import { useCallback, useEffect, useState } from "react";
import { Trash2, Send, Trophy } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { ConfirmationModal, Toast } from "../../../shared/components";
import {
    createLotteryResult,
    deleteLotteryResult,
    fetchLotteryResults,
    type LotteryResult,
} from "../services/lotteryResults";

const GAME_TIMES: Record<"STL" | "3D", { value: string; label: string }[]> = {
    STL: [
        { value: "11AM", label: "11 AM" },
        { value: "4PM", label: "4 PM" },
        { value: "8PM", label: "8 PM" },
    ],
    "3D": [
        { value: "1PM", label: "1 PM" },
        { value: "5PM", label: "5 PM" },
        { value: "9PM", label: "9 PM" },
    ],
};

const AREAS = ["National", "Local CDO", "Local MISOR"];

export default function ResultsAdminPage() {
    const { user } = useAuth();
    const userId = user?.id;

    const [results, setResults] = useState<LotteryResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [gameType, setGameType] = useState<"STL" | "3D">("STL");
    const [drawTime, setDrawTime] = useState("11AM");
    const [area, setArea] = useState(AREAS[0]);
    const [winningNumber, setWinningNumber] = useState("");
    const [drawDate, setDrawDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    const [toast, setToast] = useState<{ open: boolean; message: string; type: "success" | "error" }>({
        open: false,
        message: "",
        type: "success",
    });

    const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
        setToast({ open: true, message, type });
    }, []);
    const hideToast = useCallback(() => setToast((p) => ({ ...p, open: false })), []);

    const load = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError("");
        try {
            const data = await fetchLotteryResults(userId);
            setResults(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    const resetForm = () => {
        setGameType("STL");
        setDrawTime("11AM");
        setArea(AREAS[0]);
        setWinningNumber("");
        setDrawDate(new Date().toISOString().split("T")[0]);
        setFormError("");
    };

    const handleGameTypeChange = (gt: "STL" | "3D") => {
        setGameType(gt);
        setDrawTime(GAME_TIMES[gt][0].value);
    };

    const handleSubmit = async () => {
        if (!winningNumber.trim()) {
            setFormError("Winning number is required.");
            return;
        }
        if (!userId) return;

        setSubmitting(true);
        setFormError("");
        try {
            const drawLabel = `${gameType} ${drawTime}`;
            await createLotteryResult(userId, {
                draw_label: drawLabel,
                winning_number: winningNumber.trim(),
                area,
                draw_date: drawDate,
                game_type: gameType,
            });
            showToast("Result posted.", "success");
            resetForm();
            await load();
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Failed to save");
        } finally {
            setSubmitting(false);
        }
    };

    const askDelete = (id: number) => {
        setDeleteTargetId(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId || !userId) return;
        setSubmitting(true);
        try {
            await deleteLotteryResult(deleteTargetId, userId);
            showToast("Result deleted.", "success");
            await load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Failed to delete", "error");
        } finally {
            setSubmitting(false);
            setShowDeleteModal(false);
            setDeleteTargetId(null);
        }
    };

    const fmtDate = (iso: string | null) => {
        if (!iso) return "—";
        return new Date(iso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            <div className="flex items-center gap-2">
                <Trophy size={20} className="text-teal-dark" />
                <h1 className="text-lg font-bold text-ink">STL / 3D Results</h1>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    <span>{error}</span>
                </div>
            )}

            <div className="flex flex-1 min-h-0 gap-4 lg:flex-row flex-col">
                <div className="lg:w-[480px] xl:w-[520px] shrink-0 overflow-y-auto rounded-2xl border border-warm bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-semibold text-ink">Post a Result</h2>

                    {formError && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                            {formError}
                        </div>
                    )}

                    <div className="mb-4 flex gap-2">
                        {(["STL", "3D"] as const).map((gt) => (
                            <button
                                key={gt}
                                type="button"
                                onClick={() => handleGameTypeChange(gt)}
                                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                                    gameType === gt
                                        ? "bg-teal text-ink shadow"
                                        : "border border-warm bg-card text-ink-muted hover:bg-slate-50"
                                }`}
                            >
                                {gt}
                            </button>
                        ))}
                    </div>

                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">Draw Time</label>
                        <div className="flex flex-wrap gap-2">
                            {GAME_TIMES[gameType].map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setDrawTime(t.value)}
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                        drawTime === t.value
                                            ? "bg-teal-dark text-white shadow"
                                            : "border border-warm bg-card text-ink-muted hover:bg-slate-50"
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">Area</label>
                        <select
                            value={area}
                            onChange={(e) => setArea(e.target.value)}
                            className="w-full rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        >
                            {AREAS.map((a) => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Winning Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={winningNumber}
                            onChange={(e) => setWinningNumber(e.target.value)}
                            placeholder="e.g. 12-34-56"
                            className="w-full rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    <div className="mb-5">
                        <label className="mb-1 block text-xs font-medium text-ink">Draw Date</label>
                        <input
                            type="date"
                            value={drawDate}
                            onChange={(e) => setDrawDate(e.target.value)}
                            className="w-full rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || !winningNumber.trim()}
                        className="flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-ink shadow transition hover:bg-teal-dark disabled:opacity-50"
                    >
                        <Send size={14} />
                        {submitting ? "Posting…" : "Post Result"}
                    </button>
                </div>

                <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl border border-warm bg-white/60 shadow-sm">
                    <div className="flex-1 overflow-y-auto p-3">
                        {loading ? (
                            <div className="flex h-full items-center justify-center">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
                            </div>
                        ) : results.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-subtle">
                                <Trophy size={28} className="opacity-30" />
                                <p className="text-sm">No results yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {results.map((r) => (
                                    <div
                                        key={r.id}
                                        className="rounded-xl border border-warm bg-white p-3 shadow-xs"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                                            r.game_type === "3D"
                                                                ? "bg-purple-100 text-purple-700"
                                                                : "bg-teal/15 text-teal-dark"
                                                        }`}
                                                    >
                                                        {r.game_type}
                                                    </span>
                                                    <span className="text-sm font-semibold text-ink">{r.draw_label}</span>
                                                    <span className="text-[10px] text-ink-subtle">{r.area}</span>
                                                </div>
                                                <p className="mt-0.5 text-lg font-bold text-ink-muted">{r.winning_number}</p>
                                                <div className="mt-1 text-[10px] text-ink-subtle">
                                                    {fmtDate(r.created_at)}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => askDelete(r.id)}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmationModal
                open={showDeleteModal}
                title="Delete Result"
                message="Are you sure you want to delete this result? This action cannot be undone."
                confirmLabel="Delete"
                variant="delete"
                onConfirm={confirmDelete}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setDeleteTargetId(null);
                }}
                isLoading={submitting}
            />

            <Toast
                open={toast.open}
                message={toast.message}
                type={toast.type}
                onClose={hideToast}
                position="top-center"
            />
        </div>
    );
}
