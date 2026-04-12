import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { rolePermissionsApi } from "../api";
import ThemeToggle from "./ThemeToggle";
import { useThemeStore } from "../store/themeStore";

type NavChild = { key: string; label: string; path: string; icon: string };
type NavGroup = { key: string; label: string; icon: string; children: NavChild[] };
type NavItem = { key: string; label: string; icon: string; path: string } | NavGroup;

const isExternalPath = (path: string): boolean => /^https?:\/\//.test(path);

const allNavItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", path: "/deals-dashboard" },
  {
    key: "deals", label: "Deals", icon: "handshake",
    children: [
      { key: "deals", label: "Sales Funnel", icon: "filter_alt", path: "/deals" },
      { key: "boqs", label: "BOQ", icon: "table_chart", path: "/boqs" },
      { key: "v2-pricing", label: "V2 Pricing", icon: "price_change", path: "/v2" },
      { key: "quotations", label: "Quotations", icon: "description", path: "/quotations" },
      { key: "deals-review-report", label: "Review Report", icon: "fact_check", path: "/deals-review-report" },
    ],
  },
  {
    key: "products", label: "Products", icon: "inventory_2",
    children: [
      { key: "products", label: "Product Catalog", icon: "view_list", path: "/products" },
      { key: "brands", label: "Brands", icon: "label", path: "/brands" },
      { key: "categories", label: "Categories", icon: "category", path: "/categories" },
    ],
  },
  {
    key: "crm", label: "CRM", icon: "groups",
    children: [
      { key: "customers", label: "Customers", icon: "person", path: "/customers" },
      { key: "projects", label: "Projects", icon: "folder_open", path: "/projects" },
    ],
  },
  {
    key: "admin", label: "Admin", icon: "admin_panel_settings",
    children: [
      { key: "admin-ai-chat", label: "AI Assistant", icon: "smart_toy", path: "/ai-chat" },
      { key: "users", label: "Users", icon: "manage_accounts", path: "/users" },
      { key: "admin-user-sessions", label: "User Sessions", icon: "history", path: "/admin/user-sessions" },
      { key: "admin-role-permissions", label: "Role Permissions", icon: "admin_panel_settings", path: "/admin/role-permissions" },
      { key: "admin-quotation-master-data", label: "Quotation Master Data", icon: "dataset_linked", path: "/admin/quotation-master-data" },
      { key: "admin-ai-settings", label: "AI Settings", icon: "settings_suggest", path: "/admin/ai-settings" },
      { key: "admin-monitor-grafana", label: "Grafana", icon: "monitoring", path: "http://187.77.156.215:3000" },
      { key: "admin-monitor-prometheus", label: "Prometheus", icon: "query_stats", path: "http://187.77.156.215:9090" },
      { key: "admin-monitor-kuma", label: "Uptime Kuma", icon: "monitor_heart", path: "http://187.77.156.215:3001" },
    ],
  },
];

const saleUploadItems: NavItem[] = [
  { key: "sale-upload", label: "Upload Quotation PDF", icon: "upload_file", path: "/sale-upload" },
];

function getNavItems(role?: string, perms?: Record<string, boolean>): NavItem[] {
  if (role === "sale_upload") return saleUploadItems;
  const isSales = role === "sales";
  const canViewDealReview = isSales || (perms?.["deals.view_all"] ?? ["admin", "manager", "sales_admin"].includes(role || ""));
  const canAccessAdminMenu = perms?.["menu.admin_access"] ?? ["admin", "manager"].includes(role || "");
  const canConfigureRoles = role === "admin";
  const canUseAiChat = ["admin", "manager"].includes(role || "");
  return allNavItems.map((item) => {
    if ("children" in item && isSales && ["products", "crm"].includes(item.key)) {
      return null;
    }
    if ("children" in item && item.key === "admin" && !canAccessAdminMenu) {
      return null;
    }
    if (!("children" in item)) return item;
    const children = item.children.filter(
      (c) =>
        (!isSales || !["boqs", "v2-pricing", "quotations"].includes(c.key)) &&
        (c.key !== "admin-ai-chat" || canUseAiChat) &&
        (c.key !== "deals-review-report" || canViewDealReview) &&
        (c.key !== "admin-role-permissions" || canConfigureRoles) &&
        (c.key !== "admin-user-sessions" || canConfigureRoles) &&
        (c.key !== "admin-ai-settings" || canConfigureRoles) &&
        (!["admin-monitor-grafana", "admin-monitor-prometheus", "admin-monitor-kuma"].includes(c.key) || canConfigureRoles)
    );
    if (!children.length) return null;
    return { ...item, children };
  }).filter((item): item is NavItem => item !== null);
}

function getCurrentKey(pathname: string): string {
  const all = [...allNavItems, ...saleUploadItems];
  for (const item of all) {
    if ("path" in item && pathname.startsWith(item.path)) return item.key;
    if ("children" in item) {
      for (const child of item.children) {
        if (pathname.startsWith(child.path)) return child.key;
      }
    }
  }
  return "";
}

