import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Save, Send } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { ConfirmationModal, Toast } from "../../../shared/components";
import {
    fetchLandingPageContent,
    updateLandingPageContent,
    type LandingPageContent,
} from "../services/landingPage";

interface ImpactItem {
    title: string;
    description: string;
    peopleHelped: string;
    location: string;
}

interface StatItem {
    id: string;
    label: string;
    value: string;
}

const DEFAULT_IMPACT: ImpactItem[] = [
    {
        title: "",
        description: "",
        peopleHelped: "",
        location: "",
    },
];

const DEFAULT_STATS = {
    "Communities Served": "",
    "Individuals Helped": "",
    "Years of Service": "",
    "Partner LGUs": "",
};

/* Default copy currently shown on the live landing-page Social Responsibility
   section. Used as a fallback in the preview so the admin always sees the
   real "current status" even before the section has been saved. */
const DEFAULT_SR_TITLE = "Social Responsibility";
const DEFAULT_SR_DESCRIPTION =
    "Committed to giving back to the communities we serve through meaningful disaster relief and support programs.";

function getDefaultImpact(): ImpactItem[] {
    return DEFAULT_IMPACT.map((item) => ({ ...item }));
}

function normalizeImpactItems(content: string | null): ImpactItem[] {
    if (!content) return getDefaultImpact();

    try {
        const parsed: unknown = JSON.parse(content);
        if (!Array.isArray(parsed) || parsed.length === 0) return getDefaultImpact();

        return parsed.map((item) => {
            const impact = item && typeof item === "object"
                ? item as Partial<Record<keyof ImpactItem, unknown>>
                : {};

            return {
                title: typeof impact.title === "string" ? impact.title : "",
                description: typeof impact.description === "string" ? impact.description : "",
                peopleHelped: typeof impact.peopleHelped === "string" ? impact.peopleHelped : "",
                location: typeof impact.location === "string" ? impact.location : "",
            };
        });
    } catch {
        return getDefaultImpact();
    }
}

function getDefaultStats(): StatItem[] {
    return Object.entries(DEFAULT_STATS).map(([label, value], index) => ({
        id: `default-stat-${index}`,
        label,
        value,
    }));
}

function normalizeStats(value: LandingPageContent["stats"]): StatItem[] {
    const rows = value && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(value)
            .filter((entry): entry is [string, string] => typeof entry[1] === "string")
            .map(([label, statValue], index) => ({
                id: `saved-stat-${index}`,
                label,
                value: statValue,
            }))
        : [];

    const usedLabels = new Set(rows.map((row) => row.label.trim().toLocaleLowerCase()));
    for (const defaultRow of getDefaultStats()) {
        if (rows.length >= Object.keys(DEFAULT_STATS).length) break;

        const normalizedLabel = defaultRow.label.toLocaleLowerCase();
        if (!usedLabels.has(normalizedLabel)) {
            rows.push(defaultRow);
            usedLabels.add(normalizedLabel);
        }
    }

    return rows;
}

function statsToRecord(items: StatItem[]): Record<string, string> {
    return Object.fromEntries(items.map((item) => [item.label.trim(), item.value]));
}

function validateStats(items: StatItem[]): string | null {
    const labels = items.map((item) => item.label.trim());
    if (labels.some((label) => !label)) {
        return "Each impact statistic must have a label.";
    }

    const normalizedLabels = labels.map((label) => label.toLocaleLowerCase());
    if (new Set(normalizedLabels).size !== normalizedLabels.length) {
        return "Impact statistic labels must be unique.";
    }

    return null;
}

