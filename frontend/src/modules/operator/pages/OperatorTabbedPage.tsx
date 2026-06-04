import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Monitor, RefreshCw, Send, Search } from "lucide-react";
import OperatorPosPage from "./OperatorPosPage";
import RequestPosPage from "./RequestPosPage";
import { useAuth } from "../../../context/AuthContext";
import { listOperatorChangeRequests } from "../../pos/services/operatorChangeRequests";

const teal = "#92C7CF";

type TabId = "my-pos" | "request-pos";

interface Tab {
    id: TabId;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TABS: Tab[] = [
    { id: "my-pos", label: "My POS", icon: Monitor },
    { id: "request-pos", label: "Add POS", icon: Send },
];

function getValidTab(raw: string | null): TabId {
    if (raw === "my-pos" || raw === "request-pos") return raw;
    return "my-pos";
}

export default function OperatorTabbedPage() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabId>(() => getValidTab(searchParams.get("tab")));
    const [pendingRequestCount, setPendingRequestCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
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

    const searchInputStyle = {
        background: darkMode ? "rgba(31,41,55,0.70)" : "rgba(255,255,255,0.82)",
        border: darkMode ? "1px solid rgba(75,85,99,0.55)" : "1px solid rgba(146,199,207,0.30)",
        color: darkMode ? "#F3F4F6" : "#1F2937",
        boxShadow: darkMode ? "none" : "0 1px 2px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.70)",
    };

    const fetchCount = useCallback(async () => {
        if (!user?.id) return;
        try {
            const reqs = await listOperatorChangeRequests({ status: "pending", userId: user.id });
            setPendingRequestCount(reqs.length);
        } catch {
            setPendingRequestCount(0);
        }
    }, [user]);

    useEffect(() => {
        let cancelled = false;
        const fn = async () => {
            await fetchCount();
        };
        if (!cancelled) fn();
        const interval = window.setInterval(fetchCount, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchCount();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [activeTab, fetchCount]);

    return (
        <div className="space-y-5">
            {/* Top bar: tabs + toolbar on same row */}
            <div
                className="flex items-center justify-between border-b pb-0"
                style={{ borderColor: darkMode ? "rgba(75,85,99,0.55)" : "rgba(229,225,218,0.90)" }}
            >
                {/* Tabs */}
                <div className="flex">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setSearchParams({ tab: tab.id }, { replace: true });
                                }}
                                className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm transition-all duration-200 font-medium`}
                                style={{
                                    borderBottomColor: isActive ? teal : "transparent",
                                    color: isActive
                                        ? darkMode
                                            ? "#FFFFFF"
                                            : "#374151"
                                        : "#9CA3AF",
                                }}
                            >
                                <Icon size={16} />
                                {tab.label}
                                {tab.id === "request-pos" && pendingRequestCount > 0 && (
                                    <span
                                        className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                                        style={{
                                            background: "linear-gradient(135deg, #F59E0B, #FB923C)",
                                            boxShadow: "0 2px 6px rgba(245,158,11,0.35)",
                                        }}
                                    >
                                        {pendingRequestCount > 99 ? "99+" : pendingRequestCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Toolbar — only visible for "My POS" tab */}
                {activeTab === "my-pos" && (
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search device no. or serial..."
                                className="h-9 w-64 rounded-lg py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:border-[#92C7CF] dark:focus:border-teal focus:outline-none focus:ring-1 focus:ring-[#92C7CF] dark:focus:ring-teal/50 transition"
                                style={searchInputStyle}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setRefreshKey((k) => k + 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#92C7CF]/50"
                            aria-label="Refresh"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Active tab content */}
            <div>
                {activeTab === "my-pos" && (
                    <OperatorPosPage searchQuery={searchQuery} refreshKey={refreshKey} />
                )}
                {activeTab === "request-pos" && <RequestPosPage />}
            </div>
        </div>
    );
}
