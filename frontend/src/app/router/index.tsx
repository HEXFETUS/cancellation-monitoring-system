import { createBrowserRouter } from "react-router-dom";
import LandingPage from "../../pages/LandingPage";
import DashboardLayout from "../layouts/DashboardLayout";
import DashboardHome from "../../pages/dashboard/DashboardHome";
import ProductsPage from "../../modules/pos/pages/ProductsPage";
import SettingsPage from "../../modules/settings/pages/SettingsPage";
import UserAccountsPage from "../../modules/settings/user-accounts/pages/UserAccountsPage";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <LandingPage />,
    },git stu
    {
        path: "/app",
        element: <DashboardLayout />,
        children: [
            { path: "dashboard", element: <DashboardHome /> },
            { path: "pos", element: <ProductsPage /> },
            {
                path: "settings",
                element: <SettingsPage />,
                children: [
                    { path: "user-accounts", element: <UserAccountsPage /> },
                ],
            },
        ],
    },
]);