export default function SocialResponsibility() {
    const { user } = useAuth();
    const userId = user?.id;

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Saved content (for preview)
    const [savedTitle, setSavedTitle] = useState("");
    const [savedDescription, setSavedDescription] = useState("");
    const [savedImpact, setSavedImpact] = useState<ImpactItem[]>(DEFAULT_IMPACT);
    const [savedStats, setSavedStats] = useState<StatItem[]>(getDefaultStats);

    // Form fields
    const [sectionTitle, setSectionTitle] = useState("");
    const [sectionDescription, setSectionDescription] = useState("");
    const [impactItems, setImpactItems] = useState<ImpactItem[]>(DEFAULT_IMPACT);
    const [stats, setStats] = useState<StatItem[]>(getDefaultStats);

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

    const applyContent = useCallback((data: LandingPageContent) => {
        const loadedImpact = normalizeImpactItems(data.content);
        const loadedStats = normalizeStats(data.stats);
        const loadedTitle = data.title || "";
        const loadedDescription = data.description || "";

        setSectionTitle(loadedTitle);
        setSectionDescription(loadedDescription);
        setImpactItems(loadedImpact);
        setStats(loadedStats);
        setSavedTitle(loadedTitle);
        setSavedDescription(loadedDescription);
        setSavedImpact(loadedImpact);
        setSavedStats(loadedStats);
    }, []);

    const load = useCallback(async () => {
        if (!userId) return;
        setError("");
        try {
            const data = await fetchLandingPageContent("social-responsibility");
            if (data) {
                applyContent(data);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        }
    }, [applyContent, userId]);

    useEffect(() => {
        load();
    }, [load]);

    const updateImpactItem = (index: number, field: keyof ImpactItem, value: string) => {
        setImpactItems((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const addImpactItem = () => {
        setImpactItems((prev) => [...prev, { ...DEFAULT_IMPACT[0] }]);
    };

    const removeImpactItem = (index: number) => {
        setImpactItems((prev) => prev.filter((_, i) => i !== index));
    };

    const updateStat = (id: string, field: "label" | "value", value: string) => {
        setStats((prev) => prev.map((item) => (
            item.id === id ? { ...item, [field]: value } : item
        )));
    };

    const handleSave = async () => {
        if (!sectionTitle.trim() && !sectionDescription.trim()) {
            setFormError("Please provide at least a title or description.");
            return;
        }
        const statsError = validateStats(stats);
        if (statsError) {
            setFormError(statsError);
            return;
        }
        setFormError("");
        setShowConfirm(true);
    };

    const confirmSave = async () => {
        if (!userId) return;
        setSaving(true);
        setFormError("");
        try {
            const statsError = validateStats(stats);
            if (statsError) {
                setFormError(statsError);
                return;
            }

            // Filter out empty impact items
            const validImpact = impactItems.filter((item) => item.title.trim() || item.description.trim());

            const updatedContent = await updateLandingPageContent(
                "social-responsibility",
                {
                    title: sectionTitle.trim(),
                    description: sectionDescription.trim(),
                    content: JSON.stringify(validImpact),
                    stats: statsToRecord(stats),
                },
                userId
            );
            applyContent(updatedContent);
            showToast("Social Responsibility section updated successfully.", "success");
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
                <h1 className="text-lg font-bold text-ink">Social Responsibility Page</h1>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    <span>{error}</span>
                </div>
            )}

            <div className="flex flex-1 min-h-0 gap-4 lg:flex-row flex-col">
                {/* Composer */}
                <div className="lg:w-[480px] xl:w-[520px] shrink-0 overflow-y-auto rounded-2xl border border-warm bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-semibold text-ink">Edit Social Responsibility Section</h2>

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
                            placeholder="e.g. Social Responsibility"
                            maxLength={255}
                            className="w-full rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    {/* Section Description */}
                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Section Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={sectionDescription}
                            onChange={(e) => setSectionDescription(e.target.value)}
                            placeholder="Brief description of your social responsibility programs..."
                            rows={3}
                            className="w-full resize-y rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    {/* Impact Items */}
                    <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between">
                            <label className="text-xs font-medium text-ink">Impact Stories</label>
                            <button
                                type="button"
                                onClick={addImpactItem}
                                className="flex items-center gap-1 rounded-lg bg-teal/10 px-2 py-1 text-xs font-semibold text-teal-dark transition hover:bg-teal/20"
                            >
                                <Plus size={12} />
                                Add Story
                            </button>
                        </div>

                        {impactItems.map((item, index) => (
                            <div key={index} className="mb-3 rounded-xl border border-warm bg-card p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-ink-muted">Story #{index + 1}</span>
                                    {impactItems.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeImpactItem(index)}
                                            className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                            title="Remove"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={item.title}
                                        onChange={(e) => updateImpactItem(index, "title", e.target.value)}
                                        placeholder="Title (e.g. Typhoon Relief Operations)"
                                        className="w-full rounded-lg border border-warm bg-white px-2 py-1.5 text-xs text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                    />
                                    <textarea
                                        value={item.description}
                                        onChange={(e) => updateImpactItem(index, "description", e.target.value)}
                                        placeholder="Description..."
                                        rows={2}
                                        className="w-full resize-y rounded-lg border border-warm bg-white px-2 py-1.5 text-xs text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            value={item.peopleHelped}
                                            onChange={(e) => updateImpactItem(index, "peopleHelped", e.target.value)}
                                            placeholder="People Helped (e.g. 2,450+ individuals)"
                                            className="rounded-lg border border-warm bg-white px-2 py-1.5 text-xs text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                        />
                                        <input
                                            type="text"
                                            value={item.location}
                                            onChange={(e) => updateImpactItem(index, "location", e.target.value)}
                                            placeholder="Location (e.g. Davao Region)"
                                            className="rounded-lg border border-warm bg-white px-2 py-1.5 text-xs text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Stats */}
                    <div className="mb-5">
                        <label className="mb-2 block text-xs font-medium text-ink">Impact Statistics</label>
                        <div className="space-y-2">
                            {stats.map((item) => (
                                <div key={item.id} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={item.label}
                                        onChange={(e) => updateStat(item.id, "label", e.target.value)}
                                        placeholder="Label"
                                        className="flex-1 rounded-lg border border-warm bg-white px-2 py-1.5 text-xs text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                    />
                                    <input
                                        type="text"
                                        value={item.value}
                                        onChange={(e) => updateStat(item.id, "value", e.target.value)}
                                        placeholder="Value"
                                        className="w-24 rounded-lg border border-warm bg-white px-2 py-1.5 text-xs text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                                    />
                                </div>
                            ))}
                        </div>
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
                            <h3 className="text-lg font-bold text-ink leading-snug">{savedTitle || DEFAULT_SR_TITLE}</h3>
                            <p className="mt-1 text-sm text-ink-muted leading-relaxed">{savedDescription || DEFAULT_SR_DESCRIPTION}</p>

                            <div className="mt-4 space-y-3">
                                {savedImpact.filter(i => i.title).map((item, i) => (
                                    <div key={i} className="rounded-lg border border-warm bg-card p-3">
                                        <h4 className="text-sm font-semibold text-ink">{item.title}</h4>
                                        <p className="mt-1 text-xs text-ink-muted">{item.description}</p>
                                        <div className="mt-2 flex gap-3 text-[10px] text-ink-subtle">
                                            <span>Helped: {item.peopleHelped || "—"}</span>
                                            <span>Location: {item.location || "—"}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                {savedStats.filter((item) => item.label && item.value).map((item) => (
                                    <div key={item.id} className="rounded-lg bg-teal/5 p-2 text-center">
                                        <p className="text-lg font-bold text-teal-dark">{item.value}</p>
                                        <p className="text-[10px] text-ink-muted">{item.label}</p>
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
                message="This will update the Social Responsibility section of the landing page."
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