function getOpenGroup(pathname: string, items: NavItem[]): string {
  for (const item of items) {
    if ("children" in item) {
      for (const child of item.children) {
        if (pathname.startsWith(child.path)) return item.key;
      }
    }
  }
  return "";
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const themeName = useThemeStore((s) => s.themeName);
  const isAtrium = themeName === "atrium-dark";
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadPermissions = async () => {
      if (!user) return;
      try {
        const res = await rolePermissionsApi.me();
        const map: Record<string, boolean> = {};
        for (const p of res.data?.permissions || []) {
          map[p.permission_key] = !!p.is_allowed;
        }
        if (mounted) setPermissions(map);
      } catch {
        if (mounted) setPermissions({});
      }
    };
    loadPermissions();
    return () => {
      mounted = false;
    };
  }, [user?.user_id, user?.role]);

  useEffect(() => {
    setProfileMenuOpen(false);
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!profileMenuRef.current) return;
      const target = event.target as Node;
      if (!profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const navItems = getNavItems(user?.role, permissions);
  const currentKey = getCurrentKey(location.pathname);
  const defaultOpen = getOpenGroup(location.pathname, navItems);
  const [openGroup, setOpenGroup] = useState<string>(defaultOpen);

  const handleNav = (path: string) => {
    if (isExternalPath(path)) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(path);
  };

  const toggleGroup = (key: string) => {
    setOpenGroup((prev) => (prev === key ? "" : key));
  };

  const goProfile = () => {
    setProfileMenuOpen(false);
    navigate("/profile");
  };

  const doLogout = () => {
    setProfileMenuOpen(false);
    logout();
    navigate("/login");
  };

  const initials = user?.full_name
    ? user.full_name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const sidebarShellClass = isAtrium
    ? "border-[#162649] bg-gradient-to-b from-[#081632] to-[#030b1f]"
    : "border-[rgb(var(--outline-variant))] bg-[rgb(var(--surface-container-lowest))]";
  const topbarClass = isAtrium
    ? "border-[#17284c] bg-[#091735]/80"
    : "border-[rgb(var(--outline-variant))] bg-[rgb(var(--surface-container-lowest))/0.92]";
  const shellTextClass = isAtrium ? "text-[#dbe3ff]" : "text-[rgb(var(--on-surface))]";
  const mutedTextClass = isAtrium ? "text-[#98a5c8]" : "text-[rgb(var(--on-surface-variant))]";
  const hoverShellClass = isAtrium ? "hover:bg-[#111e3d]" : "hover:bg-[rgb(var(--surface-container-low))]";
  const dividerClass = isAtrium ? "bg-[#243a67]" : "bg-[rgb(var(--outline-variant))]";
  const profileMenuClass = isAtrium
    ? "border-[#1d3159] bg-[#091632]"
    : "border-[rgb(var(--outline-variant))] bg-[rgb(var(--surface-container-lowest))]";
  const mainBgClass = isAtrium
    ? "bg-[radial-gradient(circle_at_20%_0%,rgba(88,106,200,0.08),transparent_35%)]"
    : "bg-[radial-gradient(circle_at_20%_0%,rgba(19,27,46,0.06),transparent_35%)]";

  return (
    <div className={`min-h-screen font-body transition-colors duration-300 ${isAtrium ? "bg-[#030a1a] text-[#dbe3ff]" : "bg-[rgb(var(--background))] text-[rgb(var(--on-surface))]"}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-64 border-r flex flex-col z-50 transition-transform duration-300 ease-in-out ${sidebarShellClass} ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        {/* Logo */}
        <div className="px-6 py-6 mb-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#aeb2ff] to-[#7a7ff5] flex items-center justify-center flex-shrink-0 shadow-[0_10px_30px_rgba(55,73,168,0.55)]">
            <span className="text-[#111a55] text-[11px] font-extrabold tracking-wide leading-none">CES</span>
          </div>
          <div>
            <h1 className={`text-[11px] font-bold font-headline uppercase tracking-[0.16em] leading-tight ${shellTextClass}`}>COMPLETE ELECTRICAL SOLUTIONS</h1>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            if ("path" in item) {
              const active = currentKey === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNav(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    active
                      ? isAtrium
                        ? "bg-[#1a2747] text-[#dbe3ff] font-bold border-l-2 border-[#8b92ff]"
                        : "bg-[rgb(var(--surface-container-low))] text-[rgb(var(--on-surface))] font-bold border-l-2 border-[rgb(var(--primary))]"
                      : `${mutedTextClass} ${hoverShellClass} hover:text-[rgb(var(--on-surface))]`
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <span className="font-headline tracking-tight">{item.label}</span>
                </button>
              );
            }

            // Group item
            const isOpen = openGroup === item.key;
            const groupActive = item.children.some((c) => currentKey === c.key);
            return (
              <div key={item.key}>
                <button
                  onClick={() => toggleGroup(item.key)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    groupActive
                      ? shellTextClass
                      : `${mutedTextClass} ${hoverShellClass} hover:text-[rgb(var(--on-surface))]`
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <span className="font-headline tracking-tight flex-1 text-left">{item.label}</span>
                  <span className={`material-symbols-outlined text-base transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </button>
                {isOpen && (
                  <div className={`ml-4 pl-4 border-l mt-0.5 space-y-0.5 ${isAtrium ? "border-[#22345d]" : "border-[rgb(var(--outline-variant))]"}`}>
                    {item.children.map((child) => {
                      const childActive = currentKey === child.key;
                      return (
                        <button
                          key={child.key}
                          onClick={() => handleNav(child.path)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                            childActive
                              ? isAtrium
                                ? "bg-[#1a2747] text-[#dbe3ff] font-semibold"
                                : "bg-[rgb(var(--surface-container-low))] text-[rgb(var(--on-surface))] font-semibold"
                              : `${mutedTextClass} ${hoverShellClass} hover:text-[rgb(var(--on-surface))]`
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">{child.icon}</span>
                          <span className="font-headline text-[13px] tracking-tight flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className={`px-4 pt-3 pb-5 border-t space-y-0.5 ${isAtrium ? "border-[#17284c]" : "border-[rgb(var(--outline-variant))]"}`}>
          <div className="px-4 pb-3">
            <ThemeToggle compact />
          </div>
          <div className="px-4 pb-2">
            <button className={`w-full rounded-xl py-2.5 text-sm font-semibold ${isAtrium ? "bg-gradient-to-r from-[#8d93ff] to-[#6a71ed] text-[#0e154a] shadow-[0_10px_25px_rgba(116,129,255,0.35)]" : "bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] shadow-[0_10px_25px_rgba(19,27,46,0.18)]"}`}>
              + New Project
            </button>
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors duration-150 ${mutedTextClass} ${hoverShellClass} hover:text-[rgb(var(--on-surface))]`}
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            <span className="font-headline tracking-tight">Logout</span>
          </button>
          <div className="flex items-center gap-3 px-4 py-2.5 mt-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isAtrium ? "bg-[#2a3f73] text-[#dbe3ff]" : "bg-[rgb(var(--surface-container-high))] text-[rgb(var(--on-surface))]"}`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold truncate ${shellTextClass}`}>{user?.full_name}</p>
              <p className={`text-[10px] capitalize ${mutedTextClass}`}>{user?.role?.replace("_", " ")}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Top Header */}
      <header className={`fixed top-0 left-0 right-0 lg:left-64 h-16 z-40 border-b backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 ${topbarClass}`}>
        <div className="flex items-center gap-4">
          {/* Hamburger — mobile only */}
          <button
            className={`lg:hidden p-2 rounded-lg transition-colors ${mutedTextClass} ${hoverShellClass}`}
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined text-2xl">{sidebarOpen ? "close" : "menu"}</span>
          </button>
          <div>
            <p className={`font-semibold font-headline text-sm uppercase tracking-[0.16em] leading-none ${shellTextClass}`}>COMPLETE ELECTRICAL SOLUTIONS</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className={`p-2 rounded-lg transition-colors ${mutedTextClass} ${hoverShellClass} hover:text-[rgb(var(--on-surface))]`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button
            className={`p-2 rounded-lg transition-colors ${mutedTextClass} ${hoverShellClass} hover:text-[rgb(var(--on-surface))]`}
          >
            <span className="material-symbols-outlined">help</span>
          </button>
          <div className={`h-6 w-px ${dividerClass}`}></div>
          <div ref={profileMenuRef} className="relative">
            <button
              onClick={() => { setSidebarOpen(false); setProfileMenuOpen((v) => !v); }}
              className={`flex items-center gap-2 rounded-xl px-2 py-1 transition-colors ${hoverShellClass}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isAtrium ? "bg-[#2a3f73] text-[#dbe3ff]" : "bg-[rgb(var(--surface-container-high))] text-[rgb(var(--on-surface))]"}`}>
                {initials}
              </div>
              <span className={`text-sm font-medium hidden md:block ${shellTextClass}`}>{user?.full_name}</span>
              <span className={`material-symbols-outlined text-base ${mutedTextClass}`}>expand_more</span>
            </button>
            {profileMenuOpen && (
              <div className={`absolute right-0 top-11 w-44 rounded-xl border shadow-2xl z-50 overflow-hidden ${profileMenuClass}`}>
                <button
                  onClick={goProfile}
                  className={`w-full text-left px-3 py-2 text-sm ${shellTextClass} ${hoverShellClass}`}
                >
                  My Profile
                </button>
                <button
                  onClick={doLogout}
                  className="w-full text-left px-3 py-2 text-sm text-[#ff8ba1] hover:bg-[#2a1320]"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`ml-0 lg:ml-64 pt-16 min-h-screen ${mainBgClass}`}>
        <div className="p-6 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
