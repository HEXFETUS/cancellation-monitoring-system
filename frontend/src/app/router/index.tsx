import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import LandingPage from "../../pages/LandingPage";
import DashboardLayout from "../../app/layouts/DashboardLayout";
import DashboardHome from "../../pages/dashboard/DashboardHome";

import AllPosPage from "../../modules/pos/pages/AllPosPage";
import OperatorsPage from "../../modules/pos/pages/OperatorsPage";
import OutletsPage from "../../modules/pos/pages/OutletsPage";
import PosRepairRequestPage from "../../modules/pos/pages/PosRepairRequestPage";

import CancellationRecordsPage from "../../modules/cancellation/pages/CancellationRecordsPage";
import DailyReportPage from "../../modules/cancellation/pages/DailyReportPage";
import MonthlyReportPage from "../../modules/cancellation/pages/MonthlyReportPage";
import YearlyReportPage from "../../modules/cancellation/pages/YearlyReportPage";

import SummaryPage from "../../modules/asset-inventory/pages/SummaryPage";
import OfficePage from "../../modules/asset-inventory/pages/OfficePage";
import PayoutPage from "../../modules/asset-inventory/pages/PayoutPage";
import DrawcourtPage from "../../modules/asset-inventory/pages/DrawcourtPage";
import ObsPage from "../../modules/asset-inventory/pages/ObsPage";
import AssetCodingPage from "../../modules/asset-inventory/pages/AssetCodingPage";

import UserAccountsPage from "../../modules/settings/user-accounts/pages/UserAccountsPage";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <LandingPage />,
    },
    {
        path: "/dashboard",
        element: <Navigate to="/app/dashboard" replace />,
    },
    {
        path: "/app",
        element: <DashboardLayout />,
        children: [
            { index: true, element: <Navigate to="dashboard" replace /> },
            { path: "dashboard", element: <DashboardHome /> },
            {
                path: "pos",
                element: <Outlet />,
                children: [
                    { index: true, element: <Navigate to="all-pos" replace /> },
                    { path: "all-pos", element: <AllPosPage /> },
                    { path: "operators", element: <OperatorsPage /> },
                    { path: "outlets", element: <OutletsPage /> },
                    { path: "repair-request", element: <PosRepairRequestPage /> },
                ],
            },

            {
                path: "cancellation",
                element: <Outlet />,
                children: [
                    { index: true, element: <Navigate to="records" replace /> },
                    { path: "records", element: <CancellationRecordsPage /> },
                    { path: "daily-report", element: <DailyReportPage /> },
                    { path: "monthly-report", element: <MonthlyReportPage /> },
                    { path: "yearly-report", element: <YearlyReportPage /> },
                ],
            },

            {
                path: "asset-inventory",
                element: <Outlet />,
                children: [
                    { index: true, element: <Navigate to="summary" replace /> },
                    { path: "summary", element: <SummaryPage /> },
                    { path: "office", element: <OfficePage /> },
                    { path: "payout", element: <PayoutPage /> },
                    { path: "drawcourt", element: <DrawcourtPage /> },
                    { path: "obs", element: <ObsPage /> },
                    { path: "asset-coding", element: <AssetCodingPage /> },
                ],
            },

            {
                path: "settings",
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
    {
        path: "*",
        element: <Navigate to="/" replace />,
    },
]);
