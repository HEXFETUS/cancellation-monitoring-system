import { useEffect, useState } from "react";
import { Monitor, Building2, RotateCcw, Smartphone } from "lucide-react";
import AssignPosPage from "./AssignPosPage";
import AssignOutletPage from "./AssignOutletPage";
import RequestResetPage from "./RequestResetPage";
import CpRequestResetPage from "./CpRequestResetPage";
import AssignCpPage from "./AssignCpPage";
import { countBoothChangeRequests } from "../services/boothChangeRequests";
import { countOperatorChangeRequests } from "../services/operatorChangeRequests";
import { countBoothOperatorChangeRequests } from "../services/boothOperatorChangeRequests";
import { countCpBoothChangeRequests } from "../services/cpBoothChangeRequests";
import { countCpOperatorChangeRequests } from "../services/cpOperatorChangeRequests";
import { TopTabs } from "../../../shared/components";

type TabId = "assign-pos" | "assign-outlet" | "request-reset" | "cp-request-reset" | "assign-cp";

const tabs: { id: TabId; label: string; icon: typeof Monitor }[] = [
    { id: "assign-pos", label: "Assign POS", icon: Monitor },
    { id: "assign-outlet", label: "Assign Outlet", icon: Building2 },
    { id: "request-reset", label: "Request Reset Device", icon: RotateCcw },
    { id: "cp-request-reset", label: "Request Reset Cp", icon: Smartphone },
    { id: "assign-cp", label: "Assign CP", icon: Smartphone },
];

export default function RequestsTabbedPage() {
    const [activeTab, setActiveTab] = useState<TabId>("assign-pos");
    const [pendingRequestCount, setPendingRequestCount] = useState(0);
    const [pendingAssignPosCount, setPendingAssignPosCount] = useState(0);
    const [pendingAssignOutletCount, setPendingAssignOutletCount] = useState(0);
    const [pendingCpRequestCount, setPendingCpRequestCount] = useState(0);
    const [pendingCpAssignCount, setPendingCpAssignCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const fetchPendingCount = async () => {
            try {
                const count = await countBoothChangeRequests({ status: "pending" });
                if (!cancelled) setPendingRequestCount(count);
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
                const count = await countOperatorChangeRequests({ status: "pending" });
                if (!cancelled) setPendingAssignPosCount(count);
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

    // Poll pending CP booth change requests for the Request Reset Cp tab badge
    useEffect(() => {
        let cancelled = false;

        const fetchPendingCpCount = async () => {
            try {
                const count = await countCpBoothChangeRequests({ status: "pending" });
                if (!cancelled) setPendingCpRequestCount(count);
            } catch {
                if (!cancelled) setPendingCpRequestCount(0);
            }
        };

        fetchPendingCpCount();
        const interval = window.setInterval(fetchPendingCpCount, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchPendingCpCount();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [activeTab]);

    // Poll pending CP operator change requests for the Assign CP tab badge
    useEffect(() => {
        let cancelled = false;

        const fetchPendingCpAssign = async () => {
            try {
                const count = await countCpOperatorChangeRequests({ status: "pending" });
                if (!cancelled) setPendingCpAssignCount(count);
            } catch {
                if (!cancelled) setPendingCpAssignCount(0);
            }
        };

        fetchPendingCpAssign();
        const interval = window.setInterval(fetchPendingCpAssign, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchPendingCpAssign();
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
                const count = await countBoothOperatorChangeRequests({ status: "pending" });
                if (!cancelled) setPendingAssignOutletCount(count);
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
                                : t.id === "cp-request-reset"
                                    ? pendingCpRequestCount
                                    : t.id === "assign-cp"
                                        ? pendingCpAssignCount
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
                {activeTab === "cp-request-reset" && <CpRequestResetPage />}
                {activeTab === "assign-cp" && <AssignCpPage />}
            </div>
        </div>
    );
}
