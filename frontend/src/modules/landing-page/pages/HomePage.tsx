import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Pencil, X, Send, Save } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { ConfirmationModal, Toast } from "../../../shared/components";
import {
    fetchLandingPageContent,
    updateLandingPageContent,
    deleteLandingPageImage,
} from "../services/landingPage";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/* Default hero copy that is currently shown on the live landing page.
   Used as a fallback in the preview so the admin always sees the real
   "current status" even before the Home section has been saved. */
const DEFAULT_HERO_TITLE = "Sharing Care Beyond the line with Hexaprime";
const DEFAULT_HERO_DESCRIPTION =
    "Building secure, transparent STL systems that uplift communities across the Philippines through responsible gaming and social responsibility.";

interface SelectedMedia {
    file: File;
    preview: string;
}

export default function HomePage() {
    const { user } = useAuth();
    const userId = user?.id;

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Saved content (for preview)
    const [savedTitle, setSavedTitle] = useState("");
    const [savedDescription, setSavedDescription] = useState("");
    const [savedImages, setSavedImages] = useState<string[]>([]);

    // Form fields
    const [heroTitle, setHeroTitle] = useState("");
    const [heroDescription, setHeroDescription] = useState("");
    const [media, setMedia] = useState<SelectedMedia[]>([]);
    const [formError, setFormError] = useState("");

    // UI state
    const [showConfirm, setShowConfirm] = useState(false);
    const [toast, setToast] = useState<{ open: boolean; message: string; type: "success" | "error" }>({
        open: false,
        message: "",
        type: "success",
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const heroTitleInputRef = useRef<HTMLInputElement>(null);

    const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
        setToast({ open: true, message, type });
    }, []);
    const hideToast = useCallback(() => setToast((p) => ({ ...p, open: false })), []);

    const load = useCallback(async () => {
        if (!userId) return;
        setError("");
        try {
            const data = await fetchLandingPageContent("home");
            if (data) {
                setSavedTitle(data.title || "");
                setSavedDescription(data.description || "");
                setSavedImages(data.image_urls || []);
            } else {
                setSavedTitle("");
                setSavedDescription("");
                setSavedImages([]);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        }
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    // Revoke object URLs on unmount
    useEffect(() => {
        return () => {
            media.forEach((m) => URL.revokeObjectURL(m.preview));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        const availableSlots = Math.max(0, 5 - savedImages.length - media.length);
        if (availableSlots === 0) {
            setFormError("Home media is limited to 5 items. Remove an existing item first.");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        const next: SelectedMedia[] = [];
        for (const file of Array.from(files)) {
            const okImage = /image\/(jpe?g|png)/i.test(file.type);
            const okVideo = /video\/mp4/i.test(file.type);
            if (okImage || okVideo) {
                next.push({ file, preview: URL.createObjectURL(file) });
            }
        }
        const accepted = next.slice(0, availableSlots);
        next.slice(availableSlots).forEach((item) => URL.revokeObjectURL(item.preview));
        setMedia((previous) => [...previous, ...accepted]);
        setFormError(next.length > availableSlots ? "Only 5 total Home media items are allowed." : "");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeMedia = (index: number) => {
        setMedia((prev) => {
            const target = prev[index];
            if (target) URL.revokeObjectURL(target.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleEditCurrentStatus = () => {
        setHeroTitle(savedTitle || DEFAULT_HERO_TITLE);
        setHeroDescription(savedDescription || DEFAULT_HERO_DESCRIPTION);
        setFormError("");

        requestAnimationFrame(() => {
            heroTitleInputRef.current?.focus();
            heroTitleInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    };

    const handleSave = async () => {
        if (!heroTitle.trim() && !heroDescription.trim() && media.length === 0) {
            setFormError("Please provide at least some content.");
            return;
        }
        setShowConfirm(true);
    };

    const confirmSave = async () => {
        if (!userId) return;
        setSaving(true);
        setFormError("");
        try {
            const title = heroTitle.trim();
            const description = heroDescription.trim();
            const response = await updateLandingPageContent(
                "home",
                {
                    ...(title ? { title } : {}),
                    ...(description ? { description } : {}),
                    existingImages: savedImages,
                    images: media.map((m) => m.file),
                },
                userId
            );
            showToast("Home section updated successfully.", "success");
            // Update preview with new data from backend response
            setSavedTitle(response.title || "");
            setSavedDescription(response.description || "");
            setSavedImages(response.image_urls || []);
            media.forEach((m) => URL.revokeObjectURL(m.preview));
            // Clear the composer form so the inputs reset after saving
            setHeroTitle("");
            setHeroDescription("");
            setMedia([]);
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Failed to save");
        } finally {
            setSaving(false);
            setShowConfirm(false);
        }
    };

    const handleDeleteImage = async (url: string) => {
        try {
            await deleteLandingPageImage("home", url);
            showToast("Image removed.", "success");
            await load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Failed to delete image", "error");
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            <div className="flex items-center gap-2">
                <Save size={20} className="text-teal-dark" />
                <h1 className="text-lg font-bold text-ink">Home Page</h1>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    <span>{error}</span>
                </div>
            )}

            <div className="flex flex-1 min-h-0 gap-4 lg:flex-row flex-col">
                {/* Composer */}
                <div className="lg:w-[480px] xl:w-[520px] shrink-0 overflow-y-auto rounded-2xl border border-warm bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-semibold text-ink">Edit Home Section</h2>

                    {formError && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                            {formError}
                        </div>
                    )}

                    {/* Hero Title */}
                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Hero Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            ref={heroTitleInputRef}
                            type="text"
                            value={heroTitle}
                            onChange={(e) => setHeroTitle(e.target.value)}
                            placeholder="e.g. Sharing Care Beyond the line with Hexaprime"
                            maxLength={255}
                            className="w-full rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    {/* Hero Description */}
                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-ink">
                            Hero Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={heroDescription}
                            onChange={(e) => setHeroDescription(e.target.value)}
                            placeholder="Brief description shown on the hero section..."
                            rows={4}
                            className="w-full resize-y rounded-xl border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                        />
                    </div>

                    {/* Photo/Video upload */}
                    <div className="mb-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,video/mp4"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-warm bg-card px-3 py-3 text-sm font-medium text-teal-dark transition hover:bg-teal/10"
                        >
                            <ImagePlus size={16} />
                            Add Photos / Video
                        </button>

                        {media.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                {media.map((item, index) => (
                                <div key={item.preview} className="group relative aspect-video w-full overflow-hidden rounded-lg border-2 border-warm bg-black/5">
                                    {item.file.type.startsWith("video") ? (
                                        <video src={item.preview} className="h-full w-full object-contain" controls />
                                    ) : (
                                        <img src={item.preview} alt={`New media ${index + 1}`} className="h-full w-full object-contain" />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeMedia(index)}
                                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                                        title="Remove"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                                ))}
                            </div>
                        )}
                        <p className="mt-1 text-[10px] text-ink-subtle">
                            Up to 5 total JPG, PNG, or MP4 files, 10 MB each. {savedImages.length}/5 currently saved.
                        </p>
                    </div>

                    {/* Action */}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || (!heroTitle.trim() && !heroDescription.trim() && media.length === 0)}
                        className="flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-ink shadow transition hover:bg-teal-dark disabled:opacity-50"
                    >
                        <Send size={14} />
                        {saving ? "Saving…" : "Save Changes"}
                    </button>
                </div>

                {/* Preview panel */}
                <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl border border-warm bg-white/60 p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70">
                            Current Status
                        </h3>
                        <button
                            type="button"
                            onClick={handleEditCurrentStatus}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal/10 px-3 py-1.5 text-xs font-semibold text-teal-dark transition hover:bg-teal/20 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Edit current Home content"
                        >
                            <Pencil size={13} />
                            Edit
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <div className="rounded-xl border border-warm bg-white p-4 shadow-xs">
                            {/* Hero title — highlight the "Hexaprime" portion in brand teal */}
                            <h3 className="text-lg font-bold text-ink leading-snug">
                                {(savedTitle || DEFAULT_HERO_TITLE)
                                    .split(/(Hexaprime)/)
                                    .map((part, i) =>
                                        part === "Hexaprime" ? (
                                            <span key={i} style={{ color: "#AAD7D9" }}>{part}</span>
                                        ) : (
                                            <span key={i}>{part}</span>
                                        )
                                    )}
                            </h3>
                            <p className="mt-1 text-sm text-ink-muted leading-relaxed">
                                {savedDescription || DEFAULT_HERO_DESCRIPTION}
                            </p>
                            {savedImages.length > 0 && (
                                <div className="mt-3 flex gap-2 overflow-x-auto">
                                    {savedImages.slice(0, 5).map((url, index) => (
                                        <div key={url} className="group relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-black/5">
                                            {/\.mp4(?:$|\?)/i.test(url) ? (
                                                <video src={`${API_BASE}${url}`} className="h-full w-full object-cover" muted controls />
                                            ) : (
                                                <img src={`${API_BASE}${url}`} alt={`Saved media ${index + 1}`} className="h-full w-full object-cover" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteImage(url)}
                                                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                                                title="Remove saved media"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                open={showConfirm}
                title="Save Changes?"
                message="This will update the Home section of the landing page."
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
