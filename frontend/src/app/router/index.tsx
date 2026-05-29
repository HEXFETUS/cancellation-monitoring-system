import { createBrowserRouter } from "react-router-dom";

import ProtectedRoute from "../../components/ProtectedRoute";
import RoleGuard from "../../components/RoleGuard";
import LandingPage from "../../pages/LandingPage";
import DashboardLayout from "../../app/layouts/DashboardLayout";
import DashboardHome from "../../pages/dashboard/DashboardHome";

import PosInventoryTabbedPage from "../../modules/pos/pages/PosInventoryTabbedPage";
import PosRepairRequestPage from "../../modules/pos-repair/pages/PosRepairRequestPage";

import CancellationTabbedPage from "../../modules/cancellation/pages/CancellationTabbedPage";
import AssetInventoryTabbedPage from "../../modules/asset-inventory/pages/AssetInventoryTabbedPage";

import SettingsPage from "../../modules/settings/pages/SettingsPage";
import MyPosPage from "../../modules/operator/pages/MyPosPage";
import CsrPosRepairPage from "../../modules/csr/pages/CsrPosRepairPage";

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
                    <RoleGuard allow={["admin", "csr", "operator"]} fallback="/app/asset-inventory">
                        <DashboardHome />
                    </RoleGuard>
                ),
            },
            {
                path: "my-pos",
                element: (
                    <RoleGuard allow={["operator"]}>
                        <MyPosPage />
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
                        <PosRepairRequestPage />
                    </RoleGuard>
                ),
            },

            {
                path: "csr-pos-repair",
                element: (
                    <RoleGuard allow={["csr"]} fallback="/app/dashboard">
                        <CsrPosRepairPage />
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

            {
                path: "settings",
                element: <SettingsPage />,
            },

        ],
    },
]);
