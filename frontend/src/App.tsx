import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ConfigProvider, message } from "antd";
import { useAuthStore } from "./store/authStore";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import ProductsPage from "./pages/ProductsPage";
import BrandsPage from "./pages/BrandsPage";
import CategoriesPage from "./pages/CategoriesPage";
import CustomersPage from "./pages/CustomersPage";
import ProjectsPage from "./pages/ProjectsPage";
import QuotationsPage from "./pages/QuotationsPage";
import QuotationDetailPage from "./pages/QuotationDetailPage";
import BOQsPage from "./pages/BOQsPage";
import BOQPage from "./pages/BOQPage";
import MaterialApprovalPage from "./pages/MaterialApprovalPage";
import UsersPage from "./pages/UsersPage";
import DealsPage from "./pages/DealsPage";
import DealsDashboardPage from "./pages/DealsDashboardPage";
import DealsReviewReportPage from "./pages/DealsReviewReportPage";
import QuotationIntakePage from "./pages/QuotationIntakePage";
import SaleUploadPage from "./pages/SaleUploadPage";
import ProductManualEditPage from "./pages/ProductManualEditPage";
import RolePermissionsPage from "./pages/RolePermissionsPage";
import UserSessionsPage from "./pages/UserSessionsPage";
import ProfilePage from "./pages/ProfilePage";
import QuotationMasterDataPage from "./pages/QuotationMasterDataPage";
import PricingSessionV2Page from "./pages/PricingSessionV2Page";
import QuotationV2Page from "./pages/QuotationV2Page";
import V2OverviewPage from "./pages/V2OverviewPage";
import AIChatPage from "./pages/AIChatPage";
import AdminAISettingsPage from "./pages/AdminAISettingsPage";
import { useThemeStore } from "./store/themeStore";
import { getAppThemeDefinition } from "./theme/themes";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRoles({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={user.role === "sale_upload" ? "/sale-upload" : "/deals-dashboard"} replace />;
  }
  return <>{children}</>;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;

function getTokenExpiryMs(token: string): number | null {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));
    if (!payload?.exp) return null;
    return Number(payload.exp) * 1000;
  } catch {
    return null;
  }
}

function SessionManager() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;

    const runLogout = (reason: "idle" | "expired") => {
      message.destroy("session-warning");
      logout();
      navigate("/login", { replace: true });
      message.warning(
        reason === "idle"
          ? "Session timed out due to inactivity. Please login again."
          : "Session expired. Please login again.",
      );
    };

    const timers: number[] = [];
    const expiryMs = getTokenExpiryMs(token);
    const now = Date.now();

    if (expiryMs && expiryMs <= now) {
      runLogout("expired");
      return;
    }

    if (expiryMs) {
      const warnAtMs = expiryMs - WARNING_BEFORE_MS;
      if (warnAtMs > now) {
        timers.push(
          window.setTimeout(() => {
            message.warning({
              key: "session-warning",
              content: "Your session will expire in about 2 minutes.",
              duration: 4,
            });
          }, warnAtMs - now),
        );
      }

      timers.push(
        window.setTimeout(() => {
          runLogout("expired");
        }, expiryMs - now),
      );
    }

    let idleWarnTimer: number | null = null;
    let idleLogoutTimer: number | null = null;

    const scheduleIdleTimers = () => {
      if (idleWarnTimer) window.clearTimeout(idleWarnTimer);
      if (idleLogoutTimer) window.clearTimeout(idleLogoutTimer);

      idleWarnTimer = window.setTimeout(() => {
        message.warning({
          key: "session-warning",
          content: "No activity detected. You will be logged out in 2 minutes.",
          duration: 4,
        });
      }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

      idleLogoutTimer = window.setTimeout(() => {
        runLogout("idle");
      }, IDLE_TIMEOUT_MS);
    };

    const onActivity = () => {
      message.destroy("session-warning");
      scheduleIdleTimers();
    };

    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    scheduleIdleTimers();

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      if (idleWarnTimer) window.clearTimeout(idleWarnTimer);
      if (idleLogoutTimer) window.clearTimeout(idleLogoutTimer);
      events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      message.destroy("session-warning");
    };
  }, [token, logout, navigate]);

  return null;
}

export default function App() {
  const themeName = useThemeStore((s) => s.themeName);
  const appTheme = getAppThemeDefinition(themeName);

  useEffect(() => {
    document.documentElement.dataset.theme = themeName;
    document.documentElement.classList.toggle("dark", appTheme.mode === "dark");
  }, [themeName, appTheme.mode]);

  return (
    <ConfigProvider theme={appTheme.antTheme}>
      <BrowserRouter>
        <SessionManager />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/deals-dashboard" replace />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/manual-edit" element={<ProductManualEditPage />} />
            <Route path="brands" element={<BrandsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="deals" element={<DealsPage />} />
            <Route path="deals-dashboard" element={<DealsDashboardPage />} />
            <Route path="deals-review-report" element={<DealsReviewReportPage />} />
            <Route path="quotations" element={<QuotationsPage />} />
            <Route path="boqs" element={<BOQsPage />} />
            <Route path="quotation-intake" element={<QuotationIntakePage />} />
            <Route path="sale-upload" element={<SaleUploadPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="quotations/:id" element={<QuotationDetailPage />} />
            <Route path="boqs/:id" element={<BOQPage />} />
            <Route path="v2" element={<V2OverviewPage />} />
            <Route path="v2/pricing-sessions/:id" element={<PricingSessionV2Page />} />
            <Route path="v2/quotations/:id" element={<QuotationV2Page />} />
            <Route path="quotations/:id/material-approval" element={<MaterialApprovalPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="admin/role-permissions" element={<RequireRoles roles={["admin"]}><RolePermissionsPage /></RequireRoles>} />
            <Route path="admin/user-sessions" element={<RequireRoles roles={["admin"]}><UserSessionsPage /></RequireRoles>} />
            <Route path="admin/quotation-master-data" element={<RequireRoles roles={["admin", "manager"]}><QuotationMasterDataPage /></RequireRoles>} />
            <Route path="admin/ai-settings" element={<RequireRoles roles={["admin"]}><AdminAISettingsPage /></RequireRoles>} />
            <Route path="ai-chat" element={<RequireRoles roles={["admin", "manager"]}><AIChatPage /></RequireRoles>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
