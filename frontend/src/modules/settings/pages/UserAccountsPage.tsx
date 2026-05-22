import { useState, useEffect } from "react";
import { Pencil, Trash2, Key, X, Check, AlertTriangle, UserPlus, ClipboardList, Users } from "lucide-react";

interface User {
    id: number;
    name: string;
    email: string;
    usertype: "admin" | "csr" | "operator";
    password?: string;
    position: string;
    department: string;
}

const USERTYPES = ["admin", "csr", "operator"] as const;

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

async function getErrorMessage(res: Response, fallback: string) {
    try {
        const data = await res.json();
        return data.error || data.message || fallback;
    } catch {
        return fallback;
    }
}

function generatePassword(length = 10): string {
    let password = "";
    for (let i = 0; i < length; i++) {
        password += ALPHANUMERIC.charAt(Math.floor(Math.random() * ALPHANUMERIC.length));
    }
    return password;
}

function ConfirmDialog({
    message,
    onConfirm,
    onCancel,
    itemName,
}: {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    itemName?: string;
}) {
    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 px-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500" />

                <div className="p-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-50">
                            <AlertTriangle className="h-7 w-7 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-ink">Confirm Action</h3>
                            <p className="text-sm text-ink-muted mt-1">{message}</p>
                            {itemName && (
                                <div className="mt-3 w-full rounded-xl bg-gradient-to-br from-cream to-amber-50/50 border border-warm/70 px-4 py-3">
                                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">User</span>
                                    <p className="text-base font-bold text-ink mt-0.5">{itemName}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onCancel}
                            className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 rounded-xl bg-gradient-to-r from-teal to-teal-dark py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] cursor-pointer"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ChangePasswordModal({
    user,
    onClose,
    onSave,
}: {
    user: User;
    onClose: () => void;
    onSave: (newPassword: string) => void;
}) {
    const [password, setPassword] = useState("");

    const handleGenerate = () => {
        setPassword(generatePassword());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-card rounded-2xl shadow-2xl p-0 w-full max-w-md mx-4 border border-warm animate-in fade-in zoom-in duration-200 overflow-hidden">
                {/* Accent bar */}
                <div className="h-2 bg-gradient-to-r from-peach to-peach-dark" />

                <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-xl font-bold text-ink">
                                Change Password
                            </h3>
                            <p className="text-sm text-ink-muted mt-0.5">{user.name}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-ink-subtle hover:text-ink hover:bg-warm/60 transition cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-ink mb-1.5">
                            New Password
                        </label>
                        <input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter or generate a password"
                            className="w-full px-4 py-3 rounded-xl border border-warm bg-card text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal transition-all shadow-sm"
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        className="w-full mb-5 px-4 py-2.5 rounded-xl border-2 border-dashed border-warm text-ink-muted font-medium hover:text-ink hover:border-teal/40 hover:bg-teal-light/10 transition-all active:scale-[0.98] cursor-pointer"
                    >
                        ✦ Generate Password
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-warm text-ink-muted font-medium hover:text-ink hover:bg-warm/60 transition-all active:scale-[0.97] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(password)}
                            disabled={!password}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal to-teal-dark text-ink font-semibold shadow-md shadow-teal/20 hover:shadow-lg hover:shadow-teal/30 hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:brightness-100 transition-all active:scale-[0.97] cursor-pointer"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        usertype: "csr",
        position: "",
        department: "",
    });
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (!form.name || !form.email || !form.password) {
            setMessage({ type: "error", text: "All fields are required." });
            return;
        }

        try {
            const res = await fetch(apiUrl("/api/users"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    password: form.password,
                    usertype: form.usertype,
                    position: form.position || undefined,
                    department: form.department || undefined,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || data.message || "Failed to create user");
            }

            setMessage({ type: "success", text: "User account created successfully!" });
            setForm({ name: "", email: "", password: "", usertype: "csr", position: "", department: "" });
            onCreated();
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Could not create user" });
        }
    };

    return (
        <div className="max-w-lg">
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

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-ink mb-1.5">Name <span className="text-rose-500">*</span></label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Full name"
                        className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-ink mb-1.5">Email <span className="text-rose-500">*</span></label>
                    <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="email@example.com"
                        className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-ink mb-1.5">Password <span className="text-rose-500">*</span></label>
                    <input
                        type="text"
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="Enter a password"
                        className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">Position</label>
                        <input
                            type="text"
                            value={form.position}
                            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                            placeholder="e.g. Staff"
                            className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">Department</label>
                        <input
                            type="text"
                            value={form.department}
                            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                            placeholder="e.g. Sales"
                            className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-ink mb-1.5">User Type <span className="text-rose-500">*</span></label>
                    <select
                        value={form.usertype}
                        onChange={(e) => setForm((f) => ({ ...f, usertype: e.target.value }))}
                        className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm appearance-none cursor-pointer"
                    >
                        <option value="admin">Admin</option>
                        <option value="csr">CSR</option>
                        <option value="operator">Operator</option>
                    </select>
                </div>

                <div className="flex gap-3 pt-4 border-t border-warm/60">
                    <button
                        type="submit"
                        disabled={!form.name || !form.email || !form.password}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                    >
                        <UserPlus size={16} />
                        Create User
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function UserAccountsPage() {
    const [activeSubTab, setActiveSubTab] = useState("user-accounts");
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{
        name: string;
        email: string;
        usertype: User["usertype"];
        position: string;
        department: string;
    }>({
        name: "",
        email: "",
        usertype: "admin",
        position: "",
        department: "",
    });
    const [confirmAction, setConfirmAction] = useState<{
        message: string;
        onConfirm: () => void;
        itemName?: string;
    } | null>(null);
    const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);

    const fetchUsers = async () => {
        try {
            setError("");
            const res = await fetch(apiUrl("/api/users"));
            if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to fetch users"));
            const data = await res.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message || "Could not load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleEdit = (user: User) => {
        setEditingId(user.id);
        setEditForm({
            name: user.name,
            email: user.email,
            usertype: user.usertype,
            position: user.position ?? "",
            department: user.department ?? "",
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
    };

    const handleSaveEdit = (id: number) => {
        setConfirmAction({
            message: "Are you sure you want to save these changes?",
            onConfirm: async () => {
                try {
                    const res = await fetch(apiUrl(`/api/users/${id}`), {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(editForm),
                    });
                    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to update user"));
                    await fetchUsers();
                    setEditingId(null);
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setConfirmAction(null);
                }
            },
        });
    };

    const handleDelete = (id: number) => {
        const user = users.find((u) => u.id === id);
        setConfirmAction({
            message: "Are you sure you want to delete this user?",
            itemName: user?.name,
            onConfirm: async () => {
                try {
                    const res = await fetch(apiUrl(`/api/users/${id}`), { method: "DELETE" });
                    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to delete user"));
                    await fetchUsers();
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setConfirmAction(null);
                }
            },
        });
    };

    const handleChangePasswordSave = async (newPassword: string) => {
        if (!passwordModalUser) return;
        try {
            const res = await fetch(apiUrl(`/api/users/${passwordModalUser.id}/password`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword }),
            });
            if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to change password"));
            setPasswordModalUser(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (loading && activeSubTab === "user-accounts") {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="text-ink-subtle text-lg">Loading users...</div>
            </div>
        );
    }

    const subTabs = [
        { id: "user-accounts", label: "User Accounts", icon: Users },
        { id: "create-user", label: "Create User", icon: UserPlus },
        { id: "user-logs", label: "User Logs", icon: ClipboardList },
    ];

    return (
        <div>
            {/* Sub-tabs */}
            <div className="flex gap-1 mb-5 border-b pb-0"
                style={{ borderColor: "rgba(146,199,207,0.25)" }}
            >
                {subTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeSubTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-t-xl cursor-pointer"
                            style={{
                                background: isActive
                                    ? "rgba(146,199,207,0.15)"
                                    : "transparent",
                                border: isActive
                                    ? "1px solid rgba(146,199,207,0.25)"
                                    : "1px solid transparent",
                                borderBottom: isActive
                                    ? "1px solid white"
                                    : "1px solid transparent",
                                color: isActive ? "#1F2937" : "#6B7280",
                                boxShadow: isActive
                                    ? "0 2px 8px rgba(146,199,207,0.10)"
                                    : "none",
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = "rgba(146,199,207,0.06)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = "transparent";
                                }
                            }}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {activeSubTab === "create-user" && (
                <CreateUserForm
                    onCreated={() => {
                        setActiveSubTab("user-accounts");
                        fetchUsers();
                    }}
                />
            )}

            {activeSubTab === "user-logs" && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ClipboardList size={48} className="text-ink-subtle mb-4" />
                    <h3 className="text-lg font-semibold text-ink mb-1">User Logs</h3>
                    <p className="text-sm text-ink-muted">Activity and audit logs for user accounts will appear here.</p>
                </div>
            )}

            {activeSubTab === "user-accounts" && (
                <>
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Confirmation Dialog */}
                    {confirmAction && (
                        <ConfirmDialog
                            message={confirmAction.message}
                            onConfirm={confirmAction.onConfirm}
                            onCancel={() => setConfirmAction(null)}
                            itemName={confirmAction.itemName}
                        />
                    )}

                    {/* Change Password Modal */}
                    {passwordModalUser && (
                        <ChangePasswordModal
                            user={passwordModalUser}
                            onClose={() => setPasswordModalUser(null)}
                            onSave={handleChangePasswordSave}
                        />
                    )}

                    {/* Users Table */}
                    <div className="overflow-x-auto bg-card rounded-xl shadow-sm border border-warm">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-cream border-b border-warm">
                                    <th className="px-4 py-3 text-sm font-semibold text-ink-muted">Name</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-ink-muted">Email</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-ink-muted">Position</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-ink-muted">Department</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-ink-muted">User Type</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-ink-muted text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id} className="border-b border-warm/60 hover:bg-cream transition">
                                        {editingId === user.id ? (
                                            <>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        value={editForm.name}
                                                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                                        className="w-full px-2 py-1 border border-warm rounded bg-card text-ink focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="email"
                                                        value={editForm.email}
                                                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                                                        className="w-full px-2 py-1 border border-warm rounded bg-card text-ink focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        value={editForm.position}
                                                        onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                                                        className="w-full px-2 py-1 border border-warm rounded bg-card text-ink focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        value={editForm.department}
                                                        onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                                                        className="w-full px-2 py-1 border border-warm rounded bg-card text-ink focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        value={editForm.usertype}
                                                        onChange={(e) =>
                                                            setEditForm((f) => ({
                                                                ...f,
                                                                usertype: e.target.value as User["usertype"],
                                                            }))
                                                        }
                                                        className="w-full px-2 py-1 border border-warm rounded bg-card text-ink focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
                                                    >
                                                        {USERTYPES.map((type) => (
                                                            <option key={type} value={type}>
                                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleSaveEdit(user.id)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal text-ink font-medium text-sm hover:bg-teal-dark transition cursor-pointer"
                                                        >
                                                            <Check size={16} />
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-warm text-ink text-sm hover:bg-warm/70 transition cursor-pointer"
                                                        >
                                                            <X size={16} />
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-4 py-3 text-ink">{user.name}</td>
                                                <td className="px-4 py-3 text-ink-muted">{user.email}</td>
                                                <td className="px-4 py-3 text-ink-muted">{user.position || "—"}</td>
                                                <td className="px-4 py-3 text-ink-muted">{user.department || "—"}</td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-light/40 text-ink capitalize border border-teal/30">
                                                        {user.usertype}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEdit(user)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal text-ink font-medium text-sm hover:bg-teal-dark transition cursor-pointer"
                                                        >
                                                            <Pencil size={16} />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(user.id)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose text-ink font-medium text-sm hover:bg-rose-dark transition cursor-pointer"
                                                        >
                                                            <Trash2 size={16} />
                                                            Delete
                                                        </button>
                                                        <button
                                                            onClick={() => setPasswordModalUser(user)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-peach text-ink font-medium text-sm hover:bg-peach-dark transition cursor-pointer"
                                                        >
                                                            <Key size={16} />
                                                            Change Password
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-6 text-center text-ink-subtle">
                                            No user accounts found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}