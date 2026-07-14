import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, Send, Trophy, Check } from "lucide-react";
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

export default function ResultsAdminPage() {
    const { user } = useAuth();
    const userId = user?.id;

    const [results, setResults] = useState<LotteryResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [gameType, setGameType] = useState<"STL" | "3D">("STL");
    const [drawTime, setDrawTime] = useState("11AM");
    const [area, setArea] = useState("");
    const [winningNumber, setWinningNumber] = useState("");
    const [drawDate, setDrawDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [submitting, setSubmitting] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [formError, setFormError] = useState("");

    const todayStr = new Date().toISOString().split("T")[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const [pastFilterDate, setPastFilterDate] = useState(yesterdayStr);
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
        setArea("");
        setWinningNumber("");
        setDrawDate(new Date().toISOString().split("T")[0]);
        setFormError("");
    };

    const postedAreaTimeCombinations = useMemo(() => {
        return new Set(
            results
                .filter((r) => {
                    const rDate = r.draw_date
                        ? new Date(r.draw_date).toLocaleDateString("en-CA")
                        : "";
                    return rDate === drawDate && r.game_type === gameType;
                })
                .map((r) => `${r.draw_label}|${r.area}`)
        );
    }, [results, drawDate, gameType]);

    const todayResults = useMemo(() => {
        return results.filter((r) => {
            const rDate = r.draw_date
                ? new Date(r.draw_date).toLocaleDateString("en-CA")
                : "";
            return rDate === todayStr;
        });
    }, [results, todayStr]);

    const pastResults = useMemo(() => {
        return results.filter((r) => {
            const rDate = r.draw_date
                ? new Date(r.draw_date).toLocaleDateString("en-CA")
                : "";
            return rDate === pastFilterDate;
        });
    }, [results, pastFilterDate]);

    const areaOptions = useMemo(() => {
        if (gameType === "3D") return ["National"];
        return ["Local CDO", "Local MISOR"];
    }, [gameType]);

    /* Auto-select the first unposted draw time when game type or posted labels change */
    useEffect(() => {
        const available = GAME_TIMES[gameType].filter((t) => {
            const drawLabel = `${gameType} ${t.value}`;
            const allAreasPosted = areaOptions.every(
                (area) => postedAreaTimeCombinations.has(`${drawLabel}|${area}`)
            );
            return !allAreasPosted;
        });
        if (available.length > 0) {
            const currentStillAvailable = available.some((t) => t.value === drawTime);
            if (!currentStillAvailable) {
                setDrawTime(available[0].value);
            }
        }
    }, [gameType, postedAreaTimeCombinations, areaOptions, drawTime]);

    /* Auto-switch to unposted area when current area is already posted for selected draw time */
    useEffect(() => {
        if (!drawTime || areaOptions.length === 0) return;
        const unpostedAreas = areaOptions.filter(
            (a) => !postedAreaTimeCombinations.has(`${gameType} ${drawTime}|${a}`)
        );
        if (unpostedAreas.length === 1) {
            setArea(unpostedAreas[0]);
        } else if (unpostedAreas.length === 0) {
            setArea("");
        }
    }, [gameType, drawTime, areaOptions, postedAreaTimeCombinations]);

    const handleGameTypeChange = (gt: "STL" | "3D") => {
        setGameType(gt);
        setArea(gt === "3D" ? "National" : "");
    };

    const handleSubmit = async () => {
        if (!winningNumber.trim()) {
            setFormError("Winning number is required.");
            return;
        }
        if (gameType === "STL" && !area) {
            setFormError("Please select an area.");
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
            setShowSaveConfirm(false);
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
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Draw Time <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {GAME_TIMES[gameType].map((t) => {
                                const drawLabel = `${gameType} ${t.value}`;
                                const allAreasPosted = areaOptions.every(
                                    (area) => postedAreaTimeCombinations.has(`${drawLabel}|${area}`)
                                );
                                const isPosted = allAreasPosted;
                                return (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => !isPosted && setDrawTime(t.value)}
                                        disabled={isPosted}
                                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                            drawTime === t.value && !isPosted
                                                ? "bg-teal-dark text-white shadow"
                                                : isPosted
                                                    ? "border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed line-through"
                                                    : "border border-warm bg-card text-ink-muted hover:bg-slate-50"
                                        }`}
                                    >
                                        <span className="inline-flex items-center gap-1.5">
                                            {isPosted && <Check className="h-3 w-3" />}
                                            {t.label}
                                            {isPosted && <span className="text-[9px] font-normal normal-case">Posted</span>}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Area {gameType === "STL" && <span className="text-red-500">*</span>}
                        </label>
                        <select
                            value={area}
                            onChange={(e) => setArea(e.target.value)}
                            disabled={gameType === "3D" || !!areaOptions.find((a) => {
                                const combination = `${gameType} ${drawTime}|${a}`;
                                return postedAreaTimeCombinations.has(combination);
                            })}
                            className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 ${
                                gameType === "3D"
                                    ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                                    : areaOptions.some((a) => {
                                        const combination = `${gameType} ${drawTime}|${a}`;
                                        return postedAreaTimeCombinations.has(combination);
                                    })
                                        ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                                        : "border-warm bg-card text-ink focus:border-teal"
                            }`}
                        >
                            <option value="" disabled>-- Select Area --</option>
                            {areaOptions.map((a) => {
                                const combination = `${gameType} ${drawTime}|${a}`;
                                const isPosted = postedAreaTimeCombinations.has(combination);
                                return (
                                    <option key={a} value={a} disabled={isPosted}>
                                        {a} {isPosted && "(Posted)"}
                                    </option>
                                );
                            })}
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
                        onClick={() => setShowSaveConfirm(true)}
                        disabled={submitting || !winningNumber.trim()}
                        className="flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-ink shadow transition hover:bg-teal-dark disabled:opacity-50"
                    >
                        <Send size={14} />
                        {submitting ? "Posting…" : "Post Result"}
                    </button>
                </div>

                {/* ── Today's Results Panel ── */}
                <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl border border-warm bg-white/60 shadow-sm">
                    <div className="p-3 border-b border-warm/20">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-dark">
                            Today's Results
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                        {loading ? (
                            <div className="flex items-center justify-center py-6">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
                            </div>
                        ) : todayResults.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-ink-subtle">
                                <Trophy size={22} className="opacity-30" />
                                <p className="text-xs">No results for today.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {todayResults.map((r) => (
                                    <ResultCard key={r.id} result={r} onDelete={askDelete} fmtDate={fmtDate} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Past Results Panel ── */}
                <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl border border-warm bg-white/60 shadow-sm">
                    <div className="p-3 border-b border-warm/20 space-y-2">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70">
                            Past Results
                        </h3>
                        <input
                            type="date"
                            value={pastFilterDate}
                            onChange={(e) => setPastFilterDate(e.target.value)}
                            className="h-8 w-full rounded-lg border border-warm bg-card px-2 text-xs text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                        {loading ? (
                            <div className="flex items-center justify-center py-6">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
                            </div>
                        ) : pastResults.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-ink-subtle">
                                <Trophy size={22} className="opacity-30" />
                                <p className="text-xs">No results for this date.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {pastResults.map((r) => (
                                    <ResultCard key={r.id} result={r} onDelete={askDelete} fmtDate={fmtDate} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmationModal
                open={showSaveConfirm}
                title="Post this result?"
                confirmLabel="Post Result"
                isLoading={submitting}
                loadingLabel="Posting..."
                onCancel={() => setShowSaveConfirm(false)}
                onConfirm={handleSubmit}
            >
                <div className="divide-y divide-warm/60">
                    <SummaryRow label="Game Type" value={gameType} />
                    <SummaryRow label="Draw Time" value={GAME_TIMES[gameType].find((t) => t.value === drawTime)?.label || drawTime} />
                    <SummaryRow label="Area" value={area} />
                    <SummaryRow label="Winning Number" value={winningNumber.trim() || "—"} />
                    <SummaryRow label="Draw Date" value={drawDate ? new Date(drawDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"} />
                </div>
            </ConfirmationModal>

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

function ResultCard({ result, onDelete, fmtDate }: { result: LotteryResult; onDelete: (id: number) => void; fmtDate: (iso: string | null) => string }) {
    return (
        <div className="rounded-xl border border-warm bg-white p-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                result.game_type === "3D"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-teal/15 text-teal-dark"
                            }`}
                        >
                            {result.game_type}
                        </span>
                        <span className="text-sm font-semibold text-ink">{result.draw_label}</span>
                        <span className="text-[10px] text-ink-subtle">{result.area}</span>
                    </div>
                    <p className="mt-0.5 text-lg font-bold text-ink-muted">{result.winning_number}</p>
                    <div className="mt-1 text-[10px] text-ink-subtle">
                        {fmtDate(result.created_at)}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onDelete(result.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="font-medium text-ink-muted">{label}</span>
            <span className="font-semibold text-ink">{value}</span>
        </div>
    );
}
