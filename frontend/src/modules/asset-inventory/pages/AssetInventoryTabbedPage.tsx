import { useState } from "react";
import { LayoutDashboard, Building2, MapPin, Monitor, Eye, Code } from "lucide-react";
import SummaryPage from "./SummaryPage";
import OfficePage from "./OfficePage";
import PayoutPage from "./PayoutPage";
import DrawcourtPage from "./DrawcourtPage";
import ObsPage from "./ObsPage";
import AssetCodingPage from "./AssetCodingPage";

const teal = "#92C7CF";

const leftTabs = [
    { id: "summary", label: "SUMMARY", icon: LayoutDashboard },
    { id: "office", label: "OFFICE", icon: Building2 },
    { id: "payout", label: "PAYOUT", icon: MapPin },
    { id: "drawcourt", label: "DRAWCOURT", icon: Monitor },
    { id: "obs", label: "OBS", icon: Eye },
    { id: "asset-coding", label: "ASSET CODING", icon: Code },
];

export default function AssetInventoryTabbedPage() {
    const [activeTab, setActiveTab] = useState("summary");

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
                {activeTab === "summary" && <SummaryPage />}
                {activeTab === "office" && <OfficePage />}
                {activeTab === "payout" && <PayoutPage />}
                {activeTab === "drawcourt" && <DrawcourtPage />}
                {activeTab === "obs" && <ObsPage />}
                {activeTab === "asset-coding" && <AssetCodingPage />}
            </div>
        </div>
    );
}
