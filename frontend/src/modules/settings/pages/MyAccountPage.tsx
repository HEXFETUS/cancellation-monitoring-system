import { useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, RefreshCw, Save, User, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
function apiUrl(p: string) { return `${API_BASE_URL}${p}`; }

interface Me {
    id: number;
    name: string;
    email: string;
    usertype: string;
    position?: string;
    department?: string;
    operator_id?: number | null;
    operator_name?: string | null;
    parent_operator_id?: number | null;
    parent_operator_name?: string | null;
}

export default function MyAccountPage() {
    const { user } = useAuth();
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Password change
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [pwdMsg, setPwdMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
    const [changing, setChanging] = useState(false);

    // Inline name editor — operator-only
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [savingName, setSavingName] = useState(false);
    const [nameMsg, setNameMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

    useEffect(() => {
        if (!user?.id) return;
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
                if (!cancelled) setError(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Failed to load");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id]);

    const refreshProfile = async () => {
        if (!user?.id) return;
        try {
            setLoading(true);
            setError("");
            const res = await fetch(apiUrl(`/api/users/me?id=${user.id}`));
            if (!res.ok) throw new Error("Failed to load profile");
            setMe(await res.json());
        } catch (e) {
            setError(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    // Operator, sub-operator, CSR, and purchaser users may edit their own
    // display name. Admin's name is managed via the admin Users panel.
    const canEditName =
        me?.usertype === "operator" ||
        me?.usertype === "csr" ||
        me?.usertype === "purchaser";

    const startEditName = () => {
        setNameDraft(me?.name || "");
        setNameMsg(null);
        setEditingName(true);
    };

    const cancelEditName = () => {
        setEditingName(false);
        setNameMsg(null);
    };

    const saveName = async () => {
        if (!user?.id) return;
        const trimmed = nameDraft.trim();
        if (!trimmed) {
            setNameMsg({ kind: "err", text: "Name can't be empty." });
            return;
        }
        setSavingName(true);
        setNameMsg(null);
        try {
            const res = await fetch(apiUrl(`/api/users/${user.id}/name`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed, user_id: user.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to save");
            setMe((prev) => (prev ? { ...prev, name: trimmed } : prev));
            setEditingName(false);
            setNameMsg({ kind: "ok", text: "Name updated." });
        } catch (e) {
            setNameMsg({ kind: "err", text: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Failed to save" });
        } finally {
            setSavingName(false);
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
            setPwdMsg({ kind: "err", text: err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Failed to change password" });
        } finally {
            setChanging(false);
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-ink">My Account</h1>
                <p className="mt-1 text-sm text-ink-muted">
                    View your profile and change your password.
                </p>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* Profile card */}
            <section className="rounded-2xl border border-warm bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream text-teal">
                            <User size={18} />
                        </div>
                        <h2 className="text-base font-semibold text-ink">Profile</h2>
                    </div>
                    <button
                        type="button"
                        onClick={refreshProfile}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-card px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-cream disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <p className="text-sm text-ink-subtle">Loading...</p>
                ) : me ? (
                    <>
                        {nameMsg && (
                            <div
                                className={`mb-3 rounded-lg border px-3 py-2 text-sm ${nameMsg.kind === "ok"
                                    ? "border-teal/30 bg-teal/10 text-ink"
                                    : "border-red-200 bg-red-50 text-red-600"
                                    }`}
                            >
                                {nameMsg.text}
                            </div>
                        )}
                        <dl className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                    Name
                                </dt>
                                <dd className="mt-0.5">
                                    {canEditName && editingName ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={nameDraft}
                                                onChange={(e) => setNameDraft(e.target.value)}
                                                disabled={savingName}
                                                className="flex-1 rounded-lg border border-warm bg-card px-2 py-1 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal disabled:opacity-50"
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={saveName}
                                                disabled={savingName}
                                                className="inline-flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-teal-dark disabled:opacity-50"
                                            >
                                                <Save size={14} />
                                                {savingName ? "Saving..." : "Save"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={cancelEditName}
                                                disabled={savingName}
                                                className="inline-flex items-center gap-1 rounded-lg border border-warm bg-card px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-cream disabled:opacity-50"
                                            >
                                                <X size={14} />
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-ink">{me.name}</span>
                                            {canEditName && (
                                                <button
                                                    type="button"
                                                    onClick={startEditName}
                                                    className="inline-flex items-center gap-1 rounded-md border border-warm bg-card px-1.5 py-0.5 text-[11px] font-medium text-ink-muted transition hover:bg-cream"
                                                >
                                                    <Pencil size={11} />
                                                    Edit
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </dd>
                            </div>
                            <Field label="Email" value={me.email} />
                            <Field
                                label="Role"
                                value={
                                    me.usertype === "operator" && me.parent_operator_id != null
                                        ? "Sub-Operator"
                                        : me.usertype
                                }
                            />
                            {me.usertype === "operator" && (
                                <Field
                                    label="Operator Profile"
                                    value={
                                        me.operator_name
                                            ? me.parent_operator_name
                                                ? `${me.operator_name} (under ${me.parent_operator_name})`
                                                : me.operator_name
                                            : "Not yet assigned"
                                    }
                                />
                            )}
                        </dl>
                    </>
                ) : null}
            </section>

            {/* Change password card */}
            <section className="rounded-2xl border border-warm bg-card p-5 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-ink">Change Password</h2>

                <form onSubmit={handleChangePassword} className="space-y-4">
                    <PasswordInput
                        id="new-pwd"
                        label="New Password"
                        value={newPwd}
                        onChange={setNewPwd}
                        show={showPwd}
                        onToggleShow={() => setShowPwd((v) => !v)}
                    />
                    <PasswordInput
                        id="confirm-pwd"
                        label="Confirm New Password"
                        value={confirmPwd}
                        onChange={setConfirmPwd}
                        show={showPwd}
                        onToggleShow={() => setShowPwd((v) => !v)}
                    />

                    {pwdMsg && (
                        <div
                            className={`rounded-lg border px-3 py-2 text-sm ${pwdMsg.kind === "ok"
                                ? "border-teal/30 bg-teal/10 text-ink"
                                : "border-red-200 bg-red-50 text-red-600"
                                }`}
                        >
                            {pwdMsg.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={changing || !newPwd || !confirmPwd}
                        className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                    >
                        <Save size={16} />
                        {changing ? "Saving..." : "Update Password"}
                    </button>
                </form>
            </section>
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
            </dt>
            <dd className="mt-0.5 text-sm text-ink">{value}</dd>
        </div>
    );
}

function PasswordInput({
    id,
    label,
    value,
    onChange,
    show,
    onToggleShow,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    onToggleShow: () => void;
}) {
    return (
        <div>
            <label
                htmlFor={id}
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted"
            >
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-lg border border-warm bg-card px-3 py-2 pr-10 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                />
                <button
                    type="button"
                    onClick={onToggleShow}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
                    tabIndex={-1}
                >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
        </div>
    );
}
