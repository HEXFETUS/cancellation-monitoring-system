import { useEffect, useState } from "react";
import { Wrench, ClipboardList, BarChart3, FileSearch, Search } from "lucide-react";
import RepairRequestPage from "./RepairRequestPage";
import RepairManagementPage from "./RepairManagementPage";
import RepairLogPage from "./RepairLogPage";
import ReleasedLogPage from "./ReleasedLogPage";
import DiagnosisListPage from "./DiagnosisListPage";
import { listRepairRecords } from "../services/repairRecords";

const teal = "#92C7CF";

const leftTabs = [
    { id: "repair-request", label: "REPAIR REQUEST", icon: ClipboardList },
    { id: "repair-management", label: "REPAIR MANAGEMENT", icon: Wrench },
    { id: "reports", label: "REPORTS", icon: BarChart3 },
    { id: "diagnosis", label: "DIAGNOSIS LIST", icon: FileSearch },
];

const subTabs = [
    { id: "repair-logs", label: "Repair Logs" },
    { id: "released-logs", label: "Released Logs" },
];

export default function PosRepairTabbedPage() {
    const [activeTab, setActiveTab] = useState("repair-management");
    const [activeSubTab, setActiveSubTab] = useState("repair-logs");
    const [repairLogSearch, setRepairLogSearch] = useState("");
    const [releasedLogSearch, setReleasedLogSearch] = useState("");
    const [forCheckingCount, setForCheckingCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const fetchForCheckingCount = async () => {
            try {
                const records = await listRepairRecords();
                const count = records.filter((record) => record.status === "For Repair").length;
                if (!cancelled) setForCheckingCount(count);
            } catch {
                if (!cancelled) setForCheckingCount(0);
            }
        };

        fetchForCheckingCount();
        const interval = window.setInterval(fetchForCheckingCount, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchForCheckingCount();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [activeTab]);

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
                                className="relative flex shrink-0 items-center justify-center rounded-xl transition-all duration-200"
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
                                {tab.id === "repair-management" && forCheckingCount > 0 && (
                                    <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm shadow-red-500/30">
                                        {forCheckingCount > 99 ? "99+" : forCheckingCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 min-w-0">
                {activeTab === "repair-request" && <RepairRequestPage />}
                {activeTab === "repair-management" && <RepairManagementPage />}
                {activeTab === "diagnosis" && <DiagnosisListPage />}
                {activeTab === "reports" && (
                    <div>
                        <div className="mb-6 flex items-center gap-2 border-b pb-2"
                            style={{ borderColor: "rgba(146,199,207,0.20)" }}
                        >
                            <div className="flex gap-2 overflow-x-auto">
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

                            <div className="ml-auto relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                                <input
                                    type="text"
                                    value={activeSubTab === "repair-logs" ? repairLogSearch : releasedLogSearch}
                                    onChange={(e) =>
                                        activeSubTab === "repair-logs"
                                            ? setRepairLogSearch(e.target.value)
                                            : setReleasedLogSearch(e.target.value)
                                    }
                                    placeholder={activeSubTab === "repair-logs" ? "Search POS / Serial Number…" : "Search Billing Code…"}
                                    className="pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200/60 dark:border-gray-700 bg-white/40 dark:bg-gray-800/70 backdrop-blur-sm text-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-300/50 dark:focus:ring-teal/50 focus:border-teal-300 dark:focus:border-teal w-64"
                                />
                            </div>
                        </div>

                        <div>
                            {activeSubTab === "repair-logs" && (
                                <RepairLogPage search={repairLogSearch} onSearchChange={setRepairLogSearch} />
                            )}
                            {activeSubTab === "released-logs" && (
                                <ReleasedLogPage search={releasedLogSearch} onSearchChange={setReleasedLogSearch} />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
