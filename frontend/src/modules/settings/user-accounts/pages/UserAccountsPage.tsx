import { useState, useEffect } from "react";
import { Pencil, Trash2, Key, X, Check, AlertTriangle } from "lucide-react";

interface User {
    id: number;
    name: string;
    email: string;
    usertype: "admin" | "csr" | "operator";
    password?: string;
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
}: {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 border border-warm">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="text-peach-dark" size={24} />
                    <h3 className="text-lg font-semibold text-ink">Confirm</h3>
                </div>
                <p className="text-ink-muted mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg border border-warm text-ink hover:bg-warm/50 transition cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-lg bg-teal text-ink font-medium hover:bg-teal-dark transition cursor-pointer"
                    >
                        Confirm
                    </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-md mx-4 border border-warm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-ink">
                        Change Password – {user.name}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-ink-subtle hover:text-ink transition cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-ink mb-1">
                        New Password
                    </label>
                    <input
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter or generate a password"
                        className="w-full px-3 py-2 border border-warm rounded-lg bg-card text-ink focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
                    />
                </div>
                <button
                    onClick={handleGenerate}
                    className="w-full mb-4 px-4 py-2 rounded-lg border border-warm text-ink hover:bg-warm/50 transition cursor-pointer"
                >
                    Generate Password
                </button>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-warm text-ink hover:bg-warm/50 transition cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(password)}
                        disabled={!password}
                        className="px-4 py-2 rounded-lg bg-teal text-ink font-medium hover:bg-teal-dark disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function UserAccountsPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{ name: string; email: string; usertype: User["usertype"] }>({
        name: "",
        email: "",
        usertype: "admin",
    });
    const [confirmAction, setConfirmAction] = useState<{
        message: string;
        onConfirm: () => void;
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
        setEditForm({ name: user.name, email: user.email, usertype: user.usertype });
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
            message: `Are you sure you want to delete "${user?.name}"?`,
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="text-ink-subtle text-lg">Loading users...</div>
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-lg font-semibold text-ink mb-4">User Accounts</h2>

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
                                <td colSpan={4} className="px-4 py-6 text-center text-ink-subtle">
                                    No user accounts found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
