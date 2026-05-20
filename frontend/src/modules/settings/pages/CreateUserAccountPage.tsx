import { useState } from "react";
import { UserPlus } from "lucide-react";

export default function CreateUserAccountPage() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        usertype: "csr",
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
            const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
            const res = await fetch(`${API_BASE_URL}/api/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || data.message || "Failed to create user");
            }

            setMessage({ type: "success", text: "User account created successfully!" });
            setForm({ name: "", email: "", password: "", usertype: "csr" });
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Could not create user" });
        }
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

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        placeholder="Full name"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        placeholder="email@example.com"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                        type="text"
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        placeholder="Enter a password"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User Type</label>
                    <select
                        value={form.usertype}
                        onChange={(e) => setForm((f) => ({ ...f, usertype: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    >
                        <option value="admin">Admin</option>
                        <option value="csr">CSR</option>
                        <option value="operator">Operator</option>
                    </select>
                </div>

                <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 transition"
                >
                    <UserPlus className="h-4 w-4" />
                    Create User
                </button>
            </form>
        </div>
    );
}