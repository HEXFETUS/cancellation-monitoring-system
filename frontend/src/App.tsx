import { BrowserRouter, Routes, Route } from "react-router-dom";

import DashboardLayout from "./layouts/DashboardLayout";

import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import RecordsPage from "./pages/RecordsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import AutomationPage from "./pages/AutomationPage";
import InventoryPage from "./pages/InventoryPage";
import CancellationPage from "./pages/CancellationPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<LandingPage />} />

        <Route
          path="/dashboard"
          element={
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/records"
          element={
            <DashboardLayout>
              <RecordsPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/reports"
          element={
            <DashboardLayout>
              <ReportsPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/settings"
          element={
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/automation"
          element={
            <DashboardLayout>
              <AutomationPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/inventory"
          element={
            <DashboardLayout>
              <InventoryPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/cancellation"
          element={
            <DashboardLayout>
              <CancellationPage />
            </DashboardLayout>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}