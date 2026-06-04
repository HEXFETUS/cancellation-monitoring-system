import { useEffect, useState } from "react";
import { Users, UserPlus, ClipboardList, Check, X, Building2, UserCircle, Activity } from "lucide-react";
import UserAccountsPage from "./UserAccountsPage";
import CreateUserAccountPage from "./CreateUserAccountPage";
import UserLogsPage from "./UserLogsPage";
import OperatorProfilesPage from "./OperatorProfilesPage";
import MyAccountPage from "./MyAccountPage";
import ActivityLogsPage from "./ActivityLogsPage";
import { useAuth } from "../../../context/AuthContext";

const teal = "#92C7CF";

const leftTabs = [
    { id: "user-accounts", label: "USERS", icon: Users },
    { id: "activity-logs", label: "ACTIVITY LOGS", icon: Activity },
    { id: "my-account", label: "MY ACCOUNT", icon: UserCircle },
];

const userSubTabs = [
    { id: "accounts", label: "User Accounts", icon: Users },
    { id: "create-user", label: "Create User", icon: UserPlus },
    { id: "operator-profiles", label: "Operator Profiles", icon: Building2 },
    { id: "user-logs", label: "User Logs", icon: ClipboardList },
];

export default function SettingsPage() {
    const { user } = useAuth();

    // Operators, purchasers, and CSR get a slim, self-scoped settings view
    // (My Account only). Admin sees the full management UI below.
    if (
        user?.usertype === "operator" ||
        user?.usertype === "purchaser" ||
        user?.usertype === "csr"
    ) {
        return <MyAccountPage />;
    }

    // Operators see the admin layout but only the "Operator Profiles" tab
    // so they can create user accounts for their sub-operators.
    if (user?.usertype === "operator") {
        return <OperatorSettingsPage />;
    }

    return <AdminSettingsPage />;
}

/** Operator-limited view: only the Operator Profiles page. */
function OperatorSettingsPage() {
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!successMessage) return;
        const timer = window.setTimeout(() => setSuccessMessage(null), 3000);
        return () => window.clearTimeout(timer);
    }, [successMessage]);

    return (
        <div>
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-ink">Sub-Operator User Accounts</h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Manage your sub-operators and create user accounts for them.
                    </p>
                </div>
            </div>

            {successMessage && (
                <div className="mb-4 rounded-xl bg-teal px-4 py-2 text-sm font-medium text-white shadow-lg flex items-center gap-2 ring-1 ring-teal-dark/30">
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

            <OperatorProfilesPage />
        </div>
    );
}

/** Full admin settings with all sub-tabs. */
function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState("user-accounts");
    const [activeUserSubTab, setActiveUserSubTab] = useState("accounts");
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [darkMode, setDarkMode] = useState(() => {
        return document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
    });

    useEffect(() => {
        const syncTheme = () => {
            setDarkMode(document.documentElement.classList.contains("dark"));
        };
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("storage", syncTheme);
        syncTheme();
        return () => {
            observer.disconnect();
            window.removeEventListener("storage", syncTheme);
        };
    }, []);

    useEffect(() => {
        if (!successMessage) return;

        const timer = window.setTimeout(() => {
            setSuccessMessage(null);
        }, 3000);

        return () => window.clearTimeout(timer);
    }, [successMessage]);

    return (
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            {/* Left sidebar tabs — icons only */}
            <div className="lg:w-16 lg:shrink-0">
                <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:space-y-3 lg:overflow-visible lg:pb-0">
                    {leftTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                title={tab.label}
                                aria-label={tab.label}
                                className="flex shrink-0 items-center justify-center rounded-xl transition-all duration-200"
                                style={{
                                    background: isActive
                                        ? "rgba(146,199,207,0.20)"
                                        : "rgba(0,0,0,0.03)",
                                    color: isActive ? teal : "#6B7280",
                                    boxShadow: isActive
                                        ? "0 2px 8px rgba(146,199,207,0.15)"
                                        : "none",
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = "rgba(146,199,207,0.10)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = "rgba(0,0,0,0.03)";
                                    }
                                }}
                            >
                                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                                    <Icon className="h-4 w-4" />
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
                                                color: isSubActive
                                                    ? darkMode
                                                        ? "#FFFFFF"
                                                        : "#1F2937"
                                                    : "#6B7280",
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

                {activeTab === "activity-logs" && <ActivityLogsPage />}

                {activeTab === "my-account" && <MyAccountPage />}
            </div>
        </div>
    );
}