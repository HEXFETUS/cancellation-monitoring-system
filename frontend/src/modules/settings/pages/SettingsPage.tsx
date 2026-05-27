import { useEffect, useState } from "react";
import { Users, UserPlus, ClipboardList, Menu, Check, X, Building2 } from "lucide-react";
import UserAccountsPage from "./UserAccountsPage";
import CreateUserAccountPage from "./CreateUserAccountPage";
import UserLogsPage from "./UserLogsPage";
import OperatorProfilesPage from "./OperatorProfilesPage";
import MyAccountPage from "./MyAccountPage";
import { useAuth } from "../../../context/AuthContext";

const teal = "#92C7CF";

const leftTabs = [
    { id: "user-accounts", label: "USERS", icon: Users },
];

const userSubTabs = [
    { id: "accounts", label: "User Accounts", icon: Users },
    { id: "create-user", label: "Create User", icon: UserPlus },
    { id: "operator-profiles", label: "Operator Profiles", icon: Building2 },
    { id: "user-logs", label: "User Logs", icon: ClipboardList },
];

export default function SettingsPage() {
    const { user } = useAuth();

    // Operators and purchasers get a slim, self-scoped settings view (My Account only).
    // Admin/CSR see the full management UI below.
    if (user?.usertype === "operator" || user?.usertype === "purchaser") {
        return <MyAccountPage />;
    }

    return <AdminSettingsPage />;
}

function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState("user-accounts");
    const [activeUserSubTab, setActiveUserSubTab] = useState("accounts");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!successMessage) return;

        const timer = window.setTimeout(() => {
            setSuccessMessage(null);
        }, 3000);

        return () => window.clearTimeout(timer);
    }, [successMessage]);

    return (
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            {/* Left sidebar tabs — collapsible */}
            <div
                className={`transition-all duration-300 ${
                    sidebarOpen
                        ? "lg:w-60 lg:shrink-0"
                        : "lg:w-20 lg:shrink-0"
                }`}
            >
                <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:space-y-3 lg:overflow-visible lg:pb-0">
                    {/* Collapse toggle button — icon only */}
                    <button
                        onClick={() => setSidebarOpen((v) => !v)}
                        className="hidden lg:flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 lg:w-full lg:gap-3 lg:px-4 lg:py-3 text-slate-600 hover:bg-white/40 hover:text-slate-800"
                        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                    >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                            style={{
                                background: "rgba(146,199,207,0.12)",
                                color: teal,
                            }}
                        >
                            <Menu className="h-5 w-5" />
                        </span>
                    </button>
                    {leftTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        const isCollapsed = !sidebarOpen;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className="flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-left text-xs font-sm transition-all duration-200 lg:w-full lg:gap-3 lg:px-3 lg:py-2"
                                style={{
                                    background: isActive
                                        ? "rgba(146,199,207,0.15)"
                                        : "transparent",
                                    border: isActive
                                        ? "1px solid rgba(146,199,207,0.25)"
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
                                <span
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300"
                                    style={{
                                        background: isActive
                                            ? "rgba(146,199,207,0.20)"
                                            : "rgba(0,0,0,0.03)",
                                        color: isActive ? teal : "#9CA3AF",
                                    }}
                                >
                                    <Icon className="h-5 w-5" />
                                </span>
                                <span
                                    className={`whitespace-nowrap lg:whitespace-normal transition-all duration-200 ${
                                        isCollapsed ? "hidden" : "inline"
                                    }`}
                                >
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 min-w-0">
                {activeTab === "user-accounts" && (
                    <div>
                        {/* Sub-tabs */}
                        <div className="flex flex-col gap-3 mb-5 border-b pb-0 sm:flex-row sm:items-center sm:justify-between"
                            style={{ borderColor: "rgba(146,199,207,0.25)" }}
                        >
                            <div className="flex gap-1 overflow-x-auto">
                                {userSubTabs.map((tab) => {
                                    const Icon = tab.icon;
                                    const isSubActive = activeUserSubTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveUserSubTab(tab.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-t-xl cursor-pointer whitespace-nowrap"
                                            style={{
                                                background: isSubActive
                                                    ? "rgba(146,199,207,0.15)"
                                                    : "transparent",
                                                border: isSubActive
                                                    ? "1px solid rgba(146,199,207,0.25)"
                                                    : "1px solid transparent",
                                                borderBottom: isSubActive
                                                    ? "1px solid white"
                                                    : "1px solid transparent",
                                                color: isSubActive ? "#1F2937" : "#6B7280",
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isSubActive) {
                                                    e.currentTarget.style.background = "rgba(146,199,207,0.06)";
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSubActive) {
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

                            {successMessage && (
                                <div className="mb-2 rounded-xl bg-teal px-4 py-2 text-sm font-medium text-white shadow-lg flex items-center gap-2 animate-[slideDown_0.3s_ease-out] ring-1 ring-teal-dark/30 sm:mb-1 sm:max-w-md">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                                        <Check size={15} className="text-white" />
                                    </div>
                                    <span className="truncate">{successMessage}</span>
                                    <button
                                        onClick={() => setSuccessMessage(null)}
                                        className="ml-auto rounded-lg p-0.5 hover:bg-white/20 transition-colors cursor-pointer"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div>
                            {activeUserSubTab === "accounts" && <UserAccountsPage onSuccess={setSuccessMessage} />}
                            {activeUserSubTab === "create-user" && <CreateUserAccountPage />}
                            {activeUserSubTab === "operator-profiles" && <OperatorProfilesPage />}
                            {activeUserSubTab === "user-logs" && <UserLogsPage />}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
