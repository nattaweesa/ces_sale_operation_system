import axios from "axios";

// Get base URL from environment or derive from current location
const getBaseURL = () => {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl;
  }

  if (typeof window !== "undefined" && window.location) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;

    // Local development should always use Vite proxy (/api -> backend).
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "/api";
    }

    // Staging frontend on 5174 should talk to staging backend on 8001.
    if (port === "5174") {
      return `${protocol}//${hostname}:8001`;
    }

    // For domain/reverse-proxy deployments, route API via same host path.
    return "/api";
  }

  return "/api";
};

const api = axios.create({
  baseURL: getBaseURL(),
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
