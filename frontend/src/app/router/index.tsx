import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import LandingPage from "../../pages/LandingPage";
import DashboardLayout from "../../app/layouts/DashboardLayout";
import DashboardHome from "../../pages/dashboard/DashboardHome";

import ProductsPage from "../../modules/pos/pages/ProductsPage";
import PosStatusPage from "../../modules/pos/pages/PosStatusPage";
import OperatorsPage from "../../modules/pos/pages/OperatorsPage";
import OutletsPage from "../../modules/pos/pages/OutletsPage";
import RequestResetPage from "../../modules/pos/pages/RequestResetPage";
import RepairRequestPage from "../../modules/pos/pages/RepairRequestPage";
import RepairLogPage from "../../modules/pos/pages/RepairLogPage";
import ReleasedLogPage from "../../modules/pos/pages/ReleasedLogPage";
import DiagnosisListPage from "../../modules/pos/pages/DiagnosisListPage";
import ConvertAreaLogsPage from "../../modules/pos/pages/ConvertAreaLogsPage";
import ChangeDeviceLogsPage from "../../modules/pos/pages/ChangeDeviceLogsPage";
import ChangeDeviceMonitoringPage from "../../modules/pos/pages/ChangeDeviceMonitoringPage";
import PosStatusLogsPage from "../../modules/pos/pages/PosStatusLogsPage";

import SettingsPage from "../../modules/settings/pages/SettingsPage";
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
                element: <Outlet />,
                children: [
                    { index: true, element: <Navigate to="all-pos" replace /> },
                    { path: "all-pos", element: <ProductsPage /> },
                    { path: "status", element: <PosStatusPage /> },

                    { path: "operators", element: <OperatorsPage /> },
                    { path: "outlets", element: <OutletsPage /> },
                    { path: "request-reset", element: <RequestResetPage /> },

                    { path: "repair-request", element: <RepairRequestPage /> },
                    { path: "repair-log", element: <RepairLogPage /> },
                    { path: "released-log", element: <ReleasedLogPage /> },
                    { path: "diagnosis", element: <DiagnosisListPage /> },

                    {
                        path: "reports",
                        children: [
                            { path: "convert-area-logs", element: <ConvertAreaLogsPage /> },
                            { path: "change-device-logs", element: <ChangeDeviceLogsPage /> },
                            { path: "change-device-monitoring", element: <ChangeDeviceMonitoringPage /> },
                            { path: "pos-status-logs", element: <PosStatusLogsPage /> },
                        ],
                    },
                ],
            },

            {
                path: "settings",
                element: <SettingsPage />,
                children: [
                    // default route → redirects to user accounts
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