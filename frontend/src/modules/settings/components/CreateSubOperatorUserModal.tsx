import { useEffect, useState } from "react";
import { UserPlus, X, RefreshCw, Eye, EyeOff } from "lucide-react";
import type { OperatorInfo } from "../../pos/types";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const ALPHANUMERIC =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generatePassword(length = 10): string {
    let pwd = "";
    for (let i = 0; i < length; i++) {
        pwd += ALPHANUMERIC.charAt(Math.floor(Math.random() * ALPHANUMERIC.length));
    }
    return pwd;
}

function validateUsername(val: string): string {
    const trimmed = val.trim();
    if (!trimmed) return "Email username is required.";
    if (trimmed.includes("@")) return "Don't include '@' — the domain is added automatically.";
    if (/\s/.test(trimmed)) return "Spaces are not allowed.";
    if (/[^a-zA-Z0-9._-]/.test(trimmed))
        return "Use only letters, numbers, dots, underscores, or hyphens.";
    if (trimmed.length < 3) return "Must be at least 3 characters.";
    return "";
}

export interface CreateSubOperatorUserModalProps {
    /** The sub-operator profile we're creating an account for. */
    subOperator: OperatorInfo;
    /** Parent operator (for display, "under <Parent>"). */
    parentOperator: OperatorInfo | null;
    onClose: () => void;
    /** Called after a successful create. The page should refresh its data. */
    onCreated: (message: string) => Promise<void> | void;
}

/**
 * Focused modal for the admin's "Create user for sub-operator" workflow.
 *
 * The sub-operator is already known (we're on its row). We only need email
 * and password from the admin. Name/Position/Department auto-fill from the
 * sub-operator's profile and can be tweaked under "Advanced".
 *
 * Submits POST /api/users + PATCH /api/users/:id/operator, mirroring the
 * existing CreateUserAccountPage flow so backend semantics stay identical.
 */
