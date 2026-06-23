import { useState, useRef, useCallback } from "react";
import {
    LayoutDashboard,
    Building2,
    MapPin,
    Monitor,
    Eye,
    Code,
    Home,
    Car,
    FileText,
    Plus,
    Search,
    Settings2,
    RefreshCw,
    ScanLine,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import AssetsDashboardPage from "./AssetsDashboardPage";
import OfficePage from "./OfficePage";
import PayoutPage from "./PayoutPage";
import DrawcourtPage from "./DrawcourtPage";
import ObsPage from "./ObsPage";
import StaffhousePage from "./StaffhousePage";
import VehiclePage from "./VehiclePage";
import SummaryReportPage from "./SummaryReportPage";
import AssetCodingPage from "./AssetCodingPage";
import { TopTabs } from "../../../shared/components";
import { syncAssetInventoryFromGoogleSheets } from "../services";

const tabs = [
    { id: "summary", label: "Dashboard", icon: LayoutDashboard },
    { id: "summary-report", label: "Summary", icon: FileText },
    { id: "office", label: "Office", icon: Building2 },
    { id: "payout", label: "Payout", icon: MapPin },
    { id: "drawcourt", label: "Drawcourt", icon: Monitor },
    { id: "staffhouse", label: "Staffhouse", icon: Home },
    { id: "vehicle", label: "Vehicle", icon: Car },
    { id: "obs", label: "OBS", icon: Eye },
    { id: "asset-coding", label: "Asset Coding", icon: Code },
];

/** Tabs that use AssetLocationPage (with search/add/manage). */
const LOCATION_TABS = new Set(["office", "payout", "drawcourt", "staffhouse", "vehicle"]);

export default function AssetInventoryTabbedPage() {
    const { user } = useAuth();
    const canSync = user?.usertype === "purchaser" || user?.usertype === "admin";
    const [activeTab, setActiveTab] = useState("summary");
    const [search, setSearch] = useState("");
    const [locationSearch, setLocationSearch] = useState("");
    const [assetCodeSearch, setAssetCodeSearch] = useState("");
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState("");
    const [, setSyncError] = useState("");

    const assetCodingRef = useRef<{ openScanner: () => void; handleAdd: () => void }>(null);
    const obsPageRef = useRef<{ refresh: () => void; handleAdd: () => void }>(null);

    // Location page refs for triggering add
    const officeAddRef = useRef<() => void>(() => { });
    const payoutAddRef = useRef<() => void>(() => { });
    const drawcourtAddRef = useRef<() => void>(() => { });
    const staffhouseAddRef = useRef<() => void>(() => { });
    const vehicleAddRef = useRef<() => void>(() => { });

    const isLocationTab = LOCATION_TABS.has(activeTab);
    const isObsTab = activeTab === "obs";

    const showSearch = isLocationTab || isObsTab || activeTab === "asset-coding";
    const showAdd = isLocationTab || isObsTab || activeTab === "asset-coding";

    // Location-specific extra actions (Departments/Stations)
    const showManageDepts = activeTab === "office";
    const showManageStations = activeTab === "payout";

    const handleSyncGoogleSheets = useCallback(async () => {
        try {
            setSyncing(true);
            setSyncError("");
            setSyncMessage("");
            const summary = await syncAssetInventoryFromGoogleSheets();
            const tabTotals = Object.values(summary.from_google_sheets.tabs).reduce(
                (acc, tab) => ({
                    scanned: acc.scanned + tab.scanned,
                    inserted: acc.inserted + tab.inserted,
                    unchanged: acc.unchanged + (tab.unchanged ?? 0),
                    skipped: acc.skipped + tab.skipped,
                }),
                { scanned: 0, inserted: 0, unchanged: 0, skipped: 0 }
            );
            setSyncMessage(
                `Synced ${tabTotals.scanned} sheet rows: ${tabTotals.inserted} new, ${tabTotals.unchanged} unchanged, ${tabTotals.skipped} skipped.`
            );
        } catch (err) {
            setSyncError(err instanceof Error ? err.message : "Could not sync Google Sheets");
        } finally {
            setSyncing(false);
        }
    }, []);

    const handleAdd = useCallback(() => {
        if (activeTab === "asset-coding") {
            assetCodingRef.current?.handleAdd();
        } else if (activeTab === "obs") {
            obsPageRef.current?.handleAdd();
        } else if (activeTab === "office") {
            officeAddRef.current?.();
        } else if (activeTab === "payout") {
            payoutAddRef.current?.();
        } else if (activeTab === "drawcourt") {
            drawcourtAddRef.current?.();
        } else if (activeTab === "staffhouse") {
            staffhouseAddRef.current?.();
        } else if (activeTab === "vehicle") {
            vehicleAddRef.current?.();
        }
    }, [activeTab]);

    const handleOpenScanner = useCallback(() => {
        assetCodingRef.current?.openScanner();
    }, []);

    // State for managing modals from the top level
    const [manageDeptsOpen, setManageDeptsOpen] = useState(false);
    const [manageStationsOpen, setManageStationsOpen] = useState(false);

    const showRightSlot =
        (activeTab === "summary" && canSync) ||
        isLocationTab ||
        isObsTab ||
        activeTab === "asset-coding" ||
        showManageDepts ||
        showManageStations;

    const rightSlot = showRightSlot ? (
        <div className="flex items-center gap-2 flex-wrap justify-end">
            {activeTab === "summary" && canSync && (
                <button
                    type="button"
                    onClick={handleSyncGoogleSheets}
                    disabled={syncing}
                    className="group/btn inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-2xl bg-gradient-to-br from-teal via-teal-light to-teal px-5 text-sm font-semibold text-white shadow-lg shadow-teal/25 ring-1 ring-white/20 transition-all duration-200 hover:from-teal-dark hover:via-teal hover:to-teal-dark hover:shadow-teal/40 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100"
                >
                    <RefreshCw className={`h-4 w-4 transition-transform duration-500 ${syncing ? "animate-spin" : "group-hover/btn:rotate-180"}`} />
                    {syncing ? "Syncing..." : "Sync GSheet"}
                </button>
            )}

            {(isLocationTab || isObsTab) && (
                <>
                    {showSearch && (
                        <div className="relative w-56">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" size={16} />
                            <input
                                type="text"
                                value={isObsTab ? search : locationSearch}
                                onChange={(e) => {
                                    if (isObsTab) setSearch(e.target.value);
                                    else setLocationSearch(e.target.value);
                                }}
                                placeholder={`Search ${isObsTab ? "OBS codes" : "assets"}...`}
                                className="w-full rounded-lg border border-warm bg-card pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            />
                        </div>
                    )}
                    {showAdd && (
                        <button
                            type="button"
                            onClick={handleAdd}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark"
                        >
                            <Plus size={16} />
                            Add Asset
                        </button>
                    )}
                </>
            )}

            {activeTab === "asset-coding" && (
                <>
                    {showSearch && (
                        <div className="relative w-56">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" size={16} />
                            <input
                                type="text"
                                value={assetCodeSearch}
                                onChange={(e) => setAssetCodeSearch(e.target.value)}
                                placeholder="Search asset codes..."
                                className="w-full rounded-lg border border-warm bg-card pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            />
                        </div>
                    )}
                    {(user?.usertype === "purchaser" || user?.usertype === "admin") && (
                        <button
                            type="button"
                            onClick={handleOpenScanner}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal/10"
                            title="Scan an asset's QR code with the camera"
                        >
                            <ScanLine size={16} />
                            Scan QR
                        </button>
                    )}
                    {showAdd && (
                        <button
                            type="button"
                            onClick={handleAdd}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark"
                        >
                            <Plus size={16} />
                            Add Asset Code
                        </button>
                    )}
                </>
            )}

            {showManageDepts && (
                <button
                    type="button"
                    onClick={() => setManageDeptsOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-warm bg-card px-3 py-2 text-sm font-medium text-ink transition hover:bg-warm/40"
                >
                    <Settings2 size={16} />
                    Manage Departments
                </button>
            )}
            {showManageStations && (
                <button
                    type="button"
                    onClick={() => setManageStationsOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-warm bg-card px-3 py-2 text-sm font-medium text-ink transition hover:bg-warm/40"
                >
                    <Settings2 size={16} />
                    Manage Stations
                </button>
            )}
        </div>
    ) : undefined;

    const handleTabChange = useCallback((id: string) => {
        setActiveTab(id);
        setSearch("");
        setLocationSearch("");
        setAssetCodeSearch("");
        setSyncMessage("");
        setSyncError("");
    }, []);

    return (
        <div className="flex flex-col gap-5">
            <TopTabs
                tabs={tabs}
                activeId={activeTab}
                onChange={handleTabChange}
                ariaLabel="Asset inventory sections"
                rightSlot={rightSlot}
            />

            <div className="min-w-0">
                {activeTab === "summary" && <AssetsDashboardPage syncMessage={syncMessage} />}
                {activeTab === "summary-report" && <SummaryReportPage />}
                {activeTab === "office" && (
                    <OfficePage
                        externalSearch={locationSearch}
                        onAddRef={officeAddRef}
                        manageDeptsOpen={manageDeptsOpen}
                        onManageDeptsClose={() => setManageDeptsOpen(false)}
                    />
                )}
                {activeTab === "payout" && (
                    <PayoutPage
                        externalSearch={locationSearch}
                        onAddRef={payoutAddRef}
                        manageStationsOpen={manageStationsOpen}
                        onManageStationsClose={() => setManageStationsOpen(false)}
                    />
                )}
                {activeTab === "drawcourt" && (
                    <DrawcourtPage
                        externalSearch={locationSearch}
                        onAddRef={drawcourtAddRef}
                    />
                )}
                {activeTab === "obs" && (
                    <ObsPage ref={obsPageRef} externalSearch={search} />
                )}
                {activeTab === "staffhouse" && (
                    <StaffhousePage
                        externalSearch={locationSearch}
                        onAddRef={staffhouseAddRef}
                    />
                )}
                {activeTab === "vehicle" && (
                    <VehiclePage
                        externalSearch={locationSearch}
                        onAddRef={vehicleAddRef}
                    />
                )}
                {activeTab === "asset-coding" && (
                    <AssetCodingPage
                        ref={assetCodingRef}
                        search={assetCodeSearch}
                        onSearchChange={setAssetCodeSearch}
                    />
                )}
            </div>
        </div>
    );
}