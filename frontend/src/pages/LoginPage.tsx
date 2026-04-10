import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { authApi } from "../api";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(username, password);
      const data = res.data;
      setAuth(data.access_token, {
        user_id: data.user_id,
        username: data.username,
        full_name: data.full_name,
        role: data.role,
      });
      navigate(data.role === "sale_upload" ? "/sale-upload" : "/deals-dashboard");
    } catch (error) {
      const err = error as AxiosError<{ detail?: string }>;
      if (err.code === "ECONNABORTED") {
        setError("Login timeout. Please try again.");
      } else if (!err.response) {
        setError("Cannot reach server. Please check your network and try again.");
      } else if (err.response.status === 401) {
        setError("Invalid username or password");
      } else {
        setError(err.response.data?.detail || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-blue-100 rounded-full opacity-20 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-96 h-96 bg-blue-50 rounded-full opacity-30 blur-3xl"></div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-[#131b2e] to-[#1a3a5c] px-8 py-16">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
              <span className="text-white text-sm font-extrabold tracking-wide leading-none">CES</span>
            </div>
            <h1 className="text-3xl font-black text-white font-headline mb-2 leading-tight">CES Sale Operation System</h1>
          </div>

          {/* Form Container */}
          <div className="px-8 py-10">
            <div className="mb-8">
              <p className="text-center text-slate-600 font-medium text-lg">Sign in to continue</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <span className="material-symbols-outlined text-red-600 text-xl flex-shrink-0">error</span>
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Username Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-3.5 text-slate-400 text-lg">person</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 transition bg-white hover:border-slate-300"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-3.5 text-slate-400 text-lg">lock</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-10 pr-12 py-3 border-2 border-slate-200 rounded-lg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 transition bg-white hover:border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-gradient-to-r from-[#131b2e] to-[#1a3a5c] hover:from-[#1a3a5c] hover:to-[#2a5a7c] disabled:from-slate-400 disabled:to-slate-400 text-white font-semibold py-3 rounded-lg transition shadow-lg hover:shadow-xl disabled:shadow-none"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    Signing in...
                  </div>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-center text-xs text-slate-500">
                Protected by enterprise security
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Need help? <span className="text-primary-600 font-semibold cursor-pointer hover:underline">Contact support</span>
          </p>
        </div>
      </div>
    </div>
  );
}
