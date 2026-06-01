import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import {
    LogOut,
    Menu,
    X,
    LayoutDashboard,
    Monitor,
    Wrench,
    FileText,
    Package,
    Settings,
    User,
    Building2,
    MapPin,
    Eye,
    Code,
    ClipboardList,
    ArrowUpRight,
    Stethoscope,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useState } from "react";

const teal = "#92C7CF";
const tealLight = "#AAD7D9";
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

type SidebarUser = {
    id?: number;
    name?: string;
    email?: string;
    usertype?: string;
    department?: string;
};

import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
    Dashboard: LayoutDashboard,
    "My POS": Monitor,
    "POS Inventory": Monitor,
    "POS": Monitor,
    "POS Repair": Wrench,
    Cancellation: FileText,
    "Asset Inventory": Package,
    Summary: LayoutDashboard,
    Office: Building2,
    Payout: MapPin,
    Drawcourt: Monitor,
    OBS: Eye,
    "Asset Coding": Code,
    "Repair Request": ClipboardList,
    "Repair Management": Wrench,
    "Repair Log": FileText,
    "Released Log": ArrowUpRight,
    "Diagnosis List": Stethoscope,
    Settings: Settings,
};

export default function DashboardLayout() {
    const location = useLocation();
    const { logout, user: authUser } = useAuth();
    const navigate = useNavigate();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [sidebarUser, setSidebarUser] = useState<SidebarUser | null>(authUser);

    useEffect(() => {
        setSidebarUser(authUser);

        if (!authUser?.id) return;

        let ignored = false;

        fetch(`${API_BASE_URL}/api/users/me?id=${authUser.id}`)
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Failed to fetch current user");
                }

                return res.json();
            })
            .then((data: SidebarUser) => {
                if (!ignored) {
                    setSidebarUser({ ...authUser, ...data });
                }
            })
            .catch(() => {});

        return () => {
            ignored = true;
        };
    }, [authUser]);

    const displayName = sidebarUser?.name?.trim() || authUser?.name?.trim() || "User";
    const displayDepartment = sidebarUser?.department?.trim() || authUser?.department?.trim();
    let sidebarDisplayName = displayDepartment
        ? `${displayDepartment}-${displayName}`
        : displayName;
    const displayUserType =
        sidebarUser?.usertype?.trim() || authUser?.usertype?.trim() || "Unknown role";

    const handleLogout = async () => {
        await logout();
        navigate("/");
    };

    const closeMobileSidebar = () => setMobileSidebarOpen(false);

    const isOperator = (sidebarUser?.usertype ?? authUser?.usertype) === "operator";
    const isPurchaser = (sidebarUser?.usertype ?? authUser?.usertype) === "purchaser";
    const isCsr = (sidebarUser?.usertype ?? authUser?.usertype) === "csr";

    // For CSR, show "CSR-Name" instead of department prefix like "ACCOUNT-Name"
    if (isCsr) {
        sidebarDisplayName = `CSR-${displayName}`;
    }

    // Operators get a slim sidebar with only their own POS view.
    // Purchasers get one sidebar entry per asset section (instead of
    // a single "Assets" link that hid the sub-tabs inside).
    // CSR gets only Dashboard and POS Repair.
    // Admin see the full menu.
    const navItems = isOperator
        ? [
            { name: "Dashboard", path: "/app/dashboard" },
            { name: "My POS", path: "/app/my-pos" },
            { name: "Settings", path: "/app/settings" },
        ]
        : isPurchaser
            ? [
                { name: "Summary", path: "/app/asset-inventory/summary" },
                { name: "Office", path: "/app/asset-inventory/office" },
                { name: "Payout", path: "/app/asset-inventory/payout" },
                { name: "Drawcourt", path: "/app/asset-inventory/drawcourt" },
                { name: "OBS", path: "/app/asset-inventory/obs" },
                { name: "Asset Coding", path: "/app/asset-inventory/asset-coding" },
                { name: "Settings", path: "/app/settings" },
            ]
            : isCsr
                ? [
                    { name: "Dashboard", path: "/app/dashboard" },
                    { name: "Repair Request", path: "/app/csr-pos-repair/repair-request" },
                    { name: "Repair Management", path: "/app/csr-pos-repair/repair-management" },
                    { name: "Repair Log", path: "/app/csr-pos-repair/repair-log" },
                    { name: "Released Log", path: "/app/csr-pos-repair/released-log" },
                    { name: "Diagnosis List", path: "/app/csr-pos-repair/diagnosis-list" },
                ]
                : [
                    { name: "Dashboard", path: "/app/dashboard" },
                    { name: "POS", path: "/app/pos" },
                    { name: "POS Repair", path: "/app/pos-repair" },
                    { name: "Cancellation", path: "/app/cancellation" },
                    { name: "Assets", path: "/app/asset-inventory" },
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
                    fixed inset-y-0 left-0 z-50 w-72 p-3 transition-transform duration-300 lg:relative lg:translate-x-0
                    ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `}
            >
                <div
                    className="relative h-full rounded-3xl p-5 flex flex-col overflow-hidden"
                    style={{
                        background: `
                            linear-gradient(
                                160deg,
                                rgba(255,255,255,0.98) 0%,
                                rgba(255,255,255,0.90) 40%,
                                rgba(251,249,241,0.95) 100%
                            )
                        `,
                        border: "1px solid rgba(146,199,207,0.20)",
                        boxShadow: `
                            0 8px 32px rgba(31, 38, 135, 0.12),
                            inset 0 1px 0 rgba(255,255,255,0.80),
                            inset 0 -1px 0 rgba(146,199,207,0.06)
                        `,
                        backdropFilter: "blur(24px)",
                        WebkitBackdropFilter: "blur(24px)",
                    }}
                >
                    {/* Decorative top-right blob */}
                    <div
                        className="absolute -top-16 -right-16 w-36 h-36 rounded-full opacity-10 blur-3xl pointer-events-none"
                        style={{
                            background: `radial-gradient(circle, ${tealLight}, ${teal})`,
                        }}
                    />
                    {/* Decorative bottom-left blob */}
                    <div
                        className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full opacity-8 blur-3xl pointer-events-none"
                        style={{
                            background: `radial-gradient(circle, ${teal}, ${tealLight})`,
                        }}
                    />

                    {/* Mobile close button */}
                    <button
                        onClick={closeMobileSidebar}
                        className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white/80 lg:hidden"
                    >
                        <X className="h-4 w-4 text-slate-500" />
                    </button>

                    {/* ===== Logo Section ===== */}
                    <div className="relative mb-5 mt-1">
                        <Link
                            to="/"
                            onClick={closeMobileSidebar}
                            className="group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-300"
                            style={{
                                background: "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                                boxShadow: "0 4px 20px rgba(146,199,207,0.35)",
                            }}
                        >
                            {/* Glow effect */}
                            <div
                                className="absolute inset-0 rounded-2xl opacity-30 blur-md transition-all duration-500 group-hover:opacity-50"
                                style={{
                                    background: "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                                }}
                            />
                            <div className="relative flex items-center gap-3">
                                <img
                                    src="/src/assets/LogoOnly.webp"
                                    alt="Logo"
                                    className="h-8 w-8 rounded-xl object-contain"
                                />
                                <div>
                                    <span className="block text-white font-bold text-sm tracking-tight">
                                        Hexaprime
                                    </span>
                                    <span className="block text-white/70 text-[10px] font-medium tracking-wide">
                                        Management System
                                    </span>
                                </div>
                            </div>
                        </Link>
                    </div>

                    {/* ===== Navigation ===== */}
                    <nav className="relative flex-1 min-h-0 overflow-y-auto space-y-1">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            const Icon = iconMap[item.name] || LayoutDashboard;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={closeMobileSidebar}
                                    className="group relative flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-300"
                                    style={{
                                        background: isActive
                                            ? `linear-gradient(135deg, rgba(146,199,207,0.18), rgba(170,215,217,0.08))`
                                            : "transparent",
                                        border: isActive
                                            ? "1px solid rgba(146,199,207,0.25)"
                                            : "1px solid transparent",
                                        boxShadow: isActive
                                            ? "0 2px 12px rgba(146,199,207,0.10), inset 0 1px 0 rgba(255,255,255,0.5)"
                                            : "none",
                                    }}
                                >
                                    {/* Active indicator bar */}
                                    {isActive && (
                                        <span
                                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                                            style={{
                                                background: `linear-gradient(180deg, ${teal}, ${tealLight})`,
                                                boxShadow: `0 0 12px rgba(146,199,207,0.5)`,
                                            }}
                                        />
                                    )}

                                    {/* Icon container */}
                                    <div
                                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110"
                                        style={{
                                            background: isActive
                                                ? `linear-gradient(135deg, ${teal}30, ${tealLight}20)`
                                                : "rgba(0,0,0,0.03)",
                                            color: isActive ? teal : "#6B7280",
                                        }}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </div>

                                    {/* Label */}
                                    <span
                                        className="text-[13px] font-medium transition-colors duration-300"
                                        style={{
                                            color: isActive ? "#1F2937" : "#6B7280",
                                        }}
                                    >
                                        {item.name}
                                    </span>

                                    {/* Active dot */}
                                    {isActive && (
                                        <span
                                            className="ml-auto w-1.5 h-1.5 rounded-full"
                                            style={{
                                                background: teal,
                                                boxShadow: `0 0 8px ${teal}`,
                                            }}
                                        />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* ===== Divider ===== */}
                    <div
                        className="relative my-2 h-px rounded-full"
                        style={{
                            background: `linear-gradient(90deg, transparent, rgba(146,199,207,0.20), transparent)`,
                        }}
                    />

                    {/* ===== Bottom Section ===== */}
                    <div className="relative space-y-2">
                        {/* User info */}
                        <div
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-300 hover:bg-white/30"
                            style={{
                                background: "rgba(146,199,207,0.06)",
                                border: "1px solid rgba(146,199,207,0.12)",
                            }}
                        >
                            <div
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-white text-sm font-bold shrink-0"
                                style={{
                                    background: `linear-gradient(135deg, ${teal}, ${tealLight})`,
                                    boxShadow: `0 2px 12px rgba(146,199,207,0.30)`,
                                }}
                            >
                                <User className="h-4 w-4 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold text-gray-800 truncate">
                                    {sidebarDisplayName}
                                </p>
                                <p className="text-[10px] text-gray-500 truncate uppercase">
                                    {displayUserType}
                                </p>
                            </div>
                            {/* Online status */}
                            <span
                                className="inline-block w-2 h-2 rounded-full shrink-0 animate-pulse"
                                style={{ backgroundColor: "#6BBF6B" }}
                            />
                        </div>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="group flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-all duration-300 border border-transparent hover:border-red-200/50"
                            style={{
                                color: "#9CA3AF",
                                background: "transparent",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(232,180,184,0.10)";
                                e.currentTarget.style.color = "#DC2626";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = "#9CA3AF";
                            }}
                        >
                            <div
                                className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110"
                                style={{
                                    background: "rgba(0,0,0,0.03)",
                                }}
                            >
                                <LogOut className="h-4 w-4" />
                            </div>
                            <span className="text-[13px] font-medium">Sign Out</span>
                        </button>
                    </div>

                    {/* ===== System Status Badge ===== */}
                    <div
                        className="relative mt-2 rounded-xl px-3 py-2 flex items-center gap-2"
                        style={{
                            background: "linear-gradient(135deg, rgba(107,191,107,0.08), rgba(146,199,207,0.06))",
                            border: "1px solid rgba(107,191,107,0.15)",
                        }}
                    >
                        <span
                            className="inline-block w-2 h-2 rounded-full animate-pulse shrink-0"
                            style={{ backgroundColor: "#6BBF6B" }}
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-emerald-700 truncate">
                                All Systems Normal
                            </p>
                        </div>
                        <div
                            className="flex items-center justify-center w-5 h-5 rounded-full"
                            style={{ background: "rgba(107,191,107,0.15)" }}
                        >
                            <span className="text-[9px] font-bold text-emerald-600">✓</span>
                        </div>
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
