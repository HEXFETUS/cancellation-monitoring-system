import { useEffect, useState } from "react";
import { Users, UserPlus, Check, X, Building2, Activity, Megaphone, Newspaper } from "lucide-react";
import UserAccountsPage from "./UserAccountsPage";
import CreateUserAccountPage from "./CreateUserAccountPage";
import OperatorProfilesPage from "./OperatorProfilesPage";
import ActivityLogsPage from "./ActivityLogsPage";
import AnnouncementsPage from "../../announcements/pages/AnnouncementsPage";
import EventsNewsAdminPage from "../../landing-page/pages/EventsNewsAdminPage";
import ResultsAdminPage from "../../landing-page/pages/ResultsAdminPage";
import HomeAdminPage from "../../landing-page/pages/HomeAdminPage";
import SocialResponsibilityAdminPage from "../../landing-page/pages/SocialResponsibilityAdminPage";
import AboutUsAdminPage from "../../landing-page/pages/AboutUsAdminPage";
import { useAuth } from "../../../context/AuthContext";
import { TopTabs } from "../../../shared/components";

const mainTabs = [
    { id: "user-accounts", label: "Users", icon: Users },
    { id: "announcements", label: "Announcements", icon: Megaphone },
    { id: "landing-page", label: "Landing Page", icon: Newspaper },
    { id: "activity-logs", label: "Activity Logs", icon: Activity },
];

const landingSubTabs = [
    { id: "home", label: "Home" },
    { id: "events-news", label: "Events & News" },
    { id: "results", label: "Results" },
    { id: "social-responsibility", label: "Social Responsibility" },
    { id: "about-us", label: "About Us" },
];

const userSubTabs = [
    { id: "accounts", label: "User Accounts", icon: Users },
    { id: "create-user", label: "Create User", icon: UserPlus },
    { id: "operator-profiles", label: "Operator Profiles", icon: Building2 },
];

export default function SettingsPage() {
    const { user } = useAuth();

    // Operators see a limited view with only the Operator Profiles tab
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
    const [activeLandingSubTab, setActiveLandingSubTab] = useState("home");
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

    const successToast = successMessage ? (
        <div className="mb-2 rounded-xl bg-teal px-4 py-2 text-sm font-medium text-white shadow-lg flex items-center gap-2 animate-[slideDown_0.3s_ease-out] ring-1 ring-teal-dark/30 sm:max-w-md">
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
    ) : null;

    return (
        <div className="flex flex-col gap-5">
            <TopTabs
                tabs={mainTabs}
                activeId={activeTab}
                onChange={setActiveTab}
                ariaLabel="Settings sections"
            />

            <div className="min-w-0">
                {activeTab === "user-accounts" && (
                    <div className="flex flex-col gap-5">
                        <TopTabs
                            variant="secondary"
                            tabs={userSubTabs}
                            activeId={activeUserSubTab}
                            onChange={setActiveUserSubTab}
                            rightSlot={successToast}
                            darkMode={darkMode}
                            className="border-b-0"
                            ariaLabel="User account sub-sections"
                        />

                        <div>
                            {activeUserSubTab === "accounts" && <UserAccountsPage onSuccess={setSuccessMessage} />}
                            {activeUserSubTab === "create-user" && <CreateUserAccountPage />}
                            {activeUserSubTab === "operator-profiles" && <OperatorProfilesPage />}
                        </div>
                    </div>
                )}

                {activeTab === "announcements" && <AnnouncementsPage />}
                {activeTab === "landing-page" && (
                    <div className="flex flex-col gap-5">
                        <TopTabs
                            variant="secondary"
                            tabs={landingSubTabs}
                            activeId={activeLandingSubTab}
                            onChange={setActiveLandingSubTab}
                            ariaLabel="Landing page sub-sections"
                        />
                        {activeLandingSubTab === "home" && <HomeAdminPage />}
                        {activeLandingSubTab === "social-responsibility" && <SocialResponsibilityAdminPage />}
                        {activeLandingSubTab === "about-us" && <AboutUsAdminPage />}
                        {activeLandingSubTab === "events-news" && <EventsNewsAdminPage />}
                        {activeLandingSubTab === "results" && <ResultsAdminPage />}
                    </div>
                )}
                {activeTab === "activity-logs" && <ActivityLogsPage />}
            </div>
        </div>
    );
}
