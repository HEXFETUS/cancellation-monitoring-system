import { useState } from "react";
import { Wrench, ClipboardList, FileText, ArrowUpRight, Stethoscope } from "lucide-react";
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

    return (
        <div className="flex flex-col gap-5">
            <TopTabs
                tabs={tabs}
                activeId={activeTab}
                onChange={setActiveTab}
                ariaLabel="CSR sections"
            />

            <div className="min-w-0">
                {activeTab === "repair-request" && <CsrRepairRequestPage />}
                {activeTab === "pos-repair-management" && <CsrRepairManagementPage />}
                {activeTab === "repair-log" && <CsrRepairLogPage />}
                {activeTab === "released-log" && <CsrReleasedLogPage />}
                {activeTab === "diagnosis-list" && <CsrDiagnosisListPage />}
            </div>
        </div>
    );
}
