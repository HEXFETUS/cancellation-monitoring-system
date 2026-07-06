import { useEffect, useState } from "react";
import { Wrench, ClipboardList, BarChart3, FileSearch, Search } from "lucide-react";
import RepairRequestPage from "./RepairRequestPage";
import RepairManagementPage from "./RepairManagementPage";
import RepairLogPage from "./RepairLogPage";
import ReleasedLogPage from "./ReleasedLogPage";
import DiagnosisListPage from "./DiagnosisListPage";
import { listRepairRecords } from "../services/repairRecords";
import { TopTabs } from "../../../shared/components";
import { useAuth } from "../../../context/AuthContext";

const mainTabs = [
    { id: "repair-request", label: "Repair Request", icon: ClipboardList },
    { id: "repair-management", label: "Repair Management", icon: Wrench },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "diagnosis", label: "Diagnosis List", icon: FileSearch },
];

// Tracks which "For Repair" records the admin has already seen (by viewing the
// Repair Management tab), so the tab count badge only reflects NEW requests.
function repairMgmtSeenKey(userId: number | string) {
    return `repair_mgmt_seen_${userId}`;
}
function getSeenForRepairKeys(userId: number | string): string[] {
    try {
        const raw = localStorage.getItem(repairMgmtSeenKey(userId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}
function addSeenForRepairKeys(userId: number | string, keys: string[]) {
    try {
        const merged = [...new Set([...getSeenForRepairKeys(userId), ...keys])];
        localStorage.setItem(repairMgmtSeenKey(userId), JSON.stringify(merged.slice(-500)));
    } catch {
        /* localStorage unavailable */
    }
}

const subTabs = [
    { id: "repair-logs", label: "Repair Logs" },
    { id: "released-logs", label: "Released Logs" },
];

export default function PosRepairTabbedPage() {
    const { user } = useAuth();
    const userId = user?.id ?? "anon";
    const [activeTab, setActiveTab] = useState("repair-management");
    const [activeSubTab, setActiveSubTab] = useState("repair-logs");
    const [repairLogSearch, setRepairLogSearch] = useState("");
    const [releasedLogSearch, setReleasedLogSearch] = useState("");
    const [forCheckingCount, setForCheckingCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const fetchForCheckingCount = async () => {
            try {
                const records = await listRepairRecords();
                const forRepairKeys = records
                    .filter((record) => record.status === "For Repair")
                    .map((record) => `${record.id}:For Repair`);

                if (cancelled) return;

                if (activeTab === "repair-management") {
                    // The admin is looking at the queue → treat everything as
                    // seen so the badge only reappears for later arrivals.
                    if (forRepairKeys.length) addSeenForRepairKeys(userId, forRepairKeys);
                    setForCheckingCount(0);
                } else {
                    // Otherwise the badge counts only the NEW (unseen) requests.
                    const seen = new Set(getSeenForRepairKeys(userId));
                    setForCheckingCount(forRepairKeys.filter((k) => !seen.has(k)).length);
                }
            } catch {
                if (!cancelled) setForCheckingCount(0);
            }
        };

        fetchForCheckingCount();
        const interval = window.setInterval(fetchForCheckingCount, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchForCheckingCount();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [activeTab, userId]);

    const subSearch = (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
                type="text"
                value={activeSubTab === "repair-logs" ? repairLogSearch : releasedLogSearch}
                onChange={(e) =>
                    activeSubTab === "repair-logs"
                        ? setRepairLogSearch(e.target.value)
                        : setReleasedLogSearch(e.target.value)
                }
                placeholder={activeSubTab === "repair-logs" ? "Search POS / Serial Number…" : "Search Billing Code…"}
                className="pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200/60 dark:border-gray-700 bg-white/40 dark:bg-gray-800/70 backdrop-blur-sm text-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-300/50 dark:focus:ring-teal/50 focus:border-teal-300 dark:focus:border-teal w-64"
            />
        </div>
    );

    return (
        <div className="flex flex-col gap-5">
            <TopTabs
                tabs={mainTabs.map((t) => ({
                    ...t,
                    badge: t.id === "repair-management" ? forCheckingCount : undefined,
                    badgeColor: "red",
                }))}
                activeId={activeTab}
                onChange={setActiveTab}
                ariaLabel="POS repair sections"
            />

            <div className="min-w-0">
                {activeTab === "repair-request" && <RepairRequestPage />}
                {activeTab === "repair-management" && <RepairManagementPage />}
                {activeTab === "diagnosis" && <DiagnosisListPage />}
                {activeTab === "reports" && (
                    <div className="flex flex-col gap-5">
                        <TopTabs
                            variant="secondary"
                            tabs={subTabs}
                            activeId={activeSubTab}
                            onChange={setActiveSubTab}
                            rightSlot={subSearch}
                            ariaLabel="Repair report sub-sections"
                        />

                        <div>
                            {activeSubTab === "repair-logs" && (
                                <RepairLogPage search={repairLogSearch} onSearchChange={setRepairLogSearch} />
                            )}
                            {activeSubTab === "released-logs" && (
                                <ReleasedLogPage search={releasedLogSearch} onSearchChange={setReleasedLogSearch} />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
