import { useState } from "react";
import { Wrench, BarChart3, FileSearch, Menu } from "lucide-react";
import RepairRequestPage from "./RepairRequestPage";
import RepairLogPage from "./RepairLogPage";
import ReleasedLogPage from "./ReleasedLogPage";
import DiagnosisListPage from "./DiagnosisListPage";

const teal = "#92C7CF";

const leftTabs = [
    { id: "repair-request", label: "REPAIR REQUEST", icon: Wrench },
    { id: "reports", label: "REPORTS", icon: BarChart3 },
    { id: "diagnosis", label: "LIST OF DIAGNOSIS", icon: FileSearch },
];

const subTabs = [
    { id: "repair-logs", label: "Repair Logs" },
    { id: "released-logs", label: "Released Logs" },
];

export default function PosRepairRequestPage() {
    const [activeTab, setActiveTab] = useState("repair-request");
    const [activeSubTab, setActiveSubTab] = useState("repair-logs");
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
                                className="flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 lg:w-full lg:gap-3 lg:px-4 lg:py-3"
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
                {activeTab === "repair-request" && <RepairRequestPage />}
                {activeTab === "diagnosis" && <DiagnosisListPage />}
                {activeTab === "reports" && (
                    <div>
                        <div className="mb-6 flex gap-2 overflow-x-auto border-b pb-2"
                            style={{ borderColor: "rgba(146,199,207,0.20)" }}
                        >
                            {subTabs.map((tab) => {
                                const isSubActive = activeSubTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveSubTab(tab.id)}
                                        className="shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 sm:px-4 sm:text-sm"
                                        style={{
                                            background: isSubActive
                                                ? "rgba(146,199,207,0.15)"
                                                : "transparent",
                                            border: isSubActive
                                                ? "1px solid rgba(146,199,207,0.25)"
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
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div>
                            {activeSubTab === "repair-logs" && <RepairLogPage />}
                            {activeSubTab === "released-logs" && <ReleasedLogPage />}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}