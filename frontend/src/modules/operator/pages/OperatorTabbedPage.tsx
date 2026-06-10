import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Monitor, Send, Search, RefreshCw, Plus, Smartphone } from "lucide-react";
import OperatorPosPage from "./OperatorPosPage";
import RequestPosPage from "../components/RequestPosPage";
import AddCpPage from "./AddCpPage";
import MyCpPage from "./MyCpPage";
import { useAuth } from "../../../context/AuthContext";
import { listOperatorChangeRequests } from "../../requests/services/operatorChangeRequests";
import { TopTabs } from "../../../shared/components";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

type TabId = "my-pos" | "my-cp" | "request-pos" | "add-cp";

function getValidTab(raw: string | null): TabId {
    if (raw === "my-pos" || raw === "my-cp" || raw === "request-pos" || raw === "add-cp") return raw;
    return "my-pos";
}

interface Me {
    id: number;
    parent_operator_id: number | null;
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
    const [me, setMe] = useState<Me | null>(null);

    // Fetch /api/users/me to determine if the user is a sub-operator
    useEffect(() => {
        if (!user?.id) return;
        fetch(`${API_BASE_URL}/api/users/me?id=${user.id}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                setMe(
                    data
                        ? { id: data.id, parent_operator_id: data.parent_operator_id ?? null }
                        : null
                );
            })
            .catch(() => setMe(null));
    }, [user]);

    const isSubOperator = me?.parent_operator_id != null;

    const tabs: { id: TabId; label: string; icon: typeof Monitor }[] = [
        { id: "my-pos", label: "My POS", icon: Monitor },
        { id: "my-cp", label: "My CP", icon: Smartphone as typeof Monitor },
        ...(!isSubOperator ? [
            { id: "request-pos" as const, label: "Assign POS", icon: Send as typeof Monitor },
            { id: "add-cp" as const, label: "Add CP", icon: Plus as typeof Monitor },
        ] : []),
    ];

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

    const handleChange = (id: string) => {
        const next = id as TabId;
        setActiveTab(next);
        setSearchParams({ tab: next }, { replace: true });
    };

    const toolbar = (activeTab === "my-pos" || activeTab === "my-cp") ? (
        <div className="flex items-center gap-2 pr-2">
            <div className="relative">
                <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search device no. or serial..."
className="h-9 w-64 rounded-lg py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:border-teal dark:focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal dark:focus:ring-teal/50 transition"
                    style={searchInputStyle}
                />
            </div>
            <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal/50"
                aria-label="Refresh"
            >
                <RefreshCw size={16} />
            </button>
        </div>
    ) : null;

    return (
        <div className="space-y-5">
            <TopTabs
                tabs={tabs.map((t) => ({
                    ...t,
                    badge: t.id === "request-pos" ? pendingRequestCount : undefined,
                    badgeColor: "orange",
                }))}
                activeId={activeTab}
                onChange={handleChange}
                rightSlot={toolbar}
                darkMode={darkMode}
                ariaLabel="Operator sections"
            />

            <div>
                {activeTab === "my-pos" && (
                    <OperatorPosPage searchQuery={searchQuery} refreshKey={refreshKey} />
                )}
                {activeTab === "my-cp" && (
                    <MyCpPage searchQuery={searchQuery} refreshKey={refreshKey} />
                )}
                {activeTab === "request-pos" && <RequestPosPage />}
                {activeTab === "add-cp" && <AddCpPage />}
            </div>
        </div>
    );
}
