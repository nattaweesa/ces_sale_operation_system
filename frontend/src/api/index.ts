import api from "./client";

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIChatRequest {
  message: string;
  history?: AIChatMessage[];
}

export interface AIChatResponse {
  response: string;
}

export interface AISettingsOut {
  provider: string;
  model: string;
  has_api_key: boolean;
  api_key_masked?: string | null;
  updated_at?: string | null;
  updated_by_name?: string | null;
}

export interface AISettingsUpdateIn {
  model: string;
  api_key?: string;
  clear_api_key?: boolean;
}

export interface AISettingsTestOut {
  ok: boolean;
  detail: string;
  model: string;
}

export interface AIKnowledgeDocumentOut {
  id: number;
  title: string;
  source_filename: string;
  mime_type?: string | null;
  content_chars: number;
  is_active: boolean;
  uploaded_by: number;
  uploaded_by_name?: string | null;
  created_at: string;
}

export interface AIKnowledgeUploadOut {
  id: number;
  title: string;
  content_chars: number;
}

export const aiChatApi = {
  query: (data: AIChatRequest) => api.post<AIChatResponse>("/ai-chat/query", data),
};

export const aiSettingsApi = {
  get: () => api.get<AISettingsOut>("/admin/ai-settings"),
  update: (data: AISettingsUpdateIn) => api.put<AISettingsOut>("/admin/ai-settings", data),
  test: () => api.post<AISettingsTestOut>("/admin/ai-settings/test"),
};

export const aiKnowledgeApi = {
  listDocuments: () => api.get<AIKnowledgeDocumentOut[]>("/admin/ai-knowledge/documents"),
  uploadDocument: (formData: FormData) =>
    api.post<AIKnowledgeUploadOut>("/admin/ai-knowledge/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deactivateDocument: (id: number) => api.delete(`/admin/ai-knowledge/documents/${id}`),
};

export interface LoginResponse {
  access_token: string;
  user_id: number;
  username: string;
  full_name: string;
  role: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { username, password }),
  me: () => api.get("/users/me"),
};

