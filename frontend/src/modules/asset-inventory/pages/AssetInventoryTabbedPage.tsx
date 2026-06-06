import { useState } from "react";
import { LayoutDashboard, Building2, MapPin, Monitor, Eye, Code } from "lucide-react";
import SummaryPage from "./SummaryPage";
import OfficePage from "./OfficePage";
import PayoutPage from "./PayoutPage";
import DrawcourtPage from "./DrawcourtPage";
import ObsPage from "./ObsPage";
import AssetCodingPage from "./AssetCodingPage";
import { TopTabs } from "../../../shared/components";

const tabs = [
    { id: "summary", label: "Summary", icon: LayoutDashboard },
    { id: "office", label: "Office", icon: Building2 },
    { id: "payout", label: "Payout", icon: MapPin },
    { id: "drawcourt", label: "Drawcourt", icon: Monitor },
    { id: "obs", label: "OBS", icon: Eye },
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
                {activeTab === "office" && <OfficePage />}
                {activeTab === "payout" && <PayoutPage />}
                {activeTab === "drawcourt" && <DrawcourtPage />}
                {activeTab === "obs" && <ObsPage />}
                {activeTab === "asset-coding" && <AssetCodingPage />}
            </div>
        </div>
    );
}
