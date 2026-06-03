import { useEffect, useState } from "react";
import { Monitor, Send } from "lucide-react";
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
    { id: "request-pos", label: "Request POS", icon: Send },
];

export default function OperatorTabbedPage() {
    const [activeTab, setActiveTab] = useState<TabId>("my-pos");
    const [pendingRequestCount, setPendingRequestCount] = useState(0);

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
            {/* Top tab bar */}
            <div
                className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/30 shadow-lg p-2"
            >
                <div
                    role="tablist"
                    className="flex flex-wrap items-center gap-1.5"
                >
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActiveTab(tab.id)}
                                className="group inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200"
                                style={{
                                    background: isActive
                                        ? `linear-gradient(135deg, ${teal}30, ${teal}10)`
                                        : "rgba(255,255,255,0.25)",
                                    border: isActive
                                        ? "1px solid rgba(146,199,207,0.45)"
                                        : "1px solid rgba(146,199,207,0.20)",
                                    color: isActive ? "#1F2937" : "#6B7280",
                                    boxShadow: isActive
                                        ? "0 2px 8px rgba(146,199,207,0.25)"
                                        : "none",
                                }}
                            >
                                <Icon size={15} />
                                {tab.label}
                                {tab.id === "request-pos" && pendingRequestCount > 0 && (
                                    <span
                                        className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                                        style={{
                                            background:
                                                "linear-gradient(135deg, #F59E0B, #FB923C)",
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
            </div>

            {/* Active tab content */}
            <div>
                {activeTab === "my-pos" && <MyPosPage />}
                {activeTab === "request-pos" && <RequestPosPage />}
            </div>
        </div>
    );
}
