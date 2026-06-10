import { useEffect, useState } from "react";
import { Monitor, Building2, RotateCcw } from "lucide-react";
import AssignPosPage from "./AssignPosPage";
import AssignOutletPage from "./AssignOutletPage";
import RequestResetPage from "./RequestResetPage";
import { listBoothChangeRequests } from "../services/boothChangeRequests";
import { listOperatorChangeRequests } from "../services/operatorChangeRequests";
import { listBoothOperatorChangeRequests } from "../services/boothOperatorChangeRequests";
import { TopTabs } from "../../../shared/components";

type TabId = "assign-pos" | "assign-outlet" | "request-reset";

const tabs: { id: TabId; label: string; icon: typeof Monitor }[] = [
    { id: "assign-pos", label: "Assign POS", icon: Monitor },
    { id: "assign-outlet", label: "Assign Outlet", icon: Building2 },
    { id: "request-reset", label: "Request Reset Device", icon: RotateCcw },
];

export default function RequestsTabbedPage() {
    const [activeTab, setActiveTab] = useState<TabId>("assign-pos");
    const [pendingRequestCount, setPendingRequestCount] = useState(0);
    const [pendingAssignPosCount, setPendingAssignPosCount] = useState(0);
    const [pendingAssignOutletCount, setPendingAssignOutletCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const fetchPendingCount = async () => {
            try {
                const pending = await listBoothChangeRequests({ status: "pending" });
                if (!cancelled) setPendingRequestCount(pending.length);
            } catch {
                if (!cancelled) setPendingRequestCount(0);
            }
        };

        fetchPendingCount();
        const interval = window.setInterval(fetchPendingCount, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchPendingCount();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [activeTab]);

    // Poll pending operator change requests for the Assign POS tab badge
    useEffect(() => {
        let cancelled = false;

        const fetchPendingAssignPos = async () => {
            try {
                const pending = await listOperatorChangeRequests({ status: "pending" });
                if (!cancelled) setPendingAssignPosCount(pending.length);
            } catch {
                if (!cancelled) setPendingAssignPosCount(0);
            }
        };

        fetchPendingAssignPos();
        const interval = window.setInterval(fetchPendingAssignPos, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchPendingAssignPos();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [activeTab]);

    // Poll pending booth operator change requests for the Assign Outlet tab badge
    useEffect(() => {
        let cancelled = false;

        const fetchPendingAssignOutlet = async () => {
            try {
                const pending = await listBoothOperatorChangeRequests({ status: "pending" });
                if (!cancelled) setPendingAssignOutletCount(pending.length);
            } catch {
                if (!cancelled) setPendingAssignOutletCount(0);
            }
        };

        fetchPendingAssignOutlet();
        const interval = window.setInterval(fetchPendingAssignOutlet, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchPendingAssignOutlet();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [activeTab]);

    return (
        <div className="flex flex-col gap-5">
            <TopTabs
                tabs={tabs.map((t) => ({
                    ...t,
                    badge: t.id === "assign-pos"
                        ? pendingAssignPosCount
                        : t.id === "assign-outlet"
                            ? pendingAssignOutletCount
                            : t.id === "request-reset"
                                ? pendingRequestCount
                                : undefined,
                    badgeColor: "red",
                }))}
                activeId={activeTab}
                onChange={(id) => setActiveTab(id as TabId)}
                ariaLabel="Requests sections"
            />

            <div className="min-w-0">
                {activeTab === "assign-pos" && <AssignPosPage />}
                {activeTab === "assign-outlet" && <AssignOutletPage />}
                {activeTab === "request-reset" && <RequestResetPage />}
            </div>
        </div>
    );
}
