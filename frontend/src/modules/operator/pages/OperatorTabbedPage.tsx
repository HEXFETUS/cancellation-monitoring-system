import { useEffect, useState } from "react";
import { Monitor, RefreshCw, Send, Search } from "lucide-react";
import MyPosPage from "./MyPosPage";
import RequestPosPage from "./RequestPosPage";
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

export default function OperatorTabbedPage() {
    const [activeTab, setActiveTab] = useState<TabId>("my-pos");
    const [pendingRequestCount, setPendingRequestCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const fetchCount = async () => {
            try {
                const reqs = await listOperatorChangeRequests({ status: "pending" });
                if (!cancelled) setPendingRequestCount(reqs.length);
            } catch {
                if (!cancelled) setPendingRequestCount(0);
            }
        };
        fetchCount();
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
    }, [activeTab]);

    return (
        <div className="space-y-5">
            {/* Top bar: tabs + toolbar on same row */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-0">
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
                                onClick={() => setActiveTab(tab.id)}
                                className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2"
                                style={{
                                    borderBottomColor: isActive ? teal : "transparent",
                                    color: isActive ? "#1F2937" : "#6B7280",
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
                            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search device no. or serial..."
                                className="h-9 w-64 rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-800 placeholder:text-gray-400 shadow-sm focus:border-[#92C7CF] focus:outline-none focus:ring-1 focus:ring-[#92C7CF] transition"
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
                    <MyPosPage searchQuery={searchQuery} refreshKey={refreshKey} />
                )}
                {activeTab === "request-pos" && <RequestPosPage />}
            </div>
        </div>
    );
}