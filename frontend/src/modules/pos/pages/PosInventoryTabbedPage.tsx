import { useEffect, useState } from "react";
import { Monitor, Activity, RotateCcw, Store, BarChart3, Menu, FileText, GitBranch, ClipboardList } from "lucide-react";
import AllPosPage from "./AllPosPage";
import PosStatusPage from "./PosStatusPage";
import RequestResetPage from "./RequestResetPage";
import OutletsPage from "./OutletsPage";
import ChangeDeviceLogsPage from "./ChangeDeviceLogsPage";
import ConvertAreaLogsPage from "./ConvertAreaLogsPage";
import PosStatusLogsPage from "./PosStatusLogsPage";
import { listBoothChangeRequests } from "../services/boothChangeRequests";

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
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [pendingRequestCount, setPendingRequestCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const fetchPendingCount = async () => {
            try {
                const pending = await listBoothChangeRequests({ status: "pending" });
                if (!cancelled) setPendingRequestCount(pending.length);
            } catch {
                if (!cancelled) setPendingRequestCount(0);
            }
        };

        fetchPendingCount();
        const interval = window.setInterval(fetchPendingCount, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchPendingCount();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [activeTab]);

    const dateFilters = (
        <div className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-gray-50/80 px-3 py-2">
            <div className="flex items-center gap-1.5">
                <label htmlFor="reportDateFrom" className="text-xs font-medium text-gray-500 whitespace-nowrap">
                    From
                </label>
                <input
                    id="reportDateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-36 rounded-md border border-gray-200 py-1.5 px-2 text-xs text-gray-700 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal/20 transition-all"
                />
            </div>
            <span className="text-gray-300 text-xs">→</span>
            <div className="flex items-center gap-1.5">
                <label htmlFor="reportDateTo" className="text-xs font-medium text-gray-500 whitespace-nowrap">
                    To
                </label>
                <input
                    id="reportDateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-36 rounded-md border border-gray-200 py-1.5 px-2 text-xs text-gray-700 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal/20 transition-all"
                />
            </div>
            {(dateFrom || dateTo) && (
                <button
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear
                </button>
            )}
        </div>
    );

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
                                {tab.id === "request-reset" && pendingRequestCount > 0 && (
                                    <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm shadow-red-500/30">
                                        {pendingRequestCount > 99 ? "99+" : pendingRequestCount}
                                    </span>
                                )}
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
                        <div className="mb-5 flex flex-col gap-3 border-b pb-0 xl:flex-row xl:items-end xl:justify-between"
                            style={{ borderColor: "rgba(146,199,207,0.25)" }}
                        >
                            <div className="flex gap-1 overflow-x-auto">
                                {reportSubTabs.map((tab) => {
                                    const Icon = tab.icon;
                                    const isSubActive = activeReportSubTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveReportSubTab(tab.id)}
                                            className="flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-t-xl cursor-pointer"
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
                            <div className="flex justify-end pb-2 xl:pb-1">
                                {dateFilters}
                            </div>
                        </div>

                        <div>
                            {activeReportSubTab === "change-device-logs" && <ChangeDeviceLogsPage dateFrom={dateFrom} dateTo={dateTo} />}
                            {activeReportSubTab === "convert-area-logs" && <ConvertAreaLogsPage dateFrom={dateFrom} dateTo={dateTo} />}
                            {activeReportSubTab === "pos-status-logs" && <PosStatusLogsPage dateFrom={dateFrom} dateTo={dateTo} />}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
