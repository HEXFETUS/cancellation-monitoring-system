import { useState } from "react";
import { Wrench, ClipboardList, FileText, ArrowUpRight, Stethoscope, Search } from "lucide-react";
import CsrRepairRequestPage from "./CsrRepairRequestPage";
import CsrRepairManagementPage from "./CsrRepairManagementPage";
import CsrRepairLogPage from "./CsrRepairLogPage";
import CsrReleasedLogPage from "./CsrReleasedLogPage";
import CsrDiagnosisListPage from "./CsrDiagnosisListPage";
import { TopTabs } from "../../../shared/components";

const tabs = [
    { id: "repair-request", label: "Repair Request", icon: ClipboardList },
    { id: "pos-repair-management", label: "Repair Management", icon: Wrench },
    { id: "repair-log", label: "Repair Log", icon: FileText },
    { id: "released-log", label: "Released Log", icon: ArrowUpRight },
    { id: "diagnosis-list", label: "Diagnosis List", icon: Stethoscope },
];

export default function CsrTabbedPage() {
    const [activeTab, setActiveTab] = useState("pos-repair-management");
    const [repairLogSearch, setRepairLogSearch] = useState("");
    const [releasedLogSearch, setReleasedLogSearch] = useState("");

    const isLogTab = activeTab === "repair-log" || activeTab === "released-log";
    const logSearch = activeTab === "repair-log" ? repairLogSearch : releasedLogSearch;
    const setLogSearch = activeTab === "repair-log" ? setRepairLogSearch : setReleasedLogSearch;

    const logSearchInput = isLogTab ? (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder={activeTab === "repair-log" ? "Search POS / Serial Number…" : "Search Billing Code…"}
                className="pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200/60 dark:border-gray-700 bg-white/40 dark:bg-gray-800/70 backdrop-blur-sm text-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-300/50 dark:focus:ring-teal/50 focus:border-teal-300 dark:focus:border-teal w-64"
            />
        </div>
    ) : undefined;

    return (
        <div className="flex flex-col gap-5">
            <TopTabs
                tabs={tabs}
                activeId={activeTab}
                onChange={setActiveTab}
                rightSlot={logSearchInput}
                ariaLabel="CSR sections"
            />

            <div className="min-w-0">
                {activeTab === "repair-request" && <CsrRepairRequestPage />}
                {activeTab === "pos-repair-management" && <CsrRepairManagementPage />}
                {activeTab === "repair-log" && (
                    <CsrRepairLogPage search={repairLogSearch} onSearchChange={setRepairLogSearch} />
                )}
                {activeTab === "released-log" && (
                    <CsrReleasedLogPage search={releasedLogSearch} onSearchChange={setReleasedLogSearch} />
                )}
                {activeTab === "diagnosis-list" && <CsrDiagnosisListPage />}
            </div>
        </div>
    );
}