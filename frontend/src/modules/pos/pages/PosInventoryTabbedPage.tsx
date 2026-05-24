import { useState } from "react";
import { Monitor, Activity, RotateCcw, Store, BarChart3, Menu, FileText, GitBranch, ClipboardList } from "lucide-react";
import AllPosPage from "./AllPosPage";
import PosStatusPage from "./PosStatusPage";
import RequestResetPage from "./RequestResetPage";
import OutletsPage from "./OutletsPage";
import ChangeDeviceLogsPage from "./ChangeDeviceLogsPage";
import ConvertAreaLogsPage from "./ConvertAreaLogsPage";
import PosStatusLogsPage from "./PosStatusLogsPage";

const teal = "#92C7CF";

const leftTabs = [
    { id: "all-pos", label: "POS", icon: Monitor },
    { id: "pos-status", label: "POS STATUS", icon: Activity },
    { id: "request-reset", label: "REQUEST RESET DEVICE", icon: RotateCcw },
    { id: "outlets", label: "OUTLETS", icon: Store },
    { id: "reports", label: "REPORTS", icon: BarChart3 },
];

const reportSubTabs = [
    { id: "change-device-logs", label: "Change Device Logs", icon: FileText },
    { id: "convert-area-logs", label: "Convert Area Logs", icon: GitBranch },
    { id: "pos-status-logs", label: "POS Status Logs", icon: ClipboardList },
];

export default function PosInventoryTabbedPage() {
    const [activeTab, setActiveTab] = useState("all-pos");
    const [activeReportSubTab, setActiveReportSubTab] = useState("change-device-logs");
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
                {activeTab === "all-pos" && <AllPosPage />}
                {activeTab === "pos-status" && <PosStatusPage />}
                {activeTab === "request-reset" && <RequestResetPage />}
                {activeTab === "outlets" && <OutletsPage />}
                {activeTab === "reports" && (
                    <div>
                        {/* Sub-tabs */}
                        <div className="flex gap-1 mb-5 border-b pb-0"
                            style={{ borderColor: "rgba(146,199,207,0.25)" }}
                        >
                            {reportSubTabs.map((tab) => {
                                const Icon = tab.icon;
                                const isSubActive = activeReportSubTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveReportSubTab(tab.id)}
                                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-t-xl cursor-pointer"
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

                        <div>
                            {activeReportSubTab === "change-device-logs" && <ChangeDeviceLogsPage />}
                            {activeReportSubTab === "convert-area-logs" && <ConvertAreaLogsPage />}
                            {activeReportSubTab === "pos-status-logs" && <PosStatusLogsPage />}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
