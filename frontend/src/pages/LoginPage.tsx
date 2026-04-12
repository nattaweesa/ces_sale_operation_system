import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { authApi } from "../api";
import { useAuthStore } from "../store/authStore";
import ThemeToggle from "../components/ThemeToggle";
import { useThemeStore } from "../store/themeStore";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const themeName = useThemeStore((s) => s.themeName);
  const isAtrium = themeName === "atrium-dark";

  // Keep login visuals in sync even before other app shells mount.
  useEffect(() => {
    document.documentElement.dataset.theme = themeName;
    document.documentElement.classList.toggle("dark", isAtrium);
  }, [themeName, isAtrium]);

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
    <div className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${isAtrium ? "bg-[#020817] text-[#dee5ff]" : "bg-surface text-on-surface"}`}>
      <div
        className={`absolute inset-0 ${isAtrium
          ? "bg-[radial-gradient(circle_at_14%_14%,rgba(71,93,180,0.24),transparent_36%),radial-gradient(circle_at_84%_86%,rgba(112,92,216,0.22),transparent_28%),linear-gradient(120deg,rgba(3,9,23,0.88),rgba(2,8,22,0.96))]"
          : "bg-[radial-gradient(circle_at_top_left,rgba(19,27,46,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(0,140,199,0.14),transparent_24%),linear-gradient(120deg,rgba(255,255,255,0.55),transparent_50%)]"}`}
      ></div>
      <div className={`absolute inset-y-0 left-0 w-1/2 ${isAtrium ? "bg-[linear-gradient(180deg,rgba(150,170,255,0.06),transparent)]" : "bg-[linear-gradient(180deg,rgba(255,255,255,0.55),transparent)]"}`}></div>

      <div className="relative z-10 flex min-h-screen flex-col p-4 sm:p-6 lg:p-10">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-start justify-center pt-3 lg:items-center lg:pt-0">
          <div className="grid w-full max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            <section className="hidden lg:flex flex-col justify-center px-2 lg:px-8">
              <div className="mb-14 flex items-center gap-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.24)] ${isAtrium ? "bg-gradient-to-br from-[#9fa4ff] to-[#a476ff]" : "bg-gradient-to-br from-primary to-secondary"}`}>
                  <span className={`text-sm font-extrabold tracking-wide ${isAtrium ? "text-[#111a55]" : "text-on-primary"}`}>CES</span>
                </div>
                <div>
                  <h1 className={`text-[11px] font-normal uppercase tracking-[0.22em] ${isAtrium ? "text-[#9fa9c8]" : "text-on-surface-variant"}`}>Complete Electrical Solutions Co., Ltd.</h1>
                  <p className={`text-[11px] uppercase tracking-[0.22em] ${isAtrium ? "text-[#9fa9c8]" : "text-on-surface-variant"}`}>CES Sale Operation System</p>
                </div>
              </div>

              <div className="max-w-2xl">
                <p className={`mb-5 text-sm font-semibold uppercase tracking-[0.24em] ${isAtrium ? "text-[#a8b0ff]" : "text-primary"}`}>ENERGY-FOCUSED WORKSPACE</p>
                <h2 className={`font-headline text-5xl font-extrabold leading-[0.94] tracking-tight sm:text-6xl ${isAtrium ? "text-[#d5dcfb]" : "text-on-surface"}`}>
                  Operate smarter. <span className={isAtrium ? "italic text-[#9fa4ff]" : "italic text-primary"}>Save more energy.</span>
                </h2>
                <p className={`mt-8 max-w-xl text-lg leading-8 ${isAtrium ? "text-[#a7b0cc]" : "text-on-surface-variant"}`}>
                  Coordinate lighting, BAS, HVAC, and security project delivery with visibility from quote to closeout.
                </p>
              </div>

              <div className="mt-12 flex items-center gap-4">
                <div className="flex -space-x-3">
                  <div className="h-11 w-11 rounded-full border-2 border-surface bg-gradient-to-br from-primary to-secondary"></div>
                  <div className="h-11 w-11 rounded-full border-2 border-surface bg-gradient-to-br from-secondary to-primary"></div>
                  <div className="h-11 w-11 rounded-full border-2 border-surface bg-gradient-to-br from-tertiary to-primary"></div>
                </div>
                <p className={`text-sm ${isAtrium ? "text-[#a7b0cc]" : "text-on-surface-variant"}`}>Aligned with CES mission for efficient, future-ready buildings.</p>
              </div>
            </section>

            <section className="flex items-center justify-center">
              <div className={`w-full max-w-md rounded-[2rem] p-9 backdrop-blur-xl ${isAtrium ? "border border-[#1d2f56] bg-[#081633]/78 shadow-[0_28px_90px_rgba(0,0,0,0.48)]" : "border border-outline-variant bg-surface-container-lowest/92 shadow-[0_20px_60px_rgba(15,23,42,0.16)]"}`}>
                <div className="mb-8">
                  <h3 className={`font-headline text-4xl font-bold tracking-tight ${isAtrium ? "text-[#e5eaff]" : "text-on-surface"}`}>CES Sale Operation System</h3>
                  <p className={`mt-2 text-sm ${isAtrium ? "text-[#a4aecf]" : "text-on-surface-variant"}`}>Enter your credentials to access system</p>
                </div>

                {error && (
                  <div className="mb-6 flex gap-3 rounded-2xl border border-error/30 bg-error/10 p-4">
                    <span className="material-symbols-outlined text-error text-xl flex-shrink-0">error</span>
                    <p className="text-sm font-medium text-error">{error}</p>
                  </div>
                )}

                <form onSubmit={onSubmit} className="space-y-5">
                  <div>
                    <label className={`mb-2 block text-xs font-semibold uppercase tracking-[0.2em] ${isAtrium ? "text-[#9ea7c9]" : "text-on-surface-variant"}`}>Username</label>
                    <div className="relative">
                      <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg ${isAtrium ? "text-[#8f9abe]" : "text-on-surface-variant"}`}>{isAtrium ? "alternate_email" : "person"}</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="username"
                        required
                        className={`w-full rounded-2xl px-12 py-4 outline-none transition ${isAtrium
                          ? "border border-[#20345e] bg-black/45 text-[#e8edff] placeholder:text-[#7f8aad] focus:border-[#7781ff] focus:ring-2 focus:ring-[#7781ff]/35"
                          : "border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary/25"}`}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className={`block text-xs font-semibold uppercase tracking-[0.2em] ${isAtrium ? "text-[#9ea7c9]" : "text-on-surface-variant"}`}>Password</label>
                    </div>
                    <div className="relative">
                      <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg ${isAtrium ? "text-[#8f9abe]" : "text-on-surface-variant"}`}>lock</span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className={`w-full rounded-2xl px-12 py-4 outline-none transition ${isAtrium
                          ? "border border-[#20345e] bg-black/45 text-[#e8edff] placeholder:text-[#7f8aad] focus:border-[#7781ff] focus:ring-2 focus:ring-[#7781ff]/35"
                          : "border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary/25"}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${isAtrium ? "text-[#8f9abe] hover:text-[#dbe2ff]" : "text-on-surface-variant hover:text-on-surface"}`}
                      >
                        <span className="material-symbols-outlined text-lg">{showPassword ? "visibility_off" : "visibility"}</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 font-semibold transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 ${isAtrium
                        ? "bg-gradient-to-r from-[#aeb2ff] to-[#696ff2] text-[#10184f] shadow-[0_14px_40px_rgba(115,124,255,0.45)]"
                      : "bg-gradient-to-r from-primary to-secondary text-on-primary shadow-[0_12px_30px_rgba(19,27,46,0.26)]"}`}
                  >
                    {loading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                        Logging in...
                      </>
                    ) : (
                      "Login"
                    )}
                  </button>
                </form>

                <div className={`mt-8 border-t pt-6 text-center ${isAtrium ? "border-[#1f3158]" : "border-outline-variant"}`}></div>
              </div>
            </section>
          </div>
        </div>

        <div className={`hidden lg:flex flex-col gap-3 pt-4 text-[11px] uppercase tracking-[0.22em] sm:flex-row sm:items-center sm:justify-between ${isAtrium ? "text-[#9ba6c8]" : "text-on-surface-variant"}`}>
          <p>© 2026 CES-ASIA.COM</p>
          <div className="flex gap-6">
            <span>{isAtrium ? "Status: Operational" : "Status: Operational"}</span>
            <span>Privacy Protocols</span>
            <span>Security Architecture</span>
          </div>
        </div>
      </div>
    </div>
  );
}
