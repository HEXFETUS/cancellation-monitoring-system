import { createBrowserRouter } from "react-router-dom";

import ProtectedRoute from "../../components/ProtectedRoute";
import RoleGuard from "../../components/RoleGuard";
import LandingPage from "../../pages/LandingPage";
import DashboardLayout from "../../app/layouts/DashboardLayout";
import DashboardHome from "../../pages/dashboard/DashboardHome";

import PosInventoryTabbedPage from "../../modules/pos/pages/PosInventoryTabbedPage";
import PosRepairTabbedPage from "../../modules/pos-repair/pages/PosRepairTabbedPage";

import CancellationTabbedPage from "../../modules/cancellation/pages/CancellationTabbedPage";
import AssetInventoryTabbedPage from "../../modules/asset-inventory/pages/AssetInventoryTabbedPage";
import AssetSummaryPage from "../../modules/asset-inventory/pages/SummaryPage";
import AssetOfficePage from "../../modules/asset-inventory/pages/OfficePage";
import AssetPayoutPage from "../../modules/asset-inventory/pages/PayoutPage";
import AssetDrawcourtPage from "../../modules/asset-inventory/pages/DrawcourtPage";
import AssetObsPage from "../../modules/asset-inventory/pages/ObsPage";
import AssetCodingPage from "../../modules/asset-inventory/pages/AssetCodingPage";

import SettingsPage from "../../modules/settings/pages/SettingsPage";
import BulletinBoardPage from "../../modules/bulletin/pages/BulletinBoardPage";
import OperatorTabbedPage from "../../modules/operator/pages/OperatorTabbedPage";
import OperatorOutletsPage from "../../modules/operator/pages/OperatorOutletsPage";
import CsrTabbedPage from "../../modules/csr/pages/CsrTabbedPage";
import CsrRepairRequestPage from "../../modules/csr/pages/CsrRepairRequestPage";
import CsrRepairManagementPage from "../../modules/csr/pages/CsrRepairManagementPage";
import CsrRepairLogPage from "../../modules/csr/pages/CsrRepairLogPage";
import CsrReleasedLogPage from "../../modules/csr/pages/CsrReleasedLogPage";
import CsrDiagnosisListPage from "../../modules/csr/pages/CsrDiagnosisListPage";
import PosDiagnosisListPage from "../../modules/pos-repair/pages/DiagnosisListPage";
import CsrPostsTabbedPage from "../../modules/csr/pages/CsrPostsTabbedPage";


export const router = createBrowserRouter([
    {
        path: "/",
        element: <LandingPage />,
    },
    {
        path: "/app",
        element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
        children: [
            {
                path: "dashboard",
                element: (
                    <RoleGuard allow={["admin", "csr", "operator"]} fallback="/app/asset-inventory/summary">
                        <DashboardHome />
                    </RoleGuard>
                ),
            },
            {
                path: "my-pos",
                element: (
                    <RoleGuard allow={["operator"]}>
                        <OperatorTabbedPage />
                    </RoleGuard>
                ),
            },
            {
                path: "request-pos",
                element: (
                    <RoleGuard allow={["operator"]}>
                        <OperatorTabbedPage />
                    </RoleGuard>
                ),
            },
            {
                path: "my-outlets",
                element: (
                    <RoleGuard allow={["operator"]}>
                        <OperatorOutletsPage />
                    </RoleGuard>
                ),
            },
            {
                path: "pos",
                element: (
                    <RoleGuard allow={["admin"]}>
                        <PosInventoryTabbedPage />
                    </RoleGuard>
                ),
            },

            {
                path: "pos-repair",
                element: (
                    <RoleGuard allow={["admin", "csr"]}>
                        <PosRepairTabbedPage />
                    </RoleGuard>
                ),
            },
            {
                path: "pos-repair/diagnosis-list",
                element: (
                    <RoleGuard allow={["admin", "csr"]}>
                        <PosDiagnosisListPage />
                    </RoleGuard>
                ),
            },

            {
                path: "csr-pos-repair",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <CsrTabbedPage />
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
                        <CsrRepairRequestPage />
                    </RoleGuard>
                ),
            },
            {
                path: "csr-pos-repair/repair-management",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <CsrRepairManagementPage />
                    </RoleGuard>
                ),
            },
            {
                path: "csr-pos-repair/repair-log",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <CsrRepairLogPage />
                    </RoleGuard>
                ),
            },
            {
                path: "csr-pos-repair/released-log",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <CsrReleasedLogPage />
                    </RoleGuard>
                ),
            },
            {
                path: "csr-pos-repair/diagnosis-list",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <CsrDiagnosisListPage />
                    </RoleGuard>
                ),
            },
            {
                path: "csr-pos-repair/posts",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <CsrPostsTabbedPage />
                    </RoleGuard>
                ),
            },

            {
                path: "cancellation",
                element: (
                    <RoleGuard allow={["admin"]}>
                        <CancellationTabbedPage />
                    </RoleGuard>
                ),
            },

            {
                path: "asset-inventory",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <AssetInventoryTabbedPage />
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
                        <AssetSummaryPage />
                    </RoleGuard>
                ),
            },
            {
                path: "asset-inventory/office",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <AssetOfficePage />
                    </RoleGuard>
                ),
            },
            {
                path: "asset-inventory/payout",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <AssetPayoutPage />
                    </RoleGuard>
                ),
            },
            {
                path: "asset-inventory/drawcourt",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <AssetDrawcourtPage />
                    </RoleGuard>
                ),
            },
            {
                path: "asset-inventory/obs",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <AssetObsPage />
                    </RoleGuard>
                ),
            },
            {
                path: "asset-inventory/asset-coding",
                element: (
                    <RoleGuard allow={["admin", "purchaser"]}>
                        <AssetCodingPage />
                    </RoleGuard>
                ),
            },

            {
                path: "settings",
                element: <SettingsPage />,
            },

            {
                path: "bulletin-board",
                element: (
                    <RoleGuard allow={["admin", "csr", "operator", "purchaser"]}>
                        <BulletinBoardPage />
                    </RoleGuard>
                ),
            },

        ],
    },
]);
