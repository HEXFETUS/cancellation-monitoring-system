import { useCallback, useRef, useState } from "react";
import { Send, ImagePlus, Smile, X } from "lucide-react";
import EmojiPicker from "./EmojiPicker";

type MessageInputProps = {
    onSend: (text: string, attachmentUrls: string[]) => void;
    sending?: boolean;
    disabled?: boolean;
    placeholder?: string;
    onError?: (msg: string) => void;
};

export default function MessageInput({ onSend, sending, disabled, placeholder, onError }: MessageInputProps) {
    const [text, setText] = useState("");
    const [preview, setPreview] = useState<{ url: string; file?: File } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

    const handleSend = useCallback(async () => {
        if (sending || disabled) return;
        const trimmed = text.trim();
        if (!trimmed && !preview) return;

        let attachmentUrls: string[] = [];
        if (preview) {
            if (preview.file) {
                setUploading(true);
                try {
                    const form = new FormData();
                    form.append("file", preview.file);
                    const res = await fetch(`${API_BASE_URL}/api/upload`, { method: "POST", body: form });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        const msg = err.error === "FILE_TOO_LARGE" ? "File is too large (max 5MB)" : "Upload failed";
                        onError?.(msg);
                        setUploading(false);
                        return;
                    }
                    const data = await res.json();
                    attachmentUrls = [data.url];
                } catch (err) {
                    onError?.(err instanceof Error ? err.message : "Upload failed");
                    setUploading(false);
                    return;
                }
                setUploading(false);
            } else {
                attachmentUrls = [preview.url];
            }
        }

        onSend(trimmed, attachmentUrls);
        setText("");
        setPreview(null);
    }, [text, preview, sending, disabled, onSend, API_BASE_URL]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
        if (!allowed.includes(file.type)) {
            onError?.("Invalid file type. Allowed: jpg, jpeg, png, webp, gif");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            onError?.("File is too large. Max size is 5MB.");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setPreview({ url: reader.result as string, file });
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const canSend = (!!text.trim() || !!preview) && !sending && !disabled && !uploading;

    return (
        <div className="flex flex-col gap-1">
            {preview && (
                <div className="relative inline-flex self-start items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                    <img src={preview.url} alt="Preview" className="h-16 w-16 rounded-lg object-cover" />
                    <button
                        type="button"
                        onClick={() => setPreview(null)}
                        className="absolute -top-1.5 -right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                        title="Remove image"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}
            <div className="flex items-center gap-1.5">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleFileChange}
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || disabled}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-40"
                    title="Attach image"
                >
                    <ImagePlus className="h-4 w-4" />
                </button>
                <div className="relative flex-1">
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                        <input
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder ?? "Type a message..."}
                            disabled={sending || disabled}
                            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none disabled:opacity-50 min-w-0"
                        />
                        <button
                            type="button"
                            onClick={() => setShowEmoji((v) => !v)}
                            disabled={sending || disabled}
                            className="shrink-0 text-slate-400 hover:text-slate-600 disabled:opacity-40"
                            title="Emoji"
                        >
                            <Smile className="h-4 w-4" />
                        </button>
                    </div>
                    {showEmoji && (
                        <EmojiPicker
                            onSelect={(em) => setText((t) => t + em)}
                            onClose={() => setShowEmoji(false)}
                        />
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={!canSend}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-[#92C7CF] text-white hover:bg-[#7FB8C0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Send"
                >
                    <Send className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}