import { useCallback, useEffect, useState } from "react";
import { TrendingUp, Shield, Save, Send, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { ConfirmationModal, Toast } from "../../../shared/components";
import {
    fetchLandingPageContent,
    updateLandingPageContent,
} from "../services/landingPage";

interface Badge {
    icon: "trending" | "shield";
    text: string;
}

const DEFAULT_BADGES: Badge[] = [
    { icon: "trending", text: "" },
    { icon: "shield", text: "" },
];

/* Default title currently shown on the live landing-page About Us section.
   Used as a fallback in the preview so the admin always sees the real
   "current status" even before the section has been saved. */
const DEFAULT_ABOUT_TITLE = "About Hexaprime";

export default function AboutUs() {
    const { user } = useAuth();
    const userId = user?.id;

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Saved content (for preview)
    const [savedTitle, setSavedTitle] = useState("");
    const [savedDescription, setSavedDescription] = useState("");
    const [savedBadges, setSavedBadges] = useState<Badge[]>(DEFAULT_BADGES);

    // Form fields
    const [sectionTitle, setSectionTitle] = useState("");
    const [sectionDescription, setSectionDescription] = useState("");
    const [badges, setBadges] = useState<Badge[]>(DEFAULT_BADGES);

    // UI state
    const [showConfirm, setShowConfirm] = useState(false);
    const [formError, setFormError] = useState("");
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
        setError("");
        try {
            const data = await fetchLandingPageContent("about-us");
            if (data) {
                setSectionTitle(data.title || "");
                setSectionDescription(data.description || "");

                // Parse badges from content if available
                if (data.content) {
                    try {
                        const parsed = JSON.parse(data.content);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setBadges(parsed);
                        }
                    } catch {
                        setBadges(DEFAULT_BADGES);
                    }
                } else {
                    setBadges(DEFAULT_BADGES);
                }

                // Update preview
                setSavedTitle(data.title || "");
                setSavedDescription(data.description || "");
                setSavedBadges(badges);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        }
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    const updateBadge = (index: number, field: keyof Badge, value: string) => {
        setBadges((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const addBadge = () => {
        setBadges((prev) => [...prev, { ...DEFAULT_BADGES[0] }]);
    };

    const removeBadge = (index: number) => {
        setBadges((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!sectionTitle.trim() && !sectionDescription.trim()) {
            setFormError("Please provide at least a title or description.");
            return;
        }
        setShowConfirm(true);
    };

    const confirmSave = async () => {
        if (!userId) return;
        setSaving(true);
        setFormError("");
        try {
            // Filter out empty badges
            const validBadges = badges.filter((b) => b.text.trim());

            await updateLandingPageContent(
                "about-us",
                {
                    title: sectionTitle.trim(),
                    description: sectionDescription.trim(),
                    content: JSON.stringify(validBadges),
                },
                userId
            );
            showToast("About Us section updated successfully.", "success");
            // Update preview
            setSavedTitle(sectionTitle.trim());
            setSavedDescription(sectionDescription.trim());
            setSavedBadges(validBadges);
            await load();
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Failed to save");
        } finally {
            setSaving(false);
            setShowConfirm(false);
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            <div className="flex items-center gap-2">
                <Save size={20} className="text-teal-dark" />
                <h1 className="text-lg font-bold text-ink">About Us Page</h1>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    <span>{error}</span>
                </div>
            )}

            <div className="flex flex-1 min-h-0 gap-4 lg:flex-row flex-col">
                {/* Composer */}
                <div className="lg:w-[480px] xl:w-[520px] shrink-0 overflow-y-auto rounded-2xl border border-warm bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-semibold text-ink">Edit About Us Section</h2>

                    {formError && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                            {formError}
                        </div>
                    )}

                    {/* Section Title */}
                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Section Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={sectionTitle}
                            onChange={(e) => setSectionTitle(e.target.value)}
                            placeholder="e.g. About Hexaprime"
                            maxLength={255}
                            className="w-full rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    {/* Section Description */}
                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Company Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={sectionDescription}
                            onChange={(e) => setSectionDescription(e.target.value)}
                            placeholder="Tell your company's story and mission..."
                            rows={5}
                            className="w-full resize-y rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    {/* Badges */}
                    <div className="mb-5">
                        <div className="mb-2 flex items-center justify-between">
                            <label className="text-xs font-medium text-ink">Trust Badges</label>
                            <button
                                type="button"
                                onClick={addBadge}
                                className="flex items-center gap-1 rounded-lg bg-teal/10 px-2 py-1 text-xs font-semibold text-teal-dark transition hover:bg-teal/20"
                            >
                                <Plus size={12} />
                                Add Badge
                            </button>
                        </div>

                        {badges.map((badge, index) => (
                            <div key={index} className="mb-2 flex items-center gap-2">
                                <select
                                    value={badge.icon}
                                    onChange={(e) => updateBadge(index, "icon", e.target.value as "trending" | "shield")}
                                    className="rounded-lg border border-warm bg-white px-2 py-1.5 text-xs text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                >
                                    <option value="trending">Trending Icon</option>
                                    <option value="shield">Shield Icon</option>
                                </select>
                                <input
                                    type="text"
                                    value={badge.text}
                                    onChange={(e) => updateBadge(index, "text", e.target.value)}
                                    placeholder="e.g. Trusted by 15+ LGUs"
                                    className="flex-1 rounded-lg border border-warm bg-white px-2 py-1.5 text-xs text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                />
                                {badges.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeBadge(index)}
                                        className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                        title="Remove"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Action */}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-ink shadow transition hover:bg-teal-dark disabled:opacity-50"
                    >
                        <Send size={14} />
                        {saving ? "Saving…" : "Save Changes"}
                    </button>
                </div>

                {/* Preview panel */}
                <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl border border-warm bg-white/60 p-5 shadow-sm">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70 mb-3">
                        Current Status
                    </h3>
                    <div className="flex-1 overflow-y-auto">
                        <div className="rounded-xl border border-warm bg-white p-4 shadow-xs">
                            <h3 className="text-lg font-bold text-ink leading-snug">{savedTitle || DEFAULT_ABOUT_TITLE}</h3>
                            <p className="mt-1 text-sm text-ink-muted leading-relaxed">{savedDescription || "Section description..."}</p>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {savedBadges.filter(b => b.text).map((badge, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2 rounded-full bg-teal/10 px-3 py-1.5 text-xs font-medium text-ink"
                                        style={{ border: "1px solid rgba(146, 199, 207, 0.2)" }}
                                    >
                                        {badge.icon === "trending" ? (
                                            <TrendingUp size={14} style={{ color: "#92C7CF" }} />
                                        ) : (
                                            <Shield size={14} style={{ color: "#92C7CF" }} />
                                        )}
                                        {badge.text}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                open={showConfirm}
                title="Save Changes?"
                message="This will update the About Us section of the landing page."
                confirmLabel="Save"
                isLoading={saving}
                loadingLabel="Saving..."
                onCancel={() => setShowConfirm(false)}
                onConfirm={confirmSave}
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