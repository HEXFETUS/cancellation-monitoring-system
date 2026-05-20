import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";

export default function DashboardLayout() {
    const location = useLocation();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const closeMobileSidebar = () => setMobileSidebarOpen(false);

const navItems = [
    { name: "Dashboard", path: "/app/dashboard" },
    { name: "POS Inventory", path: "/app/pos" },
    { name: "POS Repair Request", path: "/app/pos-repair" },
    { name: "Cancellation", path: "/app/cancellation" },
    { name: "Asset Inventory", path: "/app/asset-inventory" },
    { name: "Settings", path: "/app/settings" },
];

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
            {/* Mobile header bar */}
            <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-3 lg:hidden">
                <button
                    onClick={() => setMobileSidebarOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 shadow-lg backdrop-blur-xl"
                >
                    <Menu className="h-5 w-5 text-slate-700" />
                </button>
            </div>

            {/* Mobile sidebar overlay */}
            {mobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
                    onClick={closeMobileSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 w-72 p-4 transition-transform duration-300 lg:relative lg:translate-x-0
                    ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `}
            >
                <div
                    className="relative h-full rounded-3xl border shadow-2xl backdrop-blur-2xl p-6 flex flex-col"
                    style={{
                        background: "rgba(255, 255, 255, 0.95)",
                        border: "1px solid rgba(255, 255, 255, 0.45)",
                        boxShadow:
                            "0 8px 32px rgba(31, 38, 135, 0.12), inset 0 1px 0 rgba(255,255,255,0.65)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                    }}
                >
                    {/* Mobile close button */}
                    <button
                        onClick={closeMobileSidebar}
                        className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white lg:hidden"
                    >
                        <X className="h-4 w-4 text-slate-500" />
                    </button>

                    {/* Logo */}
                    <div className="mb-10">
                        <Link
                            to="/"
                            onClick={closeMobileSidebar}
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
                    <nav className="space-y-5 flex-1 overflow-y-auto">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={closeMobileSidebar}
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
                                        className={`font-xs transition-colors duration-300 ${
                                            isActive
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

                    {/* Status */}
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
            <main className="flex-1 overflow-auto pt-16 lg:pt-0">
                <div
                    className="m-3 min-h-full rounded-3xl border shadow-2xl backdrop-blur-2xl p-4 sm:p-6 lg:m-8 lg:p-10"
                    style={{
                        background: "rgba(255, 255, 255, 0.22)",
                        border: "1px solid rgba(255, 255, 255, 0.45)",
                        boxShadow:
                            "0 8px 32px rgba(31, 38, 135, 0.10), inset 0 1px 0 rgba(255,255,255,0.65)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                    }}
                >
                    <Outlet />
                </div>
            </main>
        </div>
    );
}