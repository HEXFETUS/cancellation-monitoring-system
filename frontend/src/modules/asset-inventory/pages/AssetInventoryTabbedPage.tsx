import { useState } from "react";
import { LayoutDashboard, Building2, MapPin, Monitor, Eye, Code, Home, Car, FileText } from "lucide-react";
import SummaryPage from "./SummaryPage";
import OfficePage from "./OfficePage";
import PayoutPage from "./PayoutPage";
import DrawcourtPage from "./DrawcourtPage";
import ObsPage from "./ObsPage";
import StaffhousePage from "./StaffhousePage";
import VehiclePage from "./VehiclePage";
import SummaryReportPage from "./SummaryReportPage";
import AssetCodingPage from "./AssetCodingPage";
import { TopTabs } from "../../../shared/components";

const tabs = [
    { id: "summary", label: "Dashboard", icon: LayoutDashboard },
    { id: "summary-report", label: "Summary", icon: FileText },
    { id: "office", label: "Office", icon: Building2 },
    { id: "payout", label: "Payout", icon: MapPin },
    { id: "drawcourt", label: "Drawcourt", icon: Monitor },
    { id: "obs", label: "OBS", icon: Eye },
    { id: "staffhouse", label: "Staffhouse", icon: Home },
    { id: "vehicle", label: "Vehicle", icon: Car },
    { id: "asset-coding", label: "Asset Coding", icon: Code },
];

export default function AssetInventoryTabbedPage() {
    const [activeTab, setActiveTab] = useState("summary");

    return (
        <div className="flex flex-col gap-5">
            <TopTabs
                tabs={tabs}
                activeId={activeTab}
                onChange={setActiveTab}
                ariaLabel="Asset inventory sections"
            />

            <div className="min-w-0">
                {activeTab === "summary" && <SummaryPage />}
                {activeTab === "summary-report" && <SummaryReportPage />}
                {activeTab === "office" && <OfficePage />}
                {activeTab === "payout" && <PayoutPage />}
                {activeTab === "drawcourt" && <DrawcourtPage />}
                {activeTab === "obs" && <ObsPage />}
                {activeTab === "staffhouse" && <StaffhousePage />}
                {activeTab === "vehicle" && <VehiclePage />}
                {activeTab === "asset-coding" && <AssetCodingPage />}
            </div>
        </div>
    );
}
