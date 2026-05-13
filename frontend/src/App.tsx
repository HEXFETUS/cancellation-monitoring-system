import { BrowserRouter, Routes, Route } from "react-router-dom";

import DashboardLayout from "./layouts/DashboardLayout";

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
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/automation" element={<AutomationPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/cancellation" element={<CancellationPage />} />
        </Routes>
      </DashboardLayout>
    </BrowserRouter>
  );
}