export const productsApi = {
  list: (params?: { q?: string; brand_id?: number; category_id?: number; status?: string; page?: number; page_size?: number }) =>
    api.get("/products", { params }),
  get: (id: number) => api.get(`/products/${id}`),
  create: (data: unknown) => api.post("/products", data),
  update: (id: number, data: unknown) => api.put(`/products/${id}`, data),
  delete: (id: number) => api.delete(`/products/${id}`),
  uploadAttachment: (id: number, formData: FormData) =>
    api.post(`/products/${id}/attachments`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  listAttachments: (id: number) => api.get(`/products/${id}/attachments`),
  deleteAttachment: (pid: number, aid: number) => api.delete(`/products/${pid}/attachments/${aid}`),
  downloadAttachmentUrl: (pid: number, aid: number) => `/api/products/${pid}/attachments/${aid}/download`,
};

export const brandsApi = {
  list: () => api.get("/brands"),
  create: (data: { name: string }) => api.post("/brands", data),
  update: (id: number, data: { name: string }) => api.put(`/brands/${id}`, data),
  delete: (id: number) => api.delete(`/brands/${id}`),
};

export const categoriesApi = {
  list: () => api.get("/categories"),
  create: (data: unknown) => api.post("/categories", data),
  update: (id: number, data: unknown) => api.put(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
};

export const quotationUploadsApi = {
  myUploads: () => api.get("/quotation-uploads/my-uploads"),
  review: () => api.get("/quotation-uploads/review"),
  upload: (formData: FormData) => api.post("/quotation-uploads/upload", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  delete: (id: number) => api.delete(`/quotation-uploads/${id}`),
  view: (id: number) => api.get(`/quotation-uploads/${id}/view`, { responseType: "blob" }),
};

export const adminActivityApi = {
  userSessions: () => api.get("/admin/user-sessions"),
  getUserActivity: (
    userId: number,
    params?: {
      limit?: number;
      offset?: number;
      action?: string;
      date_from?: string;
      date_to?: string;
      q?: string;
    },
  ) => api.get(`/admin/user-sessions/${userId}/activity`, { params }),
  exportUserActivityCsv: (
    userId: number,
    params?: {
      action?: string;
      date_from?: string;
      date_to?: string;
      q?: string;
    },
  ) => api.get(`/admin/user-sessions/${userId}/activity/export.csv`, { params, responseType: "blob" }),
};

export const customersApi = {
  list: (params?: { q?: string; department_ids?: number[] }) => api.get("/customers", { params }),
  get: (id: number) => api.get(`/customers/${id}`),
  create: (data: unknown) => api.post("/customers", data),
  update: (id: number, data: unknown) => api.put(`/customers/${id}`, data),
  addContact: (cid: number, data: unknown) => api.post(`/customers/${cid}/contacts`, data),
  updateContact: (cid: number, ctid: number, data: unknown) => api.put(`/customers/${cid}/contacts/${ctid}`, data),
  deleteContact: (cid: number, ctid: number) => api.delete(`/customers/${cid}/contacts/${ctid}`),
};

export const projectsApi = {
  list: (params?: { customer_id?: number; status?: string; department_ids?: number[] }) => api.get("/projects", { params }),
  get: (id: number) => api.get(`/projects/${id}`),
  create: (data: unknown) => api.post("/projects", data),
  update: (id: number, data: unknown) => api.put(`/projects/${id}`, data),
};

export const boqsApi = {
  list: () => api.get("/boqs"),
  create: (data: unknown) => api.post("/boqs", data),
  get: (id: number) => api.get(`/boqs/${id}`),
  addItem: (id: number, data: unknown) => api.post(`/boqs/${id}/items`, data),
  updateItem: (id: number, itemId: number, data: unknown) => api.put(`/boqs/${id}/items/${itemId}`, data),
  deleteItem: (id: number, itemId: number) => api.delete(`/boqs/${id}/items/${itemId}`),
  downloadTemplate: () =>
    api.get(`/boqs/import-template/download`, { responseType: "blob" }),
  previewImport: (formData: FormData) =>
    api.post(`/boqs/import-preview`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  importExcel: (id: number, formData: FormData) =>
    api.post(`/boqs/${id}/import`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
};

export const boqPricingV2Api = {
  listBoqRevisions: (params?: { boq_id?: number; project_id?: number }) =>
    api.get("/v2/boq-revisions", { params }),
  createRevisionFromBoq: (boqId: number) => api.post(`/v2/boq-revisions/from-boq/${boqId}`),
  getRevision: (revisionId: number) => api.get(`/v2/boq-revisions/${revisionId}`),
  listPricingSessionsByBoq: (boqId: number) =>
    api.get("/v2/pricing-sessions", { params: { boq_id: boqId } }),
  listPricingSessions: (params?: { project_id?: number }) =>
    api.get("/v2/pricing-sessions", { params }),
  createPricingSession: (data: { boq_revision_id: number; currency?: string; vat_rate?: number }) =>
    api.post("/v2/pricing-sessions", data),
  getPricingSession: (sessionId: number) => api.get(`/v2/pricing-sessions/${sessionId}`),
  updatePricingLine: (sessionId: number, lineId: number, data: unknown) =>
    api.patch(`/v2/pricing-sessions/${sessionId}/lines/${lineId}`, data),
  finalizePricingSession: (sessionId: number) => api.post(`/v2/pricing-sessions/${sessionId}/finalize`),
  createQuotationFromPricing: (sessionId: number) => api.post(`/v2/quotations/from-pricing/${sessionId}`),
  listQuotations: (params?: { project_id?: number }) =>
    api.get("/v2/quotations", { params }),
  getQuotation: (quotationId: number) => api.get(`/v2/quotations/${quotationId}`),
  listSnapshots: (quotationId: number) => api.get(`/v2/quotations/${quotationId}/snapshots`),
};

export const quotationsApi = {
  list: (params?: { project_id?: number; status?: string; department_ids?: number[] }) => api.get("/quotations", { params }),
  get: (id: number) => api.get(`/quotations/${id}`),
  create: (data: unknown) => api.post("/quotations", data),
  update: (id: number, data: unknown) => api.put(`/quotations/${id}`, data),
  addSection: (id: number, data: unknown) => api.post(`/quotations/${id}/sections`, data),
  updateSection: (id: number, sid: number, data: unknown) => api.put(`/quotations/${id}/sections/${sid}`, data),
  deleteSection: (id: number, sid: number) => api.delete(`/quotations/${id}/sections/${sid}`),
  addLine: (id: number, data: unknown) => api.post(`/quotations/${id}/lines`, data),
  updateLine: (id: number, lid: number, data: unknown) => api.put(`/quotations/${id}/lines/${lid}`, data),
  deleteLine: (id: number, lid: number) => api.delete(`/quotations/${id}/lines/${lid}`),
  issue: (id: number) => api.post(`/quotations/${id}/issue`),
  listRevisions: (id: number) => api.get(`/quotations/${id}/revisions`),
  revisionPdfUrl: (id: number, rev: number) => `/api/quotations/${id}/revisions/${rev}/pdf`,
  createMaterialApproval: (id: number, data: unknown) => api.post(`/quotations/${id}/material-approval`, data),
  listMaterialApprovals: (id: number) => api.get(`/quotations/${id}/material-approval`),
  materialApprovalPdfUrl: (id: number, pkgId: number) => `/api/quotations/${id}/material-approval/${pkgId}/pdf`,
};

export const usersApi = {
  list: () => api.get("/users"),
  create: (data: unknown) => api.post("/users", data),
  update: (id: number, data: unknown) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  me: () => api.get("/users/me"),
  updateMe: (data: { full_name?: string; email?: string }) => api.put("/users/me", data),
  changeMyPassword: (data: { current_password: string; new_password: string }) => api.put("/users/me/password", data),
};

export const rolePermissionsApi = {
  catalog: () => api.get("/role-permissions/catalog"),
  me: () => api.get("/role-permissions/me"),
  getByRole: (role: string) => api.get(`/role-permissions/${role}`),
  updateByRole: (role: string, permissions: Array<{ permission_key: string; is_allowed: boolean }>) =>
    api.put(`/role-permissions/${role}`, { permissions }),
};

export interface DepartmentOut {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

export const departmentsApi = {
  list: () => api.get<DepartmentOut[]>("/departments"),
  get: (id: number) => api.get<DepartmentOut>(`/departments/${id}`),
  create: (data: { name: string; is_active?: boolean }) => api.post<DepartmentOut>("/departments", data),
  update: (id: number, data: { name?: string; is_active?: boolean }) =>
    api.put<DepartmentOut>(`/departments/${id}`, data),
  delete: (id: number) => api.delete(`/departments/${id}`),
};

export const dealsApi = {
  list: (params?: { owner_id?: number; department_id?: number; stage?: string; status?: string }) => api.get("/deals", { params }),
  get: (id: number) => api.get(`/deals/${id}`),
  create: (data: unknown) => api.post("/deals", data),
  update: (id: number, data: unknown) => api.put(`/deals/${id}`, data),
  listMonthlyForecasts: (id: number) => api.get(`/deals/${id}/monthly-forecasts`),
  replaceMonthlyForecasts: (
    id: number,
    items: Array<{ forecast_year: number; forecast_month: number; amount: number; win_pct: number; note?: string | null }>
  ) => api.put(`/deals/${id}/monthly-forecasts`, { items }),
  addTask: (id: number, data: unknown) => api.post(`/deals/${id}/tasks`, data),
  updateTask: (id: number, taskId: number, data: unknown) => api.put(`/deals/${id}/tasks/${taskId}`, data),
  addActivity: (id: number, data: unknown) => api.post(`/deals/${id}/activities`, data),
  dashboardMy: () => api.get("/deals/dashboard/my"),
  dashboardManager: (params?: { owner_id?: number; department_id?: number }) => api.get("/deals/dashboard/manager", { params }),
  reviewReportManager: (params?: { department_ids?: number[] }) => api.get("/deals/review-report/manager", { params }),
};

export interface DealMasterDataCustomerType {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface DealMasterDataCompany {
  id: number;
  customer_type_id: number;
  customer_type_name?: string | null;
  customer_id: number;
  customer_name?: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface DealMasterDataProductSystemType {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface DealMasterDataProjectStatus {
  id: number;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface DealMasterDataCESStage {
  id: number;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface DealMasterDataBundle {
  customer_types: DealMasterDataCustomerType[];
  companies: DealMasterDataCompany[];
  product_system_types: DealMasterDataProductSystemType[];
  project_statuses: DealMasterDataProjectStatus[];
  ces_stages: DealMasterDataCESStage[];
}

export const dealMasterDataApi = {
  options: () => api.get<DealMasterDataBundle>("/deal-master-data/options"),
  overview: () => api.get<DealMasterDataBundle>("/deal-master-data/overview"),
  createCustomerType: (data: { name: string; sort_order?: number; is_active?: boolean }) =>
    api.post<DealMasterDataCustomerType>("/deal-master-data/customer-types", data),
  updateCustomerType: (id: number, data: { name?: string; sort_order?: number; is_active?: boolean }) =>
    api.put<DealMasterDataCustomerType>(`/deal-master-data/customer-types/${id}`, data),
  createCompany: (data: { customer_type_id: number; name: string; sort_order?: number; is_active?: boolean; customer_id?: number }) =>
    api.post<DealMasterDataCompany>("/deal-master-data/companies", data),
  updateCompany: (id: number, data: { customer_type_id?: number; name?: string; sort_order?: number; is_active?: boolean; customer_id?: number }) =>
    api.put<DealMasterDataCompany>(`/deal-master-data/companies/${id}`, data),
  quickAddCompany: (data: { customer_type_id: number; name: string; sort_order?: number; customer_id?: number }) =>
    api.post<DealMasterDataCompany>("/deal-master-data/quick-add/company", data),
  createProductSystemType: (data: { name: string; sort_order?: number; is_active?: boolean }) =>
    api.post<DealMasterDataProductSystemType>("/deal-master-data/product-system-types", data),
  updateProductSystemType: (id: number, data: { name?: string; sort_order?: number; is_active?: boolean }) =>
    api.put<DealMasterDataProductSystemType>(`/deal-master-data/product-system-types/${id}`, data),
  quickAddProductSystemType: (data: { name: string; sort_order?: number }) =>
    api.post<DealMasterDataProductSystemType>("/deal-master-data/quick-add/product-system-type", data),
  createProjectStatus: (data: { key?: string; label: string; sort_order?: number; is_active?: boolean }) =>
    api.post<DealMasterDataProjectStatus>("/deal-master-data/project-statuses", data),
  updateProjectStatus: (id: number, data: { key?: string; label?: string; sort_order?: number; is_active?: boolean }) =>
    api.put<DealMasterDataProjectStatus>(`/deal-master-data/project-statuses/${id}`, data),
  createCESStage: (data: { key?: string; label: string; sort_order?: number; is_active?: boolean }) =>
    api.post<DealMasterDataCESStage>("/deal-master-data/ces-stages", data),
  updateCESStage: (id: number, data: { key?: string; label?: string; sort_order?: number; is_active?: boolean }) =>
    api.put<DealMasterDataCESStage>(`/deal-master-data/ces-stages/${id}`, data),
};

export const sourcingApi = {
  backfill: () => api.post("/sourcing/backfill", { run: true }),
  stats: () => api.get("/sourcing/stats"),
  reviewQueue: (params?: { limit?: number }) => api.get("/sourcing/review-queue", { params }),
  confirmMatch: (reviewId: number, productId: number, note?: string) =>
    api.post(`/sourcing/review-queue/${reviewId}/confirm`, { product_id: productId, note }),
  createProductFromReview: (
    reviewId: number,
    data: {
      item_code?: string;
      description?: string;
      brand_id?: number;
      category_id?: number;
      list_price?: number;
      currency?: string;
      status?: string;
      moq?: number;
      lead_time_days?: number;
      remark?: string;
      note?: string;
    }
  ) => api.post(`/sourcing/review-queue/${reviewId}/create-product`, data),
};

export const quotationIntakeApi = {
  uploadPdf: (formData: FormData, onUploadProgress?: (percent: number) => void) =>
    api.post("/quotation-intake/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (evt) => {
        if (!onUploadProgress) return;
        if (!evt.total || evt.total <= 0) return;
        const percent = Math.max(0, Math.min(100, Math.round((evt.loaded * 100) / evt.total)));
        onUploadProgress(percent);
      },
    }),
  listDocuments: () => api.get("/quotation-intake/documents"),
  getDocument: (documentId: number) => api.get(`/quotation-intake/documents/${documentId}`),
  deleteDocument: (documentId: number) => api.delete(`/quotation-intake/documents/${documentId}`),
  confirmMissing: (documentId: number, data: { line_ids: number[] }) =>
    api.post(`/quotation-intake/documents/${documentId}/confirm-missing`, data),
};

export const quotationMasterDataApi = {
  preview: (formData: FormData) =>
    api.post("/quotation-master-data/preview", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export const masterDataApi = {
  uploadBatch: (formData: FormData, onUploadProgress?: (percent: number) => void) =>
    api.post("/master-data/batches/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (evt) => {
        if (!onUploadProgress || !evt.total || evt.total <= 0) return;
        const percent = Math.max(0, Math.min(100, Math.round((evt.loaded * 100) / evt.total)));
        onUploadProgress(percent);
      },
    }),
  listBatches: (params?: { limit?: number }) => api.get("/master-data/batches", { params }),
  getBatchDetail: (batchId: number) => api.get(`/master-data/batches/${batchId}`),
  reprocessBatch: (batchId: number) => api.post(`/master-data/batches/${batchId}/reprocess`),
  listCandidates: (params?: { status?: string; limit?: number }) => api.get("/master-data/candidates", { params }),
  getCandidate: (candidateId: number) => api.get(`/master-data/candidates/${candidateId}`),
  aiCanonical: (candidateId: number, data: { draft_description: string }) =>
    api.post(`/master-data/candidates/${candidateId}/ai-canonical`, data),
  reviewCandidate: (
    candidateId: number,
    data: {
      action: "approve_new" | "merge_existing" | "reject";
      target_product_id?: number;
      canonical_description?: string;
      selected_list_price?: number;
      note?: string;
    }
  ) => api.post(`/master-data/candidates/${candidateId}/review`, data),
  publishedEvidence: (params?: { limit?: number }) => api.get("/master-data/published-evidence", { params }),
  publishedEvidenceByProduct: (productId: number, params?: { limit?: number }) =>
    api.get(`/master-data/published-evidence/${productId}`, { params }),
};
