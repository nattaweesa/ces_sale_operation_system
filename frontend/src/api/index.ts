import api from "./client";

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
  list: (params?: { q?: string; brand_id?: number; category_id?: number; status?: string }) =>
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

export const customersApi = {
  list: (params?: { q?: string }) => api.get("/customers", { params }),
  get: (id: number) => api.get(`/customers/${id}`),
  create: (data: unknown) => api.post("/customers", data),
  update: (id: number, data: unknown) => api.put(`/customers/${id}`, data),
  addContact: (cid: number, data: unknown) => api.post(`/customers/${cid}/contacts`, data),
  updateContact: (cid: number, ctid: number, data: unknown) => api.put(`/customers/${cid}/contacts/${ctid}`, data),
  deleteContact: (cid: number, ctid: number) => api.delete(`/customers/${cid}/contacts/${ctid}`),
};

export const projectsApi = {
  list: (params?: { customer_id?: number; status?: string }) => api.get("/projects", { params }),
  get: (id: number) => api.get(`/projects/${id}`),
  create: (data: unknown) => api.post("/projects", data),
  update: (id: number, data: unknown) => api.put(`/projects/${id}`, data),
};

export const boqsApi = {
  create: (data: unknown) => api.post("/boqs", data),
  get: (id: number) => api.get(`/boqs/${id}`),
  addItem: (id: number, data: unknown) => api.post(`/boqs/${id}/items`, data),
  updateItem: (id: number, itemId: number, data: unknown) => api.put(`/boqs/${id}/items/${itemId}`, data),
  deleteItem: (id: number, itemId: number) => api.delete(`/boqs/${id}/items/${itemId}`),
  importExcel: (id: number, formData: FormData) =>
    api.post(`/boqs/${id}/import`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
};

export const quotationsApi = {
  list: (params?: { project_id?: number; status?: string }) => api.get("/quotations", { params }),
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
};

export const dealsApi = {
  list: (params?: { owner_id?: number; stage?: string; status?: string }) => api.get("/deals", { params }),
  get: (id: number) => api.get(`/deals/${id}`),
  create: (data: unknown) => api.post("/deals", data),
  update: (id: number, data: unknown) => api.put(`/deals/${id}`, data),
  addTask: (id: number, data: unknown) => api.post(`/deals/${id}/tasks`, data),
  updateTask: (id: number, taskId: number, data: unknown) => api.put(`/deals/${id}/tasks/${taskId}`, data),
  addActivity: (id: number, data: unknown) => api.post(`/deals/${id}/activities`, data),
  dashboardMy: () => api.get("/deals/dashboard/my"),
  dashboardManager: () => api.get("/deals/dashboard/manager"),
  reviewReportManager: () => api.get("/deals/review-report/manager"),
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
