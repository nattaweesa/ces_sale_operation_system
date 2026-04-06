import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
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
import BOQPage from "./pages/BOQPage";
import MaterialApprovalPage from "./pages/MaterialApprovalPage";
import UsersPage from "./pages/UsersPage";
import DealsPage from "./pages/DealsPage";
import DealsDashboardPage from "./pages/DealsDashboardPage";
import DealsReviewReportPage from "./pages/DealsReviewReportPage";
import SourcingReviewPage from "./pages/SourcingReviewPage";
import QuotationIntakePage from "./pages/QuotationIntakePage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <BrowserRouter>
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
            <Route index element={<Navigate to="/quotations" replace />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="brands" element={<BrandsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="deals" element={<DealsPage />} />
            <Route path="deals-dashboard" element={<DealsDashboardPage />} />
            <Route path="deals-review-report" element={<DealsReviewReportPage />} />
            <Route path="quotations" element={<QuotationsPage />} />
            <Route path="quotation-intake" element={<QuotationIntakePage />} />
            <Route path="quotations/:id" element={<QuotationDetailPage />} />
            <Route path="boqs/:id" element={<BOQPage />} />
            <Route path="quotations/:id/material-approval" element={<MaterialApprovalPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="sourcing-review" element={<SourcingReviewPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
