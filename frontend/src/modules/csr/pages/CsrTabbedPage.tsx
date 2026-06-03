import { useState } from "react";

import { Wrench, ClipboardList, FileText, ArrowUpRight, Stethoscope } from "lucide-react";
import CsrRepairRequestPage from "./CsrRepairRequestPage";
import CsrRepairManagementPage from "./CsrRepairManagementPage";
import CsrRepairLogPage from "./CsrRepairLogPage";
import CsrReleasedLogPage from "./CsrReleasedLogPage";
import CsrDiagnosisListPage from "./CsrDiagnosisListPage";

const teal = "#92C7CF";

const leftTabs = [
    { id: "repair-request", label: "REPAIR REQUEST", icon: ClipboardList },
    { id: "pos-repair-management", label: "REPAIR MANAGEMENT", icon: Wrench },
    { id: "repair-log", label: "REPAIR LOG", icon: FileText },
    { id: "released-log", label: "RELEASED LOG", icon: ArrowUpRight },
    { id: "diagnosis-list", label: "DIAGNOSIS LIST", icon: Stethoscope },
];

export default function CsrTabbedPage() {
    const [activeTab, setActiveTab] = useState("pos-repair-management");

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
                                className="flex shrink-0 items-center justify-center rounded-xl transition-all duration-200"
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
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 min-w-0">
                {activeTab === "repair-request" && <CsrRepairRequestPage />}
                {activeTab === "pos-repair-management" && <CsrRepairManagementPage />}
                {activeTab === "repair-log" && <CsrRepairLogPage />}
                {activeTab === "released-log" && <CsrReleasedLogPage />}
                {activeTab === "diagnosis-list" && <CsrDiagnosisListPage />}
            </div>
        </div>
    );
}
