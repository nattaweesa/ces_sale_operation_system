import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const originalRequest = err.config;
    const method = (originalRequest?.method || "").toLowerCase();
    const status = err.response?.status;
    const isTimeout = err.code === "ECONNABORTED";
    const isNetworkError = !err.response;
    const isGatewayError = status === 502 || status === 503 || status === 504;

    // Retry read-only requests for transient network/proxy failures.
    if (originalRequest && method === "get" && (isTimeout || isNetworkError || isGatewayError)) {
      const retries = (originalRequest as { __retryCount?: number }).__retryCount || 0;
      if (retries < 2) {
        (originalRequest as { __retryCount?: number }).__retryCount = retries + 1;
        await new Promise((resolve) => setTimeout(resolve, 500 * (retries + 1)));
        return api.request(originalRequest);
      }
    }

    if (status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
