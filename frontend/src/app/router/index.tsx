import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";

import ProtectedRoute from "../../components/ProtectedRoute";
import RoleGuard from "../../components/RoleGuard";

// ---------------------------------------------------------------------------
// Route-level code splitting.
//
// Every page module is loaded on demand so the initial bundle only ships the
// landing page, auth/guard wrappers, and the dashboard shell. Role-specific
// sections (pos, pos-repair, csr, asset-inventory, etc.) are downloaded
// the first time the user navigates into them. This brings the main chunk
// well under Vite's 500 kB warning limit and keeps unused roles from
// weighing down users who never see them.
// ---------------------------------------------------------------------------

const LandingPage = lazy(() => import("../../pages/LandingPage"));
const DashboardLayout = lazy(() => import("../../app/layouts/DashboardLayout"));
const DashboardHome = lazy(() => import("../../pages/dashboard/DashboardHome"));

const PosInventoryTabbedPage = lazy(
    () => import("../../modules/pos/pages/PosInventoryTabbedPage")
);
const PosRepairTabbedPage = lazy(
    () => import("../../modules/pos-repair/pages/PosRepairTabbedPage")
);

const CancellationTabbedPage = lazy(
    () => import("../../modules/cancellation/pages/CancellationTabbedPage")
);
const AssetInventoryTabbedPage = lazy(
    () => import("../../modules/asset-inventory/pages/AssetInventoryTabbedPage")
);
const AssetSummaryPage = lazy(
    () => import("../../modules/asset-inventory/pages/SummaryPage")
);
const AssetOfficePage = lazy(
    () => import("../../modules/asset-inventory/pages/OfficePage")
);
const AssetPayoutPage = lazy(
    () => import("../../modules/asset-inventory/pages/PayoutPage")
);
const AssetDrawcourtPage = lazy(
    () => import("../../modules/asset-inventory/pages/DrawcourtPage")
);
const AssetObsPage = lazy(
    () => import("../../modules/asset-inventory/pages/ObsPage")
);
const AssetCodingPage = lazy(
    () => import("../../modules/asset-inventory/pages/AssetCodingPage")
);

const SettingsPage = lazy(() => import("../../modules/settings/pages/SettingsPage"));
const RequestsTabbedPage = lazy(
    () => import("../../modules/requests/pages/RequestsTabbedPage")
);
const AssignPosPage = lazy(
    () => import("../../modules/requests/pages/AssignPosPage")
);
const AssignOutletPage = lazy(
    () => import("../../modules/requests/pages/AssignOutletPage")
);
const RequestResetPage = lazy(
    () => import("../../modules/requests/pages/RequestResetPage")
);
const BulletinBoardPage = lazy(
    () => import("../../modules/bulletin/pages/BulletinBoardPage")
);
const OperatorTabbedPage = lazy(
    () => import("../../modules/operator/pages/OperatorTabbedPage")
);
const OperatorOutletsPage = lazy(
    () => import("../../modules/operator/pages/OperatorOutletsPage")
);
const CsrTabbedPage = lazy(() => import("../../modules/csr/pages/CsrTabbedPage"));
const CsrRepairRequestPage = lazy(
    () => import("../../modules/csr/pages/CsrRepairRequestPage")
);
const CsrRepairManagementPage = lazy(
    () => import("../../modules/csr/pages/CsrRepairManagementPage")
);
const CsrRepairLogPage = lazy(
    () => import("../../modules/csr/pages/CsrRepairLogPage")
);
const CsrReleasedLogPage = lazy(
    () => import("../../modules/csr/pages/CsrReleasedLogPage")
);
const CsrDiagnosisListPage = lazy(
    () => import("../../modules/csr/pages/CsrDiagnosisListPage")
);
const PosDiagnosisListPage = lazy(
    () => import("../../modules/pos-repair/pages/DiagnosisListPage")
);
const CsrPostsTabbedPage = lazy(
    () => import("../../modules/csr/pages/CsrPostsTabbedPage")
);

