import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, X, Send, Save } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { ConfirmationModal, Toast } from "../../../shared/components";
import {
    fetchLandingPageContent,
    updateLandingPageContent,
    deleteLandingPageImage,
} from "../services/landingPage";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

interface SelectedMedia {
    file: File;
    preview: string;
}

export default function HomeAdminPage() {
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
    const [serverMedia, setServerMedia] = useState<string[]>([]);
    const [formError, setFormError] = useState("");

    // UI state
    const [showConfirm, setShowConfirm] = useState(false);
    const [toast, setToast] = useState<{ open: boolean; message: string; type: "success" | "error" }>({
        open: false,
        message: "",
        type: "success",
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

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
                setHeroTitle(data.title || "");
                setHeroDescription(data.description || "");
                setServerMedia(data.image_urls || []);
                // Update preview with saved data
                setSavedTitle(data.title || "");
                setSavedDescription(data.description || "");
                setSavedImages(data.image_urls || []);
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
        const next: SelectedMedia[] = [];
        for (const file of Array.from(files)) {
            const okImage = /image\/(jpe?g|png)/i.test(file.type);
            const okVideo = /video\/mp4/i.test(file.type);
            if (okImage || okVideo) {
                next.push({ file, preview: URL.createObjectURL(file) });
            }
        }
        setMedia((prev) => [...prev, ...next].slice(0, 10));
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeMedia = (index: number) => {
        setMedia((prev) => {
            const target = prev[index];
            if (target) URL.revokeObjectURL(target.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const removeServerMedia = (index: number) => {
        setServerMedia((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!heroTitle.trim() && !heroDescription.trim() && serverMedia.length === 0 && media.length === 0) {
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
            await updateLandingPageContent(
                "home",
                {
                    title: heroTitle.trim(),
                    description: heroDescription.trim(),
                    existingImages: serverMedia,
                    images: media.map((m) => m.file),
                },
                userId
            );
            showToast("Home section updated successfully.", "success");
            // Update preview with new data
            setSavedTitle(heroTitle.trim());
            setSavedDescription(heroDescription.trim());
            setSavedImages([...serverMedia, ...media.map((m) => `/uploads/${m.file.name}`)]);
            setServerMedia((prev) => [...prev, ...media.map((m) => `/uploads/${m.file.name}`)]);
            media.forEach((m) => URL.revokeObjectURL(m.preview));
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
            setSavedImages((prev) => prev.filter((u) => u !== url));
            removeServerMedia(serverMedia.indexOf(url));
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
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                {media.map((m, i) => (
                                    <div key={m.preview} className="group relative aspect-square overflow-hidden rounded-lg border-2 border-warm bg-black/5">
                                        <div className="absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-bold text-white">
                                            {i + 1}
                                        </div>
                                        {m.file.type.startsWith("video") ? (
                                            <video src={m.preview} className="h-full w-full object-cover" />
                                        ) : (
                                            <img src={m.preview} alt="preview" className="h-full w-full object-cover" />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeMedia(i)}
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
                            Up to 10 images (JPG/PNG) or MP4 videos, 10 MB each.
                        </p>
                    </div>

                    {/* Existing server media */}
                    {serverMedia.length > 0 && (
                        <div className="mb-4">
                            <label className="mb-1 block text-xs font-medium text-ink">Current Images</label>
                            <div className="grid grid-cols-3 gap-2">
                                {serverMedia.map((url, i) => (
                                    <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border-2 border-warm bg-black/5">
                                        <div className="absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-bold text-white">
                                            {i + 1}
                                        </div>
                                        {/\.mp4$/i.test(url) ? (
                                            <video src={`${API_BASE}${url}`} className="h-full w-full object-cover" />
                                        ) : (
                                            <img src={`${API_BASE}${url}`} alt="current" className="h-full w-full object-cover" />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteImage(url)}
                                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                                            title="Remove"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action */}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || (!heroTitle.trim() && !heroDescription.trim())}
                        className="flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-ink shadow transition hover:bg-teal-dark disabled:opacity-50"
                    >
                        <Send size={14} />
                        {saving ? "Saving…" : "Save Changes"}
                    </button>
                </div>

                {/* Preview panel */}
                <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl border border-warm bg-white/60 p-5 shadow-sm">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted/70 mb-3">
                        Current Preview
                    </h3>
                    <div className="flex-1 overflow-y-auto">
                        <div className="rounded-xl border border-warm bg-white p-4 shadow-xs">
                            <h3 className="text-lg font-bold text-ink line-clamp-2">{savedTitle || "Hero Title"}</h3>
                            <p className="mt-1 text-sm text-ink-muted line-clamp-3">{savedDescription || "Hero description will appear here..."}</p>
                            {savedImages.length > 0 && (
                                <div className="mt-3 flex gap-2 overflow-x-auto">
                                    {savedImages.slice(0, 5).map((url) => (
                                        <img key={url} src={`${API_BASE}${url}`} alt="" className="h-16 w-16 rounded-lg object-cover" />
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