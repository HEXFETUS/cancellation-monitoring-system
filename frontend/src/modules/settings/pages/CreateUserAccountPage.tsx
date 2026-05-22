import { useState } from "react";
import { UserPlus, X } from "lucide-react";

const teal = "#92C7CF";

export default function CreateUserAccountPage() {
    const [form, setForm] = useState({
        name: "",
        username: "",
        password: "",
        usertype: "",
        position: "",
        department: "",
    });
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [usernameError, setUsernameError] = useState("");
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const handleUsernameChange = (val: string) => {
        setForm((f) => ({ ...f, username: val }));
        if (val.includes("@")) {
            setUsernameError("Do not include '@' in the username.");
        } else {
            setUsernameError("");
        }
    };

    const handleSubmitClick = (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (usernameError) {
            setMessage({ type: "error", text: "Please fix the username error." });
            return;
        }

        if (!form.name || !form.username || !form.password || !form.usertype || !form.position || !form.department) {
            setMessage({ type: "error", text: "All fields are required." });
            return;
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
            const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
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
            setForm({ name: "", username: "", password: "", usertype: "", position: "", department: "" });
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Could not create user" });
        }
    };

    const handleCancelSubmit = () => {
        setShowConfirmModal(false);
    };

    return (
        <div className="max-w-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Create User Account</h2>

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
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none ${usernameError ? "border-red-500" : "border-gray-300"}`}
                                onFocus={(e) => {
                                    if (!usernameError) {
                                        e.currentTarget.style.borderColor = teal;
                                        e.currentTarget.style.boxShadow = `0 0 0 2px ${teal}40`;
                                    }
                                }}
                                onBlur={(e) => {
                                    if (!usernameError) {
                                        e.currentTarget.style.borderColor = "#D1D5DB";
                                        e.currentTarget.style.boxShadow = "none";
                                    }
                                }}
                                placeholder="username"
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
                    {usernameError && (
                        <p className="mt-1 text-xs text-red-500 font-medium">{usernameError}</p>
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
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={!form.name || !form.username || !form.password || !form.usertype || !form.position || !form.department || !!usernameError}
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

            {/* Confirm Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 relative">
                        <button
                            onClick={handleCancelSubmit}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirm User Details</h3>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500">Name</span>
                                <span className="font-medium text-gray-800">{form.name}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500">Position</span>
                                <span className="font-medium text-gray-800">{form.position}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500">Department</span>
                                <span className="font-medium text-gray-800">{form.department}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500">Email</span>
                                <span className="font-medium text-gray-800">{form.username}@hexa.prime</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500">Password</span>
                                <span className="font-medium text-gray-800">{form.password}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">User Type</span>
                                <span className="font-medium text-gray-800 capitalize">{form.usertype}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6 justify-end">
                            <button
                                onClick={handleCancelSubmit}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmSubmit}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-300 hover:shadow-lg"
                                style={{
                                    background: `linear-gradient(135deg, ${teal}, #AAD7D9)`,
                                }}
                            >
                                Confirm & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}