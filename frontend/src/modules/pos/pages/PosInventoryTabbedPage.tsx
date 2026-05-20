import { useState } from "react";
import { Monitor, Activity, RotateCcw, Users, Store, BarChart3, Menu } from "lucide-react";
import AllPosPage from "./AllPosPage";
import PosStatusPage from "./PosStatusPage";
import RequestResetPage from "./RequestResetPage";
import OperatorsPage from "./OperatorsPage";
import OutletsPage from "./OutletsPage";
import ChangeDeviceMonitoringPage from "./ChangeDeviceMonitoringPage";
import ChangeDeviceLogsPage from "./ChangeDeviceLogsPage";
import ConvertAreaLogsPage from "./ConvertAreaLogsPage";
import PosStatusLogsPage from "./PosStatusLogsPage";

const leftTabs = [
    { id: "all-pos", label: "ALL POS", icon: Monitor },
    { id: "pos-status", label: "POS STATUS", icon: Activity },
    { id: "request-reset", label: "REQUEST RESET DEVICE", icon: RotateCcw },
    { id: "operators", label: "ALL OPERATORS", icon: Users },
    { id: "outlets", label: "ALL OUTLETS", icon: Store },
    { id: "reports", label: "REPORTS", icon: BarChart3 },
];

const reportSubTabs = [
    { id: "change-device-monitoring", label: "Change Device Monitoring" },
    { id: "change-device-logs", label: "Change Device Logs" },
    { id: "convert-area-logs", label: "Convert Area Logs" },
    { id: "pos-status-logs", label: "POS Status Logs" },
];

export default function PosInventoryTabbedPage() {
    const [activeTab, setActiveTab] = useState("all-pos");
    const [activeReportSubTab, setActiveReportSubTab] = useState("change-device-monitoring");
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
                {activeTab === "all-pos" && <AllPosPage />}
                {activeTab === "pos-status" && <PosStatusPage />}
                {activeTab === "request-reset" && <RequestResetPage />}
                {activeTab === "operators" && <OperatorsPage />}
                {activeTab === "outlets" && <OutletsPage />}
                {activeTab === "reports" && (
                    <div>
                        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
                            {reportSubTabs.map((tab) => {
                                const isActive = activeReportSubTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveReportSubTab(tab.id)}
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
                            {activeReportSubTab === "change-device-monitoring" && <ChangeDeviceMonitoringPage />}
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