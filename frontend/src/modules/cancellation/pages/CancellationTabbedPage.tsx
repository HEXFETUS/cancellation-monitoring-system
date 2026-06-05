import { useState } from "react";
import { FileText, Calendar, BarChart3, PieChart } from "lucide-react";
import CancellationRecordsPage from "./CancellationRecordsPage";
import MonthlyReportPage from "./MonthlyReportPage";
import YearlyReportPage from "./YearlyReportPage";
import ReasonForDenyPage from "./ReasonForDenyPage";
import { TopTabs } from "../../../shared/components";

const tabs = [
    { id: "records", label: "Summary", icon: FileText },
    { id: "monthly", label: "Monthly Report", icon: BarChart3 },
    { id: "yearly", label: "Yearly Report", icon: PieChart },
    { id: "reasons", label: "Reason for Deny", icon: Calendar },
];

export default function CancellationTabbedPage() {
    const [activeTab, setActiveTab] = useState("records");

    return (
        <div className="flex flex-col gap-5">
            <TopTabs
                tabs={tabs}
                activeId={activeTab}
                onChange={setActiveTab}
                ariaLabel="Cancellation sections"
            />

            <div className="min-w-0">
                {activeTab === "records" && <CancellationRecordsPage />}
                {activeTab === "monthly" && <MonthlyReportPage />}
                {activeTab === "yearly" && <YearlyReportPage />}
                {activeTab === "reasons" && <ReasonForDenyPage />}
            </div>
        </div>
    );
}
