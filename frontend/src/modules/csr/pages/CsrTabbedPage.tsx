import { useRef, useState } from "react";
import { Wrench, ClipboardList, FileText, ArrowUpRight, Stethoscope, Search, Plus } from "lucide-react";
import CsrRepairRequestPage from "./CsrRepairRequestPage";
import CsrRepairManagementPage from "./CsrRepairManagementPage";
import CsrRepairLogPage from "./CsrRepairLogPage";
import CsrReleasedLogPage from "./CsrReleasedLogPage";
import CsrDiagnosisListPage, { type CsrDiagnosisListPageHandle } from "./CsrDiagnosisListPage";
import { TopTabs } from "../../../shared/components";

const teal = "#92C7CF";

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
    const diagnosisRef = useRef<CsrDiagnosisListPageHandle>(null);

    const isLogTab = activeTab === "repair-log" || activeTab === "released-log";
    const logSearch = activeTab === "repair-log" ? repairLogSearch : releasedLogSearch;
    const setLogSearch = activeTab === "repair-log" ? setRepairLogSearch : setReleasedLogSearch;

    const rightSlot = isLogTab ? (
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
    ) : activeTab === "diagnosis-list" ? (
        <button
            type="button"
            onClick={() => diagnosisRef.current?.openCreate()}
            className="group inline-flex shrink-0 h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-xl hover:scale-[1.03] active:scale-[0.97]"
            style={{
                background: `linear-gradient(135deg, ${teal}, #AAD7D9)`,
                boxShadow: "0 4px 16px rgba(146,199,207,0.30)",
            }}
        >
            <Plus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
            New Diagnosis
        </button>
    ) : undefined;

    return (
        <div className="flex flex-col gap-5">
            <TopTabs
                tabs={tabs}
                activeId={activeTab}
                onChange={setActiveTab}
                rightSlot={rightSlot}
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
                {activeTab === "diagnosis-list" && <CsrDiagnosisListPage ref={diagnosisRef} />}
            </div>
        </div>
    );
}