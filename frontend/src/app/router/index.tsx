import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import LandingPage from "../../pages/LandingPage";
import DashboardLayout from "../../app/layouts/DashboardLayout";
import DashboardHome from "../../pages/dashboard/DashboardHome";

import PosInventoryTabbedPage from "../../modules/pos/pages/PosInventoryTabbedPage";
import PosRepairRequestPage from "../../modules/pos-repair/pages/PosRepairRequestPage";

import CancellationTabbedPage from "../../modules/cancellation/pages/CancellationTabbedPage";
import AssetInventoryTabbedPage from "../../modules/asset-inventory/pages/AssetInventoryTabbedPage";

import UserAccountsPage from "../../modules/settings/user-accounts/pages/UserAccountsPage";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <LandingPage />,
    },
    {
        path: "/app",
        element: <DashboardLayout />,
        children: [
            { path: "dashboard", element: <DashboardHome /> },
            {
                path: "pos",
                element: <PosInventoryTabbedPage />,
            },

            {
                path: "pos-repair",
                element: <PosRepairRequestPage />,
            },

            {
                path: "cancellation",
                element: <CancellationTabbedPage />,
            },

            {
                path: "asset-inventory",
                element: <AssetInventoryTabbedPage />,
            },

            {
                path: "settings",
                children: [
                    { index: true, element: <Navigate to="user-accounts" replace /> },
                    {
                        path: "user-accounts",
                        element: <UserAccountsPage />,
                    },
                ],
            },

        ],
    },
]);