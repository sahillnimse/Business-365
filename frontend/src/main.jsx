import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/context/AuthContext";
import { AppLayout } from "@/components/AppLayout";

import DashboardPage from "@/routes/index";
import ValidationPage from "@/routes/validation";
import UploadPage from "@/routes/upload";
import InventoryPage from "@/routes/inventory";
import PurchasingPage from "@/routes/purchasing";
import FinancePage from "@/routes/finance";
import SettingsPage from "@/routes/settings";
import ProfilePage from "@/routes/profile";

import "./styles.css";

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="validation" element={<ValidationPage />} />
                <Route path="upload" element={<UploadPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="purchasing" element={<PurchasingPage />} />
                <Route path="finance" element={<FinancePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>

      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  );
}

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}