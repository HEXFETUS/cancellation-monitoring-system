import { useState } from "react";
import {
    Cpu,
    Activity,
    Repeat,
    BarChart3,
} from "lucide-react";
import ProductsPage from "./ProductsPage";
import PosStatusPage from "./PosStatusPage";
import RequestResetPage from "./RequestResetPage";
import ChangeDeviceLogsPage from "./ChangeDeviceLogsPage";
import ConvertAreaLogsPage from "./ConvertAreaLogsPage";
import PosStatusLogsPage from "./PosStatusLogsPage";

const leftTabs = [
    { id: "pos", label: "POS", icon: Cpu },
    { id: "pos-status", label: "POS STATUS", icon: Activity },
    { id: "request-reset", label: "REQUEST RESET DEVICE", icon: Repeat },
    { id: "reports", label: "REPORTS", icon: BarChart3 },
];

const reportTabs = [
    { id: "change-device-logs", label: "Change Device Logs" },
    { id: "convert-area-logs", label: "Convert Area Logs" },
    { id: "pos-status-logs", label: "POS Status Logs" },
];

export default function AllPosPage() {
    const [activeTab, setActiveTab] = useState("pos");
    const [activeReportTab, setActiveReportTab] = useState("change-device-logs");

    return (
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            {/* Left sidebar tabs — horizontal scroll on mobile, vertical sidebar on desktop */}
            <div className="flex gap-2 overflow-x-auto pb-2 lg:w-56 lg:shrink-0 lg:flex-col lg:space-y-2 lg:overflow-visible lg:pb-0">
                {leftTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-left text-sm font-medium transition-all duration-200 lg:w-full lg:gap-3 lg:px-4 lg:py-3 ${
                                isActive
                                    ? "bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                            }`}
                        >
                            <span
                                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl lg:h-9 lg:w-9 ${
                                    isActive
                                        ? "bg-sky-100 text-sky-600"
                                        : "bg-slate-100 text-slate-500"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                            </span>
                            <span className="whitespace-nowrap lg:whitespace-normal">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Main content area */}
            <div className="flex-1 min-w-0">
                {activeTab === "pos" && <ProductsPage />}
                {activeTab === "pos-status" && <PosStatusPage />}
                {activeTab === "request-reset" && <RequestResetPage />}
                {activeTab === "reports" && (
                    <div>
                        {/* Report sub-tabs — horizontal scroll on mobile */}
                        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
                            {reportTabs.map((tab) => {
                                const isActive = activeReportTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveReportTab(tab.id)}
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

                        {/* Report content */}
                        <div>
                            {activeReportTab === "change-device-logs" && <ChangeDeviceLogsPage />}
                            {activeReportTab === "convert-area-logs" && <ConvertAreaLogsPage />}
                            {activeReportTab === "pos-status-logs" && <PosStatusLogsPage />}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
