import { useState } from "react";
import { Layout, Menu, Avatar, Dropdown, Typography, theme } from "antd";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FileTextOutlined, ShoppingOutlined, TeamOutlined, ProjectOutlined,
  AppstoreOutlined, TagsOutlined, TagOutlined, SafetyOutlined,
  UserOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, FunnelPlotOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "../store/authStore";

const { Header, Sider, Content } = Layout;

const navItems = [
  {
    key: "quotations", icon: <FileTextOutlined />, label: "Quotations",
    path: "/quotations",
  },
  {
    key: "master", icon: <AppstoreOutlined />, label: "Master Data",
    children: [
      { key: "products", icon: <ShoppingOutlined />, label: "Products", path: "/products" },
      { key: "brands", icon: <TagOutlined />, label: "Brands", path: "/brands" },
      { key: "categories", icon: <TagsOutlined />, label: "Categories", path: "/categories" },
    ],
  },
  {
    key: "customers", icon: <TeamOutlined />, label: "Customers", path: "/customers",
  },
  {
    key: "projects", icon: <ProjectOutlined />, label: "Projects", path: "/projects",
  },
  {
    key: "sales-project", icon: <FunnelPlotOutlined />, label: "Sales Project",
    children: [
      { key: "deals", icon: <ProjectOutlined />, label: "Deals", path: "/deals" },
      { key: "deals-dashboard", icon: <FunnelPlotOutlined />, label: "Dashboard", path: "/deals-dashboard" },
      { key: "deals-review-report", icon: <SafetyOutlined />, label: "Review Report", path: "/deals-review-report" },
    ],
  },
  {
    key: "admin", icon: <SafetyOutlined />, label: "Admin",
    children: [
      { key: "users", icon: <UserOutlined />, label: "Users", path: "/users" },
      { key: "sourcing-review", icon: <FunnelPlotOutlined />, label: "Sourcing Review", path: "/sourcing-review" },
    ],
  },
];

function flatPaths(items: typeof navItems): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of items) {
    if ("path" in item && item.path) map[item.key] = item.path;
    if ("children" in item) {
      for (const child of item.children!) {
        if ("path" in child && child.path) map[child.key] = child.path;
      }
    }
  }
  return map;
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const { token } = theme.useToken();

  const pathMap = flatPaths(navItems);

  const selectedKey = Object.entries(pathMap).find(([, path]) =>
    location.pathname.startsWith(path)
  )?.[0] ?? "quotations";

  const handleMenuClick = ({ key }: { key: string }) => {
    const path = pathMap[key];
    if (path) navigate(path);
  };

  const userMenu = {
    items: [
      { key: "logout", icon: <LogoutOutlined />, label: "Logout", danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === "logout") { logout(); navigate("/login"); }
    },
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        style={{ background: "#1a3a5c" }}
        width={220}
      >
        <div style={{ padding: "16px 20px", color: "white", fontWeight: 700, fontSize: collapsed ? 12 : 15, whiteSpace: "nowrap", overflow: "hidden" }}>
          {collapsed ? "CES" : "CES Sale Operation"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={["master", "sales-project", "admin"]}
          onClick={handleMenuClick}
          style={{ background: "#1a3a5c" }}
          items={navItems as never}
        />
      </Sider>
      <Layout>
        <Header style={{ background: "white", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f0f0" }}>
          <div
            style={{ cursor: "pointer", fontSize: 16, color: token.colorPrimary }}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar icon={<UserOutlined />} style={{ background: "#1a3a5c" }} />
              <Typography.Text>{user?.full_name}</Typography.Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: "16px", background: "white", padding: "20px", borderRadius: 8, minHeight: 600 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
