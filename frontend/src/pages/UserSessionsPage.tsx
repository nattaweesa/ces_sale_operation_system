import { useEffect, useState } from "react";
import {
  Table, Tag, Tooltip, Button, Typography, Spin, Timeline, Badge,
} from "antd";
import { ReloadOutlined, UserOutlined } from "@ant-design/icons";
import { adminActivityApi } from "../api";

const { Text } = Typography;

// ── Types ────────────────────────────────────────────────────────────────────

interface ActivityLog {
  id: number;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  resource_label: string | null;
  ip_address: string | null;
  created_at: string;
}

interface UserSession {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  is_likely_online: boolean;
  activity_today: number;
  activity_7d: number;
  last_activity: ActivityLog | null;
}

interface UserActivityPage {
  user_id: number;
  username: string;
  full_name: string;
  total: number;
  activities: ActivityLog[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin: "red", manager: "blue", sales_admin: "purple",
  sales: "green", sale_upload: "orange",
};

const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  "deal.create": "Deal Created",
  "deal.stage_change": "Stage Changed",
  "quotation.create": "Quotation Created",
  "quotation.issue": "Quotation Issued",
  "boq.create": "BOQ Created",
  "product.create": "Product Created",
  "product.update": "Product Updated",
  "product.delete": "Product Deleted",
};

const ACTION_COLORS: Record<string, string> = {
  login: "geekblue",
  "deal.create": "green",
  "deal.stage_change": "lime",
  "quotation.create": "cyan",
  "quotation.issue": "gold",
  "boq.create": "blue",
  "product.create": "purple",
  "product.update": "magenta",
  "product.delete": "red",
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtDatetime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("th-TH", {
    year: "2-digit", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function UserSessionsPage() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [activityData, setActivityData] = useState<Record<number, UserActivityPage>>({});
  const [activityLoading, setActivityLoading] = useState<Record<number, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminActivityApi.userSessions();
      setSessions(r.data);
      // Reset expanded data when refreshing
      setActivityData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadUserActivity = async (userId: number) => {
    if (activityData[userId]) return;
    setActivityLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      const r = await adminActivityApi.getUserActivity(userId, 30);
      setActivityData((prev) => ({ ...prev, [userId]: r.data }));
    } finally {
      setActivityLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // ── Stats
  const onlineCount = sessions.filter((s) => s.is_likely_online).length;
  const todayActive = sessions.filter((s) => s.activity_today > 0).length;

  // ── Expanded row: activity timeline
  const expandedRowRender = (record: UserSession) => {
    const data = activityData[record.id];
    const isLoading = activityLoading[record.id];

    return (
      <div style={{ padding: "8px 32px 16px" }}>
        {isLoading ? (
          <Spin size="small" />
        ) : !data || data.activities.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>ไม่มี activity ที่บันทึกไว้</Text>
        ) : (
          <>
            <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 8 }}>
              แสดง 30 รายการล่าสุด จากทั้งหมด {data.total} รายการ
            </Text>
            <Timeline
              style={{ maxHeight: 320, overflowY: "auto", paddingRight: 8 }}
              items={data.activities.map((a) => ({
                key: a.id,
                color: ACTION_COLORS[a.action] ?? "gray",
                children: (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <Tag
                      color={ACTION_COLORS[a.action] ?? "default"}
                      style={{ fontSize: 11, lineHeight: "18px", margin: 0 }}
                    >
                      {ACTION_LABELS[a.action] ?? a.action}
                    </Tag>
                    {a.resource_label && (
                      <Text style={{ fontSize: 12 }}>{a.resource_label}</Text>
                    )}
                    <Tooltip title={fmtDatetime(a.created_at)}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{timeAgo(a.created_at)}</Text>
                    </Tooltip>
                    {a.ip_address && (
                      <Text type="secondary" style={{ fontSize: 11 }}>· {a.ip_address}</Text>
                    )}
                  </div>
                ),
              }))}
            />
          </>
        )}
      </div>
    );
  };

  const columns = [
    {
      title: "User",
      key: "user",
      render: (_: unknown, r: UserSession) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: r.is_likely_online ? "#52c41a" : "#bfbfbf",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 12, fontWeight: 700,
            }}
          >
            {initials(r.full_name)}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.full_name}</div>
            <div style={{ fontSize: 11, color: "#888" }}>@{r.username}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      render: (v: string) => <Tag color={ROLE_COLORS[v]}>{v.toUpperCase()}</Tag>,
    },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, r: UserSession) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {!r.is_active && <Tag color="default" style={{ fontSize: 11 }}>Inactive</Tag>}
          {r.is_likely_online ? (
            <Badge status="success" text={<Text style={{ fontSize: 12 }}>Likely online</Text>} />
          ) : (
            <Badge status="default" text={<Text type="secondary" style={{ fontSize: 12 }}>Offline</Text>} />
          )}
        </div>
      ),
    },
    {
      title: "Last Login",
      key: "last_login",
      render: (_: unknown, r: UserSession) =>
        r.last_login_at ? (
          <Tooltip title={fmtDatetime(r.last_login_at)}>
            <Text style={{ fontSize: 13 }}>{timeAgo(r.last_login_at)}</Text>
          </Tooltip>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>ยังไม่เคย login</Text>
        ),
    },
    {
      title: "Activity",
      key: "activity",
      render: (_: unknown, r: UserSession) => (
        <div style={{ display: "flex", gap: 12 }}>
          <Tooltip title="วันนี้">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: r.activity_today > 0 ? "#1677ff" : "#bfbfbf" }}>
                {r.activity_today}
              </div>
              <div style={{ fontSize: 10, color: "#888" }}>Today</div>
            </div>
          </Tooltip>
          <Tooltip title="7 วันที่ผ่านมา">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: r.activity_7d > 0 ? "#722ed1" : "#bfbfbf" }}>
                {r.activity_7d}
              </div>
              <div style={{ fontSize: 10, color: "#888" }}>7d</div>
            </div>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "Last Activity",
      key: "last_act",
      render: (_: unknown, r: UserSession) =>
        r.last_activity ? (
          <Tooltip title={fmtDatetime(r.last_activity.created_at)}>
            <Tag color={ACTION_COLORS[r.last_activity.action] ?? "default"} style={{ fontSize: 11 }}>
              {ACTION_LABELS[r.last_activity.action] ?? r.last_activity.action}
            </Tag>
          </Tooltip>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <UserOutlined style={{ marginRight: 8 }} />
          User Sessions &amp; Activity
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Users ทั้งหมด", value: sessions.length, color: "#1677ff" },
          { label: "Likely Online ตอนนี้", value: onlineCount, color: "#52c41a" },
          { label: "Active วันนี้", value: todayActive, color: "#722ed1" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8,
              padding: "12px 24px", minWidth: 140,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <Table
        dataSource={sessions}
        rowKey="id"
        loading={loading}
        size="small"
        columns={columns}
        expandable={{
          expandedRowRender,
          onExpand: (expanded, record) => {
            if (expanded) loadUserActivity(record.id);
          },
          rowExpandable: () => true,
        }}
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />
    </div>
  );
}
