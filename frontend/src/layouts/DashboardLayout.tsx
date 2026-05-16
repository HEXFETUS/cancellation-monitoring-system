import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface Props {
    children: ReactNode;
}

const menuItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Inventory", path: "/inventory" },
    { name: "Automation", path: "/automation" },
    { name: "Cancellation", path: "/cancellation" },
    { name: "Records", path: "/records" },
    { name: "Reports", path: "/reports" },
    { name: "Settings", path: "/settings" },
];

export default function DashboardLayout({ children }: Props) {
    const location = useLocation();
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <div
            className="flex h-screen"
            style={{
                background: `
                    radial-gradient(circle at top left, rgba(146,199,207,0.35), transparent 35%),
                    radial-gradient(circle at bottom right, rgba(170,215,217,0.30), transparent 40%),
                    linear-gradient(135deg, #FBF9F1 0%, #E5E1DA 100%)
                `,
            }}
        >
            {/* Sidebar */}
            <aside className="w-72 p-4">
                <div
                    className="h-full rounded-3xl border shadow-2xl backdrop-blur-2xl p-6 flex flex-col"
                    style={{
                        background: "rgba(255, 255, 255, 0.28)",
                        border: "1px solid rgba(255, 255, 255, 0.45)",
                        boxShadow:
                            "0 8px 32px rgba(31, 38, 135, 0.12), inset 0 1px 0 rgba(255,255,255,0.65)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                    }}
                >
                    {/* Logo / Title */}
                    <div className="mb-10">
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center w-51 h-12 rounded-2xl shadow-lg mb-1"
                            style={{
                                background:
                                    "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                            }}
                        >
                            <span className="text-white font-bold text-lg">
                                Hexaprime Inc.
                            </span>
                        </Link>

                    </div>

                    {/* Navigation */}
                    <nav className="space-y-3 flex-1">
                        {menuItems.map((item) => {
                            const isActive =
                                location.pathname === item.path;

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className="group relative flex items-center px-4 py-2 rounded-2xl transition-all duration-300"
                                    style={{
                                        background: isActive
                                            ? "rgba(146, 199, 207, 0.20)"
                                            : "transparent",
                                        border: isActive
                                            ? "1px solid rgba(146, 199, 207, 0.35)"
                                            : "1px solid transparent",
                                        boxShadow: isActive
                                            ? "inset 0 .5px 0 rgba(255,255,255,0.5)"
                                            : "none",
                                    }}
                                >
                                    {/* Accent Dot */}
                                    <span
                                        className="w-2 h-2 rounded-full mr-3 transition-all duration-300"
                                        style={{
                                            backgroundColor: isActive
                                                ? "#92C7CF"
                                                : "#D1D5DB",
                                            boxShadow: isActive
                                                ? "0 0 12px rgba(146,199,207,0.6)"
                                                : "none",
                                        }}
                                    />

                                    <span
                                        className={`font-xs transition-colors duration-300 ${isActive
                                                ? "text-gray-800"
                                                : "text-gray-600 group-hover:text-gray-800"
                                            }`}
                                    >
                                        {item.name}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-3 rounded-2xl transition-all duration-300 text-gray-600 hover:text-gray-800 hover:bg-white/20 border border-transparent hover:border-white/30"
                    >
                        <LogOut className="h-4 w-4 mr-3" />
                        <span className="font-medium text-sm">Sign Out</span>
                    </button>

                    {/* Footer */}
                    <div
                        className="mt-3 rounded-2xl p-4 border"
                        style={{
                            background: "rgba(255, 255, 255, 0.20)",
                            border: "1px solid rgba(255, 255, 255, 0.35)",
                        }}
                    >
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                            Status
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-700">
                            System Online
                        </p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 overflow-auto">
                <div
                    className="min-h-full rounded-3xl border shadow-2xl backdrop-blur-2xl p-8"
                    style={{
                        background: "rgba(255, 255, 255, 0.22)",
                        border: "1px solid rgba(255, 255, 255, 0.45)",
                        boxShadow:
                            "0 8px 32px rgba(31, 38, 135, 0.10), inset 0 1px 0 rgba(255,255,255,0.65)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                    }}
                >
                    {children}
                </div>
            </main>
        </div>
    );
}
