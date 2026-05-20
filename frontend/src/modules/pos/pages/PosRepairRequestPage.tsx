import { useState } from "react";
import { Wrench, ClipboardList, CheckCircle, FileSearch } from "lucide-react";
import RepairRequestPage from "./RepairRequestPage";
import RepairLogPage from "./RepairLogPage";
import ReleasedLogPage from "./ReleasedLogPage";
import DiagnosisListPage from "./DiagnosisListPage";

const leftTabs = [
    { id: "repair-request", label: "REPAIR REQUEST", icon: Wrench },
    { id: "repair-logs", label: "REPAIR LOGS", icon: ClipboardList },
    { id: "released-logs", label: "RELEASED LOGS", icon: CheckCircle },
    { id: "diagnosis", label: "LIST OF DIAGNOSIS", icon: FileSearch },
];

export default function PosRepairRequestPage() {
    const [activeTab, setActiveTab] = useState("repair-request");

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
                {activeTab === "repair-request" && <RepairRequestPage />}
                {activeTab === "repair-logs" && <RepairLogPage />}
                {activeTab === "released-logs" && <ReleasedLogPage />}
                {activeTab === "diagnosis" && <DiagnosisListPage />}
            </div>
        </div>
    );
}
