import { useState } from "react";
import { Monitor, Activity, Store, BarChart3, FileText, GitBranch, ClipboardList, Smartphone } from "lucide-react";
import AllPosPage from "./AllPosPage";
import AllCpPage from "./AllCpPage";
import PosStatusPage from "./PosStatusPage";
import OutletsPage from "./OutletsPage";
import ChangeDeviceLogsPage from "./ChangeDeviceLogsPage";
import ConvertAreaLogsPage from "./ConvertAreaLogsPage";
import PosStatusLogsPage from "./PosStatusLogsPage";
import { TopTabs } from "../../../shared/components";

const mainTabs = [
    { id: "all-pos", label: "POS", icon: Monitor },
    { id: "all-cp", label: "CP Devices", icon: Smartphone },
    { id: "pos-status", label: "POS Status", icon: Activity },
    { id: "outlets", label: "Outlets", icon: Store },
    { id: "reports", label: "Reports", icon: BarChart3 },
];

const reportSubTabs = [
    { id: "change-device-logs", label: "Change Device Logs", icon: FileText },
    { id: "convert-area-logs", label: "Convert Area Logs", icon: GitBranch },
    { id: "pos-status-logs", label: "POS Status Logs", icon: ClipboardList },
];

export default function PosInventoryTabbedPage() {
    const [activeTab, setActiveTab] = useState("all-pos");
    const [activeReportSubTab, setActiveReportSubTab] = useState("change-device-logs");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

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
        <div className="flex flex-col gap-5">
            <TopTabs
                tabs={mainTabs}
                activeId={activeTab}
                onChange={setActiveTab}
                ariaLabel="POS inventory sections"
            />

            <div className="min-w-0">
                {activeTab === "all-pos" && <AllPosPage />}
                {activeTab === "all-cp" && <AllCpPage />}
                {activeTab === "pos-status" && <PosStatusPage />}
                {activeTab === "outlets" && <OutletsPage />}
                {activeTab === "reports" && (
                    <div className="flex flex-col gap-5">
                        <TopTabs
                            variant="secondary"
                            tabs={reportSubTabs}
                            activeId={activeReportSubTab}
                            onChange={setActiveReportSubTab}
                            rightSlot={dateFilters}
                            ariaLabel="POS report sub-sections"
                        />

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
