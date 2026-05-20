import { useState } from "react";
import { FileText, Calendar, BarChart3, PieChart, Menu } from "lucide-react";
import CancellationRecordsPage from "./CancellationRecordsPage";
import DailyReportPage from "./DailyReportPage";
import MonthlyReportPage from "./MonthlyReportPage";
import YearlyReportPage from "./YearlyReportPage";

const leftTabs = [
    { id: "records", label: "CANCELLATION RECORDS", icon: FileText },
    { id: "daily", label: "DAILY REPORT", icon: Calendar },
    { id: "monthly", label: "MONTHLY REPORT", icon: BarChart3 },
    { id: "yearly", label: "YEARLY REPORT", icon: PieChart },
];

export default function CancellationTabbedPage() {
    const [activeTab, setActiveTab] = useState("records");
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
                {activeTab === "records" && <CancellationRecordsPage />}
                {activeTab === "daily" && <DailyReportPage />}
                {activeTab === "monthly" && <MonthlyReportPage />}
                {activeTab === "yearly" && <YearlyReportPage />}
            </div>
        </div>
    );
}