export default function CreateSubOperatorUserModal({
    subOperator,
    parentOperator,
    onClose,
    onCreated,
}: CreateSubOperatorUserModalProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState(subOperator.operator);
    const [position, setPosition] = useState("Sub-Operator");
    const [department, setDepartment] = useState("Operations");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showPwd, setShowPwd] = useState(false);

    const [usernameError, setUsernameError] = useState("");
    const [duplicateError, setDuplicateError] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);

    // Re-seed the form whenever a different sub is targeted (the parent page
    // can reuse the same modal instance across rows).
    useEffect(() => {
        setUsername("");
        setPassword(generatePassword());
        setName(subOperator.operator);
        setPosition("Sub-Operator");
        setDepartment("Operations");
        setUsernameError("");
        setDuplicateError("");
        setSubmitError("");
    }, [subOperator.id, subOperator.operator]);

    // Debounced duplicate-email check.
    useEffect(() => {
        const trimmed = username.trim();
        if (!trimmed) {
            setDuplicateError("");
            return;
        }
        const formatErr = validateUsername(trimmed);
        if (formatErr) {
            setUsernameError(formatErr);
            setDuplicateError("");
            return;
        }
        setUsernameError("");

        let cancelled = false;
        const handle = setTimeout(async () => {
            try {
                setCheckingEmail(true);
                const res = await fetch(`${API_BASE_URL}/api/users`);
                if (!res.ok) return;
                const users: { email?: string }[] = await res.json();
                if (cancelled) return;
                const target = `${trimmed}@hexa.prime`.toLowerCase();
                const taken = users.some(
                    (u) => (u.email ?? "").toLowerCase() === target
                );
                setDuplicateError(taken ? "This email is already taken." : "");
            } catch {
                // Silent — the backend uniqueness constraint is the source of truth.
            } finally {
                if (!cancelled) setCheckingEmail(false);
            }
        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [username]);

    const email = `${username.trim()}@hexa.prime`;
    const canSubmit =
        !submitting &&
        !usernameError &&
        !duplicateError &&
        username.trim().length >= 3 &&
        password.trim().length >= 6 &&
        name.trim().length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setSubmitting(true);
        setSubmitError("");

        try {
            // 1. Create the user. POST /api/users does not accept operator_id,
            //    so linkage is a follow-up PATCH.
            const createRes = await fetch(`${API_BASE_URL}/api/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    email,
                    password: password.trim(),
                    usertype: "operator",
                    position: position.trim(),
                    department: department.trim(),
                }),
            });
            if (!createRes.ok) {
                const data = await createRes.json().catch(() => ({}));
                throw new Error(data.error || "Failed to create user");
            }
            const created = await createRes.json();

            // 2. Link the new user to this specific sub-operator profile.
            const linkRes = await fetch(
                `${API_BASE_URL}/api/users/${created.id}/operator`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ operator_id: subOperator.id }),
                }
            );
            if (!linkRes.ok) {
                const data = await linkRes.json().catch(() => ({}));
                throw new Error(
                    data.error ||
                        "User created but linking to the sub-operator failed."
                );
            }

            await onCreated(
                `Created user ${email} for sub-operator ${subOperator.operator}.`
            );
        } catch (err) {
            setSubmitError(
                err instanceof Error ? err.message : "Failed to create user"
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-16 px-4">
            <div className="w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                {/* Accent bar */}
                <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />

                <div className="p-6">
                    {/* Header */}
                    <div className="mb-5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-xl font-bold text-ink">
                                Create User Account
                            </h3>
                            <p className="mt-0.5 text-sm text-ink-muted">
                                For sub-operator{" "}
                                <span className="font-semibold text-ink">
                                    {subOperator.operator}
                                </span>
                                {parentOperator && (
                                    <>
                                        {" "}
                                        under{" "}
                                        <span className="font-semibold text-ink">
                                            {parentOperator.operator}
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="rounded-lg p-1.5 text-ink-subtle transition hover:bg-warm/60 hover:text-ink disabled:opacity-50"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                Email
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="username"
                                    autoFocus
                                    className={`flex-1 rounded-lg border bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 ${
                                        usernameError || duplicateError
                                            ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                                            : "border-warm focus:border-teal focus:ring-teal/40"
                                    }`}
                                />
                                <span className="inline-flex items-center rounded-lg border border-warm bg-cream px-3 text-sm text-ink-muted">
                                    @hexa.prime
                                </span>
                            </div>
                            {checkingEmail && (
                                <p className="mt-1 text-xs italic text-ink-subtle">
                                    Checking availability...
                                </p>
                            )}
                            {usernameError && (
                                <p className="mt-1 text-xs font-medium text-red-600">
                                    {usernameError}
                                </p>
                            )}
                            {duplicateError && (
                                <p className="mt-1 text-xs font-medium text-red-600">
                                    {duplicateError}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                Password
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type={showPwd ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter or generate a password"
                                        className="w-full rounded-lg border border-warm bg-card px-3 py-2 pr-10 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/40"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPwd((v) => !v)}
                                        tabIndex={-1}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-subtle transition hover:text-ink"
                                        aria-label={showPwd ? "Hide password" : "Show password"}
                                    >
                                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPassword(generatePassword())}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-card px-3 py-2 text-xs font-medium text-ink-muted transition hover:bg-cream hover:text-ink"
                                >
                                    <RefreshCw size={14} />
                                    Generate
                                </button>
                            </div>
                            {password && password.length < 6 && (
                                <p className="mt-1 text-xs text-amber-600">
                                    Use at least 6 characters.
                                </p>
                            )}
                        </div>

                        {/* Auto-filled context (read-only summary) */}
                        <div className="rounded-lg border border-warm bg-cream/50 p-3 text-xs">
                            <p className="mb-2 font-semibold uppercase tracking-wider text-ink-muted">
                                Auto-filled
                            </p>
                            <dl className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                                <dt className="text-ink-muted">Role</dt>
                                <dd className="font-medium text-ink">Sub-Operator</dd>

                                <dt className="text-ink-muted">Operator profile</dt>
                                <dd className="font-medium text-ink">
                                    {subOperator.operator}
                                </dd>

                                {parentOperator && (
                                    <>
                                        <dt className="text-ink-muted">Parent operator</dt>
                                        <dd className="font-medium text-ink">
                                            {parentOperator.operator}
                                        </dd>
                                    </>
                                )}
                            </dl>

                            <button
                                type="button"
                                onClick={() => setShowAdvanced((v) => !v)}
                                className="mt-3 text-xs font-medium text-teal transition hover:text-teal-dark"
                            >
                                {showAdvanced ? "Hide advanced" : "Edit name, position, department"}
                            </button>
                        </div>

                        {showAdvanced && (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                        Display name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/40"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                        Position
                                    </label>
                                    <input
                                        type="text"
                                        value={position}
                                        onChange={(e) => setPosition(e.target.value)}
                                        className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/40"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                        Department
                                    </label>
                                    <input
                                        type="text"
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/40"
                                    />
                                </div>
                            </div>
                        )}

                        {submitError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                                {submitError}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-cream hover:text-ink disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                            >
                                <UserPlus size={14} />
                                {submitting ? "Creating..." : "Create User"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