// Full-page loading shell shown while any of the lazy route modules is being
// fetched. Kept dependency-free (no lucide, no router hooks) so it can render
// the instant the bundle is parsed.
function RouteFallback() {
    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #FBF9F1 0%, #E5E1DA 100%)",
            }}
        >
            <div
                style={{
                    width: 40,
                    height: 40,
                    border: "3px solid rgba(146,199,207,0.25)",
                    borderTopColor: "#92C7CF",
                    borderRadius: "50%",
                    animation: "cm-suspense-spin 0.8s linear infinite",
                }}
            />
            <style>{`@keyframes cm-suspense-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// Wrap a lazy element in a Suspense boundary so individual routes get their
// own fallback instead of unmounting the parent layout. react-router-dom
// already handles the outlet rendering — Suspense just gates the children.
function lazyRoute(node: React.ReactNode) {
    return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
    {
        path: "/",
        element: lazyRoute(<LandingPage />),
    },
    {
        path: "/app",
        element: (
            <ProtectedRoute>
                <Suspense fallback={<RouteFallback />}>
                    <DashboardLayout />
                </Suspense>
            </ProtectedRoute>
        ),
        children: [
            {
                path: "dashboard",
                element: (
                    <RoleGuard allow={["admin", "csr", "operator"]} fallback="/app/asset-inventory/summary">
                        <Suspense fallback={<RouteFallback />}>
                            <DashboardHome />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "my-pos",
                element: (
                    <RoleGuard allow={["operator"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <OperatorTabbedPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "request-pos",
                element: (
                    <RoleGuard allow={["operator"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <OperatorTabbedPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "my-outlets",
                element: (
                    <RoleGuard allow={["operator"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <OperatorOutletsPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "pos",
                element: (
                    <RoleGuard allow={["admin"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <PosInventoryTabbedPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },

            {
                path: "pos-repair",
                element: (
                    <RoleGuard allow={["admin", "csr"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <PosRepairTabbedPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "pos-repair/diagnosis-list",
                element: (
                    <RoleGuard allow={["admin", "csr"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <PosDiagnosisListPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },

            {
                path: "csr-pos-repair",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <Suspense fallback={<RouteFallback />}>
                            <CsrTabbedPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            // Direct routes for each CSR sub-section so the sidebar can
            // expose them as top-level nav items. The parent
            // /app/csr-pos-repair still renders the tabbed UX for
            // anyone who deep-links there or already had it bookmarked.
            {
                path: "csr-pos-repair/repair-request",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <Suspense fallback={<RouteFallback />}>
                            <CsrRepairRequestPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "csr-pos-repair/repair-management",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <Suspense fallback={<RouteFallback />}>
                            <CsrRepairManagementPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "csr-pos-repair/repair-log",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <Suspense fallback={<RouteFallback />}>
                            <CsrRepairLogPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "csr-pos-repair/released-log",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <Suspense fallback={<RouteFallback />}>
                            <CsrReleasedLogPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "csr-pos-repair/diagnosis-list",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <Suspense fallback={<RouteFallback />}>
                            <CsrDiagnosisListPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "csr-pos-repair/posts",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <Suspense fallback={<RouteFallback />}>
                            <CsrPostsTabbedPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },

            {
                path: "cancellation",
                element: (
                    <RoleGuard allow={["admin"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <CancellationTabbedPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },

            {
                path: "asset-inventory",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <AssetInventoryTabbedPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            // Direct routes for each asset section. Used by the purchaser
            // sidebar (one nav item per section) and by anyone who deep-links
            // to a specific asset view. Admin's tabbed UX at the parent path
            // above is unchanged.
            {
                path: "asset-inventory/summary",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <AssetSummaryPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "asset-inventory/office",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <AssetOfficePage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "asset-inventory/payout",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <AssetPayoutPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "asset-inventory/drawcourt",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <AssetDrawcourtPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "asset-inventory/obs",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <AssetObsPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "asset-inventory/asset-coding",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <AssetCodingPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },

            {
                path: "requests",
                element: (
                    <RoleGuard allow={["admin"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <RequestsTabbedPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "requests/assign-pos",
                element: (
                    <RoleGuard allow={["admin"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <AssignPosPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "requests/assign-outlet",
                element: (
                    <RoleGuard allow={["admin"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <AssignOutletPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },
            {
                path: "requests/request-reset",
                element: (
                    <RoleGuard allow={["admin"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <RequestResetPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },

            {
                path: "settings",
                element: (
                    <Suspense fallback={<RouteFallback />}>
                        <SettingsPage />
                    </Suspense>
                ),
            },

            {
                path: "bulletin-board",
                element: (
                    <RoleGuard allow={["admin", "csr", "operator", "purchaser"]}>
                        <Suspense fallback={<RouteFallback />}>
                            <BulletinBoardPage />
                        </Suspense>
                    </RoleGuard>
                ),
            },

        ],
    },
]);
