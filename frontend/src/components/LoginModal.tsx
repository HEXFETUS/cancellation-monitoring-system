import { useState } from "react";
import { ArrowRight, X, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function LoginModal({ open, onClose, onSuccess }: Props) {
    const { login } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!username.trim() || !password.trim()) {
            setError("Please fill in all fields.");
            return;
        }

        const success = await login(username.trim(), password);
        if (success) {
            setUsername("");
            setPassword("");
            onSuccess();
        } else {
            setError("Invalid email or password.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div
                className="relative w-full max-w-md rounded-3xl border shadow-2xl backdrop-blur-2xl p-8 mx-4"
                style={{
                    background: "rgba(255, 255, 255, 0.66)",
                    border: "1px solid rgba(255, 255, 255, 0.50)",
                    boxShadow:
                        "0 20px 60px rgba(31, 38, 135, 0.18), inset 0 1px 0 rgba(255,255,255,0.65)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-5 top-5 rounded-xl p-1.5 text-gray-500 transition-colors hover:bg-white/20 hover:text-gray-800"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-800">Welcome back</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Sign in to access the dashboard.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                    {/* Username */}
                    <div>
                        <label
                            htmlFor="login-username"
                            className="block text-sm font-semibold text-gray-700 mb-1.5"
                        >
                            Email
                        </label>
                        <input
                            id="login-username"
                            type="email"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your email"
                            autoComplete="email"
                            className="w-full rounded-2xl border bg-white/40 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:bg-white/60 focus:ring-2 focus:ring-gray-300/50"
                            style={{
                                border: "1px solid rgba(255, 255, 255, 0.50)",
                            }}
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label
                            htmlFor="login-password"
                            className="block text-sm font-semibold text-gray-700 mb-1.5"
                        >
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="login-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                className="w-full rounded-2xl border bg-white/40 px-4 py-3 pr-11 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:bg-white/60 focus:ring-2 focus:ring-gray-300/50"
                                style={{
                                    border: "1px solid rgba(255, 255, 255, 0.50)",
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-sm font-medium text-red-600">{error}</p>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                        style={{
                            background:
                                "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                        }}
                    >
                        Sign In
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
