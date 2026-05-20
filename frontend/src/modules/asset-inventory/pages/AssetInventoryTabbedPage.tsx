import { useState } from "react";
import { LayoutDashboard, Building2, MapPin, Monitor, Eye, Code, Menu } from "lucide-react";
import SummaryPage from "./SummaryPage";
import OfficePage from "./OfficePage";
import PayoutPage from "./PayoutPage";
import DrawcourtPage from "./DrawcourtPage";
import ObsPage from "./ObsPage";
import AssetCodingPage from "./AssetCodingPage";

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
    const [sidebarOpen, setSidebarOpen] = useState(true);

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
                {/* Toggle button above the tabs */}
                <div className="mb-4 hidden lg:flex lg:items-center">
                    <button
                        onClick={() => setSidebarOpen((v) => !v)}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-800 hover:shadow-sm transition-all"
                        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:space-y-3 lg:overflow-visible lg:pb-0">
                    {leftTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        const isCollapsed = !sidebarOpen;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 lg:w-full lg:gap-3 lg:px-4 lg:py-3 ${
                                    isActive
                                        ? "bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                                }`}
                            >
                                <span
                                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                        isActive
                                            ? "bg-sky-100 text-sky-600"
                                            : "bg-slate-100 text-slate-500"
                                    }`}
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