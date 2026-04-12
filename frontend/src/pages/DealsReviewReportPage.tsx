import { useEffect, useState } from "react";
import { Alert, Card, Col, Row, Select, Statistic, Table, Tag, Typography } from "antd";
import { dealsApi, departmentsApi } from "../api";
import { useAuthStore } from "../store/authStore";
import { formatTHB } from "../utils/currency";

const RISK_COLORS: Record<string, string> = {
  low: "green",
  medium: "gold",
  high: "red",
};

export default function DealsReviewReportPage() {
  const user = useAuthStore((s) => s.user);
  const canFilterDepartment = ["admin", "manager", "sales_admin"].includes(user?.role || "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ value: number; label: string }>>([]);
  const [departmentIdsFilter, setDepartmentIdsFilter] = useState<number[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (canFilterDepartment && departmentOptions.length === 0) {
        const depRes = await departmentsApi.list();
        setDepartmentOptions(
          (depRes.data || [])
            .filter((dep: any) => dep.is_active)
            .map((dep: any) => ({ value: Number(dep.id), label: String(dep.name) }))
        );
      }
      const r = await dealsApi.reviewReportManager(
        departmentIdsFilter.length ? { department_ids: departmentIdsFilter } : undefined
      );
      setData(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load review report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [departmentIdsFilter]);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Deal Status Review & Report
      </Typography.Title>

      {canFilterDepartment && (
        <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "#64748b" }}>Departments</span>
          <Select
            mode="multiple"
            allowClear
            maxTagCount="responsive"
            placeholder="All departments"
            value={departmentIdsFilter}
            options={departmentOptions}
            onChange={(vals) => setDepartmentIdsFilter((vals || []).map((v) => Number(v)))}
            style={{ minWidth: 320 }}
          />
        </div>
      )}

      {error && <Alert type="warning" message={error} style={{ marginBottom: 12 }} />}

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card loading={loading}><Statistic title="Active Deals" value={data?.total_open_deals || 0} /></Card></Col>
        <Col xs={12} md={6}><Card loading={loading}><Statistic title="At Risk Deals" value={data?.total_at_risk_deals || 0} /></Card></Col>
        <Col xs={12} md={6}><Card loading={loading}><Statistic title="Overdue Tasks" value={data?.total_overdue_tasks || 0} /></Card></Col>
        <Col xs={12} md={6}><Card loading={loading}><Statistic title="Next 7 Days Actions" value={data?.upcoming_7d_actions || 0} /></Card></Col>
      </Row>

      <Card title="At-Risk Pipeline by Deal" style={{ marginTop: 12 }} loading={loading}>
        <Table
          rowKey="deal_id"
          size="small"
          dataSource={data?.deals || []}
          columns={[
            { title: "Deal", dataIndex: "title", width: 280 },
            { title: "Owner", dataIndex: "owner_name", width: 140 },
            { title: "Customer", dataIndex: "customer_name", width: 170 },
            { title: "CES Stage", dataIndex: "stage", width: 120, render: (v: string) => <Tag>{(v || "").toUpperCase()}</Tag> },
            {
              title: "Risk",
              dataIndex: "risk_level",
              width: 100,
              render: (v: string) => <Tag color={RISK_COLORS[v] || "default"}>{(v || "").toUpperCase()}</Tag>,
            },
            { title: "Stale (days)", dataIndex: "stale_days", width: 110 },
            { title: "Overdue Tasks", dataIndex: "overdue_tasks", width: 120 },
            { title: "Next Action Date", dataIndex: "next_action_date", width: 130 },
            {
              title: "Expected Value (THB)",
              dataIndex: "expected_value",
              width: 150,
              render: (v: number) => formatTHB(v),
            },
          ]}
          pagination={{ pageSize: 12 }}
        />
      </Card>

      <Card title="Owner Risk Summary" style={{ marginTop: 12 }} loading={loading}>
        <Table
          rowKey="owner_id"
          size="small"
          pagination={false}
          dataSource={data?.owner_summary || []}
          columns={[
            { title: "Sales", dataIndex: "owner_name" },
            { title: "Active Deals", dataIndex: "total_open_deals", width: 90 },
            { title: "At Risk", dataIndex: "at_risk_deals", width: 90 },
            { title: "Overdue Tasks", dataIndex: "overdue_tasks", width: 110 },
            { title: "Next 7D Actions", dataIndex: "upcoming_7d_actions", width: 120 },
            {
              title: "Pipeline (THB)",
              dataIndex: "pipeline_amount",
              render: (v: number) => formatTHB(v),
            },
          ]}
        />
      </Card>
    </div>
  );
}
