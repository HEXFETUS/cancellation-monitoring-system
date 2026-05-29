import { useState, useEffect, useRef } from "react";
import { UserPlus, X } from "lucide-react";

const teal = "#92C7CF";

interface OperatorProfile {
    id: number;
    operator: string;
    user_id: number | null;
    parent_operator_id: number | null;
}

export default function CreateUserAccountPage() {
    const [form, setForm] = useState({
        name: "",
        username: "",
        password: "",
        usertype: "",
        position: "",
        department: "",
        operator_id: null as number | null,
    });
    const [operators, setOperators] = useState<OperatorProfile[]>([]);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [emailError, setEmailError] = useState("");
    const [duplicateError, setDuplicateError] = useState("");
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

    const validateEmailFormat = (val: string): string => {
        if (!val.trim()) return "";
        if (val.includes("@")) return "Do not include '@' in the username.";
        if (/\s/.test(val)) return "Spaces are not allowed in the email.";
        if (/[^a-zA-Z0-9._-]/.test(val))
            return "Only letters, numbers, dots (.), underscores (_), and hyphens (-) are allowed.";
        if (val.length < 3) return "Username must be at least 3 characters long.";
        return "";
    };

    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, []);

    useEffect(() => {
        // Load operator profiles for the dropdown.
        let cancelled = false;
        fetch(`${API_BASE_URL}/api/pos/operators`)
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => {
                if (!cancelled) setOperators(data);
            })
            .catch(() => {
                /* fine — endpoint may not exist in older deploys */
            });
        return () => {
            cancelled = true;
        };
    }, [API_BASE_URL]);

    // Clear the operator picker if the role changes away from operator.
    useEffect(() => {
        if (form.usertype !== "operator" && form.operator_id !== null) {
            setForm((f) => ({ ...f, operator_id: null }));
        }
    }, [form.usertype, form.operator_id]);

    const checkDuplicateEmail = async (username: string) => {
        if (!username || username.length < 3) return;
        const formatError = validateEmailFormat(username);
        if (formatError) return;

        setCheckingEmail(true);
        setDuplicateError("");

        try {
            const res = await fetch(`${API_BASE_URL}/api/users`);
            if (res.ok) {
                const users: { email?: string }[] = await res.json();
                const email = `${username}@hexa.prime`;
                const duplicate = users.find(
                    (u) => u.email?.toLowerCase() === email.toLowerCase()
                );
                if (duplicate) {
                    setDuplicateError("Email already exists. Please use a different username.");
                }
            }
        } catch {
            // Silently fail – backend will catch duplicates on submit
        } finally {
            setCheckingEmail(false);
        }
    };

    const handleUsernameChange = (val: string) => {
        setForm((f) => ({ ...f, username: val }));

        const formatError = validateEmailFormat(val);
        setEmailError(formatError);

        // Clear duplicate error when the value changes
        setDuplicateError("");

        // Debounced duplicate check (500ms after user stops typing)
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (!formatError && val.trim().length >= 3) {
            debounceTimer.current = setTimeout(() => {
                checkDuplicateEmail(val);
            }, 500);
        }
    };

    const handleSubmitClick = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (emailError || duplicateError) {
            setMessage({ type: "error", text: "Please fix the email error." });
            return;
        }

        if (!form.name || !form.username || !form.password || !form.usertype || !form.position || !form.department) {
            setMessage({ type: "error", text: "All fields are required." });
            return;
        }

        // Check for duplicate email (re-check in case the debounce hasn't completed)
        try {
            const res = await fetch(`${API_BASE_URL}/api/users`);
            if (res.ok) {
                const users: { email?: string }[] = await res.json();
                const email = `${form.username}@hexa.prime`;
                const duplicate = users.find(
                    (u) => u.email?.toLowerCase() === email.toLowerCase()
                );
                if (duplicate) {
                    setMessage({ type: "error", text: "Email already exists. Please use a different username." });
                    return;
                }
            }
        } catch {
            // If the fetch fails, proceed to confirm modal; backend validation will still catch it
        }

        setShowConfirmModal(true);
    };

    const handleConfirmSubmit = async () => {
        setShowConfirmModal(false);
        setMessage(null);

        const payload = {
            ...form,
            email: `${form.username}@hexa.prime`
        };

        try {
            const res = await fetch(`${API_BASE_URL}/api/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || data.message || "Failed to create user");
            }

            setMessage({ type: "success", text: "User account created successfully!" });

            // If the new user is an operator and the admin picked a profile,
            // link them in a follow-up call. We do it here (rather than in
            // POST /api/users) so existing user-creation logic stays untouched
            // and any failure here is reported but doesn't undo the user.
            if (form.usertype === "operator" && form.operator_id !== null) {
                try {
                    const created = await res.clone().json();
                    const userId = created?.id;
                    if (userId) {
                        const linkRes = await fetch(
                            `${API_BASE_URL}/api/users/${userId}/operator`,
                            {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ operator_id: form.operator_id }),
                            }
                        );
                        if (!linkRes.ok) {
                            const data = await linkRes.json().catch(() => ({}));
                            setMessage({
                                type: "error",
                                text:
                                    "User created, but operator linking failed: " +
                                    (data.error || "unknown error"),
                            });
                        }
                    }
                } catch {
                    // We already showed success for user creation; linking error already surfaced.
                }
            }

            setForm({
                name: "",
                username: "",
                password: "",
                usertype: "",
                position: "",
                department: "",
                operator_id: null,
            });
            setDuplicateError("");
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Could not create user" });
        }
    };

    const handleCancelSubmit = () => {
        setShowConfirmModal(false);
    };

    const hasFormatError = !!emailError;
    const hasDuplicateError = !!duplicateError;

    return (
        <div className="max-w-lg">
                <div className="rounded-2xl p-6 sm:p-8 bg-white shadow-sm border border-gray-200"
            >
                {message && (
                    <div
                        className={`mb-4 p-3 rounded-lg text-sm ${
                            message.type === "success"
                                ? "bg-green-50 border border-green-200 text-green-700"
                                : "bg-red-50 border border-red-200 text-red-600"
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmitClick} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = teal;
                                e.currentTarget.style.boxShadow = `0 0 0 2px ${teal}40`;
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = "#D1D5DB";
                                e.currentTarget.style.boxShadow = "none";
                            }}
                            placeholder="Full name"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                            <input
                                type="text"
                                value={form.position}
                                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = teal;
                                    e.currentTarget.style.boxShadow = `0 0 0 2px ${teal}40`;
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "#D1D5DB";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                                placeholder="e.g. Manager"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                            <input
                                type="text"
                                value={form.department}
                                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = teal;
                                    e.currentTarget.style.boxShadow = `0 0 0 2px ${teal}40`;
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "#D1D5DB";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                                placeholder="e.g. IT"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={form.username}
                                    onChange={(e) => handleUsernameChange(e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none ${
                                        hasFormatError || hasDuplicateError ? "border-red-500" : "border-gray-300"
                                    }`}
                                    onFocus={(e) => {
                                        if (!hasFormatError && !hasDuplicateError) {
                                            e.currentTarget.style.borderColor = teal;
                                            e.currentTarget.style.boxShadow = `0 0 0 2px ${teal}40`;
                                        }
                                    }}
                                    onBlur={(e) => {
                                        if (!hasFormatError && !hasDuplicateError) {
                                            e.currentTarget.style.borderColor = "#D1D5DB";
                                            e.currentTarget.style.boxShadow = "none";
                                        }
                                    }}
                                    placeholder="Username"
                                />
                            </div>
                            <div className="w-32">
                                <input
                                    type="text"
                                    value="@hexa.prime"
                                    readOnly
                                    className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg outline-none cursor-default"
                                />
                            </div>
                        </div>
                        {checkingEmail && (
                            <p className="mt-1 text-xs text-gray-500 italic">Checking availability...</p>
                        )}
                        {emailError && (
                            <p className="mt-1 text-xs text-red-500 font-medium">{emailError}</p>
                        )}
                        {duplicateError && (
                            <p className="mt-1 text-xs text-red-500 font-medium">{duplicateError}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="text"
                            value={form.password}
                            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = teal;
                                e.currentTarget.style.boxShadow = `0 0 0 2px ${teal}40`;
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = "#D1D5DB";
                                e.currentTarget.style.boxShadow = "none";
                            }}
                            placeholder="Enter a password"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">User Type</label>
                        <select
                            value={form.usertype}
                            onChange={(e) => setForm((f) => ({ ...f, usertype: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = teal;
                                e.currentTarget.style.boxShadow = `0 0 0 2px ${teal}40`;
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = "#D1D5DB";
                                e.currentTarget.style.boxShadow = "none";
                            }}
                        >
                            <option value="" disabled>-- Select a usertype --</option>
                            <option value="admin">Admin</option>
                            <option value="csr">CSR</option>
                            <option value="operator">Operator</option>
                            <option value="purchaser">Purchaser</option>
                        </select>
                    </div>

                    {form.usertype === "operator" && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Operator Profile
                            </label>
                            <select
                                value={form.operator_id ?? ""}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        operator_id:
                                            e.target.value === "" ? null : Number(e.target.value),
                                    }))
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = teal;
                                    e.currentTarget.style.boxShadow = `0 0 0 2px ${teal}40`;
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "#D1D5DB";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            >
                                <option value="">— assign later —</option>
                                {operators
                                    .filter((o) => !o.user_id)
                                    .map((o) => {
                                        const parent = o.parent_operator_id
                                            ? operators.find((x) => x.id === o.parent_operator_id)
                                            : null;
                                        // Indent subs visually instead of nesting parentheses,
                                        // which gets unreadable when names already have parens.
                                        const label = parent
                                            ? `   \u21B3 ${o.operator}  (under ${parent.operator})`
                                            : o.operator;
                                        return (
                                            <option key={o.id} value={o.id}>
                                                {label}
                                            </option>
                                        );
                                    })}
                            </select>
                            <p className="mt-1 text-xs text-ink-subtle">
                                Pick the operator this user will represent. Only profiles
                                that aren't linked yet are listed.
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!form.name || !form.username || !form.password || !form.usertype || !form.position || !form.department || !!emailError || !!duplicateError}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all duration-300 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                        style={{
                            background: `linear-gradient(135deg, ${teal}, #AAD7D9)`,
                            boxShadow: "0 2px 12px rgba(146,199,207,0.30)",
                        }}
                    >
                        <UserPlus className="h-4 w-4" />
                        Create User
                    </button>
                </form>
            </div>

            {/* Confirm Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 px-4">
                    <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                        {/* Accent bar */}
                        <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500" />

                        <div className="p-6">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h3 className="text-xl font-bold text-ink">
                                        Confirm User Details
                                    </h3>
                                    <p className="text-sm text-ink-muted mt-0.5">
                                        Please review the information before saving
                                    </p>
                                </div>
                                <button
                                    onClick={handleCancelSubmit}
                                    className="rounded-lg p-1.5 text-ink-subtle hover:text-ink hover:bg-warm/60 transition cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="w-full rounded-xl bg-gradient-to-br from-cream to-amber-50/50 border border-warm/70 px-4 py-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Name</span>
                                    <span className="font-semibold text-ink text-sm">{form.name}</span>
                                </div>
                                <div className="h-px bg-warm/60" />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Position</span>
                                    <span className="font-semibold text-ink text-sm">{form.position}</span>
                                </div>
                                <div className="h-px bg-warm/60" />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Department</span>
                                    <span className="font-semibold text-ink text-sm">{form.department}</span>
                                </div>
                                <div className="h-px bg-warm/60" />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Email</span>
                                    <span className="font-semibold text-ink text-sm">{form.username}@hexa.prime</span>
                                </div>
                                <div className="h-px bg-warm/60" />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Password</span>
                                    <span className="font-semibold text-ink text-sm">{form.password}</span>
                                </div>
                                <div className="h-px bg-warm/60" />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">User Type</span>
                                    <span className="font-semibold text-ink text-sm capitalize">{form.usertype}</span>
                                </div>
                                {form.usertype === "operator" && (
                                    <>
                                        <div className="h-px bg-warm/60" />
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">
                                                Operator
                                            </span>
                                            <span className="font-semibold text-ink text-sm">
                                                {form.operator_id
                                                    ? operators.find((o) => o.id === form.operator_id)?.operator ?? "—"
                                                    : "Assign later"}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleCancelSubmit}
                                    className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmSubmit}
                                    className="flex-1 rounded-xl bg-gradient-to-r from-teal to-teal-dark py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    Confirm & Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
