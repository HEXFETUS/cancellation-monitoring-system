import { useState } from "react";
import { Wrench, BarChart3, FileSearch, Menu } from "lucide-react";
import RepairRequestPage from "./RepairRequestPage";
import RepairLogPage from "./RepairLogPage";
import ReleasedLogPage from "./ReleasedLogPage";
import DiagnosisListPage from "./DiagnosisListPage";

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
                        className={`hidden lg:flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 lg:w-full lg:gap-3 lg:px-4 lg:py-3 text-slate-600 hover:bg-slate-100 hover:text-slate-800`}
                        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                    >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
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
                {activeTab === "repair-request" && <RepairRequestPage />}
                {activeTab === "diagnosis" && <DiagnosisListPage />}
                {activeTab === "reports" && (
                    <div>
                        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
                            {subTabs.map((tab) => {
                                const isActive = activeSubTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveSubTab(tab.id)}
                                        className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 sm:px-4 sm:text-sm ${
                                            isActive
                                                ? "bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200"
                                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                        }`}
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