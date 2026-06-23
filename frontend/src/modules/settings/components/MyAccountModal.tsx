import { useEffect, useRef, useState } from "react";
import {
    Camera,
    Check,
    Eye,
    EyeOff,
    Key,
    Loader2,
    Pencil,
    Save,
    ShieldCheck,
    User,
    X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { Toast, type ToastType } from "../../../shared/components";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
function apiUrl(p: string) { return `${API_BASE_URL}${p}`; }

function resolveAvatarUrl(p?: string | null) {
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    return `${API_BASE_URL}${p}`;
}

interface Me {
    id: number;
    name: string;
    email: string;
    usertype: string;
    position?: string;
    department?: string;
    profile_picture?: string | null;
    operator_id?: number | null;
    operator_name?: string | null;
    parent_operator_id?: number | null;
    parent_operator_name?: string | null;
}

type ModalTab = "account" | "password";

interface MyAccountModalProps {
    open: boolean;
    onClose: () => void;
    initialTab?: ModalTab;
}

export default function MyAccountModal({ open, onClose, initialTab = "account" }: MyAccountModalProps) {
    const { user, updateUser } = useAuth();
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<ModalTab>("account");

    // Profile picture
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [uploadingPic, setUploadingPic] = useState(false);

    // Toast
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<ToastType>("error");
    const showToast = (message: string, type: ToastType = "error") => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    // Password change
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [showNewPwd, setShowNewPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);
    const [pwdMsg, setPwdMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
    const [changing, setChanging] = useState(false);

    // Account editing
    const [editing, setEditing] = useState(false);
    const [formDraft, setFormDraft] = useState({ name: "", email: "", position: "", department: "" });
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

    // Confirmation modal for save
    const [confirmSave, setConfirmSave] = useState(false);

    useEffect(() => {
        if (!open || !user?.id) return;
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError("");
                const res = await fetch(apiUrl(`/api/users/me?id=${user.id}`));
                if (!res.ok) throw new Error("Failed to load profile");
                const data = await res.json();
                if (!cancelled) setMe(data);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open, user?.id]);

    useEffect(() => {
        if (open) {
            setActiveTab(initialTab);
            setNewPwd("");
            setConfirmPwd("");
            setPwdMsg(null);
            setEditing(false);
            setSaveMsg(null);
            setConfirmSave(false);
        }
    }, [open, initialTab]);

    const startEditing = () => {
        if (!me) return;
        setFormDraft({
            name: me.name || "",
            email: me.email || "",
            position: me.position || "",
            department: me.department || "",
        });
        setSaveMsg(null);
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
        setSaveMsg(null);
    };

    const handleSaveClick = () => {
        setConfirmSave(true);
    };

    const confirmSaveData = async () => {
        if (!user?.id) return;
        setConfirmSave(false);
        setSaving(true);
        setSaveMsg(null);
        try {
            const res = await fetch(apiUrl(`/api/users/${user.id}`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formDraft.name.trim(),
                    email: formDraft.email.trim(),
                    position: formDraft.position.trim(),
                    department: formDraft.department.trim(),
                    user_id: user.id,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to save changes");
            setMe((prev) =>
                prev
                    ? {
                          ...prev,
                          name: formDraft.name.trim(),
                          email: formDraft.email.trim(),
                          position: formDraft.position.trim(),
                          department: formDraft.department.trim(),
                      }
                    : prev
            );
            setEditing(false);
            setSaveMsg({ kind: "ok", text: "Account details updated successfully." });
            showToast("Account details updated successfully.", "success");
        } catch (e) {
            setSaveMsg({ kind: "err", text: e instanceof Error ? e.message : "Failed to save changes" });
        } finally {
            setSaving(false);
        }
    };

    const MAX_PROFILE_PICTURE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_PROFILE_PICTURE_TYPES = /^image\/(jpe?g|png)$/i;
    const ALLOWED_PROFILE_PICTURE_ACCEPT = "image/jpeg,image/png";

    const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (!file || !user?.id) return;

        if (!ALLOWED_PROFILE_PICTURE_TYPES.test(file.type)) {
            showToast("Only JPG or PNG images are allowed.", "error");
            return;
        }
        if (file.size > MAX_PROFILE_PICTURE_SIZE) {
            showToast("Image is too large. Maximum file size is 5 MB.", "error");
            return;
        }

        setUploadingPic(true);
        try {
            const fd = new FormData();
            fd.append("profile_picture", file);
            const res = await fetch(apiUrl(`/api/users/${user.id}/profile-picture`), {
                method: "POST",
                body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to upload picture");

            const newUrl: string | null = data.profile_picture ?? null;
            setMe((prev) => (prev ? { ...prev, profile_picture: newUrl } : prev));
            updateUser({ profile_picture: newUrl });
            showToast("Profile picture updated.", "success");
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Failed to upload picture", "error");
        } finally {
            setUploadingPic(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdMsg(null);

        if (newPwd.trim().length < 6) {
            setPwdMsg({ kind: "err", text: "Password must be at least 6 characters." });
            return;
        }
        if (newPwd !== confirmPwd) {
            setPwdMsg({ kind: "err", text: "Passwords don't match." });
            return;
        }
        if (!user?.id) return;

        setChanging(true);
        try {
            const res = await fetch(apiUrl(`/api/users/${user.id}/password`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword: newPwd }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to change password");
            setNewPwd("");
            setConfirmPwd("");
            setPwdMsg({ kind: "ok", text: "Password changed successfully." });
        } catch (err) {
            setPwdMsg({ kind: "err", text: err instanceof Error ? err.message : "Failed to change password" });
        } finally {
            setChanging(false);
        }
    };

    if (!open) return null;

    return (
        <>
            {/* --- CONFIRMATION MODAL --- */}
            {confirmSave && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div
                        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-200/60 p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-ink mb-2">Save Changes?</h3>
                        <p className="text-sm text-ink-muted mb-6">
                            Are you sure you want to update your account details?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setConfirmSave(false)}
                                className="px-4 py-2 rounded-lg border border-warm bg-card text-sm font-medium text-ink-muted hover:bg-cream transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmSaveData}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal text-sm font-semibold text-ink hover:bg-teal-dark transition"
                            >
                                <Check size={16} />
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MAIN MODAL --- */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div
                    className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-gray-200/60"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-warm bg-white px-5 py-4 rounded-t-2xl">
                        <h2 className="text-lg font-bold text-ink">My Account</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-warm bg-card text-ink-subtle hover:bg-cream hover:text-ink transition"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Tab buttons */}
                    <div className="flex border-b border-warm px-5">
                        <button
                            type="button"
                            onClick={() => setActiveTab("account")}
                            className={`relative px-4 py-3 text-sm font-medium transition ${
                                activeTab === "account"
                                    ? "text-teal-700"
                                    : "text-ink-muted hover:text-ink"
                            }`}
                        >
                            Account
                            {activeTab === "account" && (
                                <span
                                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                                    style={{ background: "linear-gradient(90deg, #92C7CF, #AAD7D9)" }}
                                />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("password")}
                            className={`relative px-4 py-3 text-sm font-medium transition ${
                                activeTab === "password"
                                    ? "text-teal-700"
                                    : "text-ink-muted hover:text-ink"
                            }`}
                        >
                            Password
                            {activeTab === "password" && (
                                <span
                                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                                    style={{ background: "linear-gradient(90deg, #92C7CF, #AAD7D9)" }}
                                />
                            )}
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-5 py-5">
                        {error && (
                            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        {activeTab === "account" && (
                            <div className="space-y-5">
                                {/* Profile Picture Card */}
                                <section className="rounded-2xl border border-warm bg-card p-5 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            {(() => {
                                                const avatar = resolveAvatarUrl(me?.profile_picture);
                                                return avatar ? (
                                                    <img
                                                        src={avatar}
                                                        alt={me?.name || "Avatar"}
                                                        className="h-16 w-16 rounded-full object-cover ring-2 ring-warm"
                                                    />
                                                ) : (
                                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream text-teal ring-2 ring-warm">
                                                        <User size={28} />
                                                    </div>
                                                );
                                            })()}
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploadingPic}
                                                title="Change profile picture"
                                                className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal text-ink shadow-md ring-2 ring-card transition hover:bg-teal-dark disabled:opacity-50"
                                            >
                                                <Camera size={12} />
                                            </button>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept={ALLOWED_PROFILE_PICTURE_ACCEPT}
                                                className="hidden"
                                                onChange={handleProfilePictureChange}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-ink">Profile picture</p>
                                            <p className="text-xs text-ink-muted">
                                                JPG or PNG. Max 5 MB.
                                            </p>
                                            {uploadingPic && (
                                                <p className="mt-1 text-xs text-ink-subtle flex items-center gap-1">
                                                    <Loader2 size={12} className="animate-spin" />
                                                    Uploading...
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {/* Details Card */}
                                <section className="rounded-2xl border border-warm bg-card p-5 shadow-sm">
                                    {loading ? (
                                        <p className="text-sm text-ink-subtle">Loading...</p>
                                    ) : me ? (
                                        <>
                                            {/* Card header */}
                                            <div className="mb-5 flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream text-teal">
                                                        <User size={16} />
                                                    </div>
                                                    <h3 className="text-sm font-semibold text-ink">Account Details</h3>
                                                </div>
                                                {!editing && (
                                                    <button
                                                        type="button"
                                                        onClick={startEditing}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-card px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-cream hover:text-ink"
                                                    >
                                                        <Pencil size={13} />
                                                        Edit
                                                    </button>
                                                )}
                                            </div>

                                            {saveMsg && (
                                                <div
                                                    className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                                                        saveMsg.kind === "ok"
                                                            ? "border-teal/30 bg-teal/10 text-ink"
                                                            : "border-red-200 bg-red-50 text-red-600"
                                                    }`}
                                                >
                                                    {saveMsg.text}
                                                </div>
                                            )}

                                            {/* Form fields */}
                                            <div className="space-y-4">
                                                <FormField
                                                    label="Name"
                                                    value={me.name}
                                                    editing={editing}
                                                    draftValue={formDraft.name}
                                                    onChange={(v) => setFormDraft((prev) => ({ ...prev, name: v }))}
                                                />
                                                <FormField
                                                    label="Email"
                                                    value={me.email}
                                                    editing={editing}
                                                    draftValue={formDraft.email}
                                                    onChange={(v) => setFormDraft((prev) => ({ ...prev, email: v }))}
                                                />
                                                <FormField
                                                    label="Position"
                                                    value={me.position || "—"}
                                                    editing={editing}
                                                    draftValue={formDraft.position}
                                                    onChange={(v) => setFormDraft((prev) => ({ ...prev, position: v }))}
                                                />
                                                <FormField
                                                    label="Department"
                                                    value={me.department || "—"}
                                                    editing={editing}
                                                    draftValue={formDraft.department}
                                                    onChange={(v) => setFormDraft((prev) => ({ ...prev, department: v }))}
                                                />
                                            </div>

                                            {/* Save / Cancel buttons when editing */}
                                            {editing && (
                                                <div className="mt-6 flex items-center justify-end gap-3 border-t border-warm pt-4">
                                                    <button
                                                        type="button"
                                                        onClick={cancelEditing}
                                                        disabled={saving}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-cream disabled:opacity-50"
                                                    >
                                                        <X size={15} />
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleSaveClick}
                                                        disabled={saving}
                                                        className="inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                                                    >
                                                        {saving ? (
                                                            <>
                                                                <Loader2 size={16} className="animate-spin" />
                                                                Saving...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Save size={16} />
                                                                Save Changes
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : null}
                                </section>
                            </div>
                        )}

                        {activeTab === "password" && (
                            <section className="rounded-2xl border border-warm bg-card p-5 shadow-sm">
                                {/* Card header */}
                                <div className="mb-5 flex items-center gap-2.5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream text-teal">
                                        <ShieldCheck size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-ink">Change Password</h3>
                                        <p className="text-[11px] text-ink-muted">
                                            Must be at least 6 characters
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={handleChangePassword} className="space-y-5">
                                    {/* New Password */}
                                    <div>
                                        <label
                                            htmlFor="modal-new-pwd"
                                            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted"
                                        >
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <Key
                                                size={15}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none"
                                            />
                                            <input
                                                id="modal-new-pwd"
                                                type={showNewPwd ? "text" : "password"}
                                                value={newPwd}
                                                onChange={(e) => setNewPwd(e.target.value)}
                                                placeholder="Enter new password"
                                                className="w-full rounded-lg border border-warm bg-card pl-9 pr-10 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal transition"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPwd((v) => !v)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink transition"
                                                tabIndex={-1}
                                            >
                                                {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Confirm Password */}
                                    <div>
                                        <label
                                            htmlFor="modal-confirm-pwd"
                                            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted"
                                        >
                                            Confirm New Password
                                        </label>
                                        <div className="relative">
                                            <Key
                                                size={15}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none"
                                            />
                                            <input
                                                id="modal-confirm-pwd"
                                                type={showConfirmPwd ? "text" : "password"}
                                                value={confirmPwd}
                                                onChange={(e) => setConfirmPwd(e.target.value)}
                                                placeholder="Re-enter new password"
                                                className="w-full rounded-lg border border-warm bg-card pl-9 pr-10 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal transition"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPwd((v) => !v)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink transition"
                                                tabIndex={-1}
                                            >
                                                {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Password match indicator */}
                                    {newPwd && confirmPwd && (
                                        <div className="flex items-center gap-2 text-xs">
                                            {newPwd === confirmPwd ? (
                                                <>
                                                    <Check size={14} className="text-green-500" />
                                                    <span className="text-green-600 font-medium">Passwords match</span>
                                                </>
                                            ) : newPwd.length >= 6 ? (
                                                <>
                                                    <X size={14} className="text-red-400" />
                                                    <span className="text-red-500 font-medium">Passwords don't match</span>
                                                </>
                                            ) : null}
                                        </div>
                                    )}

                                    {pwdMsg && (
                                        <div
                                            className={`rounded-lg border px-3 py-2.5 text-sm flex items-center gap-2 ${
                                                pwdMsg.kind === "ok"
                                                    ? "border-teal/30 bg-teal/10 text-ink"
                                                    : "border-red-200 bg-red-50 text-red-600"
                                            }`}
                                        >
                                            {pwdMsg.kind === "ok" ? (
                                                <ShieldCheck size={16} className="shrink-0 text-teal" />
                                            ) : (
                                                <X size={16} className="shrink-0" />
                                            )}
                                            {pwdMsg.text}
                                        </div>
                                    )}

                                    {/* Divider + button */}
                                    <div className="border-t border-warm pt-4">
                                        <button
                                            type="submit"
                                            disabled={changing || !newPwd || !confirmPwd}
                                            className="inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50 w-full justify-center"
                                        >
                                            {changing ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Updating Password...
                                                </>
                                            ) : (
                                                <>
                                                    <Save size={16} />
                                                    Update Password
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </section>
                        )}
                    </div>
                </div>

                <Toast
                    open={toastOpen}
                    message={toastMessage}
                    type={toastType}
                    onClose={() => setToastOpen(false)}
                    position="top-center"
                />
            </div>
        </>
    );
}

/* ─────────────── Sub-components ─────────────── */

function FormField({
    label,
    value,
    editing,
    draftValue,
    onChange,
}: {
    label: string;
    value: string;
    editing: boolean;
    draftValue: string;
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
            </label>
            {editing ? (
                <input
                    type="text"
                    value={draftValue}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal transition"
                />
            ) : (
                <p className="text-sm text-ink py-2">{value}</p>
            )}
        </div>
    );
}