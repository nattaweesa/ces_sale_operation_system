import { useEffect, useState } from "react";
import { Card, Col, Progress, Row, Statistic, Table, Tag, Typography } from "antd";
import { dealsApi } from "../api";
import { useAuthStore } from "../store/authStore";

export default function DealsDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isManager = ["admin", "manager", "sales_admin"].includes(user?.role || "");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = isManager ? await dealsApi.dashboardManager() : await dealsApi.dashboardMy();
      setData(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isManager]);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Sale Project Dashboard {isManager ? "(Manager View)" : "(My View)"}
      </Typography.Title>

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card loading={loading}><Statistic title="Total Deals" value={data?.total_deals || 0} /></Card></Col>
        <Col xs={12} md={6}><Card loading={loading}><Statistic title="Open Deals" value={data?.open_deals || 0} /></Card></Col>
        <Col xs={12} md={6}><Card loading={loading}><Statistic title="Won Deals" value={data?.won_deals || 0} /></Card></Col>
        <Col xs={12} md={6}><Card loading={loading}><Statistic title="Pipeline" value={Number(data?.pipeline_amount || 0)} precision={2} /></Card></Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 8 }}>
        <Col xs={24} md={8}><Card loading={loading}><Statistic title="Overdue Tasks" value={data?.overdue_tasks || 0} /></Card></Col>
        <Col xs={24} md={8}><Card loading={loading}><Statistic title="Today Tasks" value={data?.today_tasks || 0} /></Card></Col>
        <Col xs={24} md={8}><Card loading={loading}><Statistic title="Upcoming Tasks" value={data?.upcoming_tasks || 0} /></Card></Col>
      </Row>

      <Card title="Deal Funnel" style={{ marginTop: 12 }} loading={loading}>
        {(data?.funnel || []).length === 0 ? (
          <Typography.Text type="secondary">No deals yet</Typography.Text>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {(data?.funnel || []).map((row: any) => {
              const pct = data?.total_deals ? Math.round((row.count / data.total_deals) * 100) : 0;
              return (
                <div key={row.stage}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span><Tag>{row.stage.toUpperCase()}</Tag></span>
                    <span>{row.count} deals | {Number(row.amount || 0).toLocaleString()}</span>
                  </div>
                  <Progress percent={pct} showInfo={false} strokeColor="#1a3a5c" />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {isManager && (
        <Card title="Team Summary" style={{ marginTop: 12 }} loading={loading}>
          <Table
            rowKey="owner_id"
            size="small"
            pagination={false}
            dataSource={data?.owner_summary || []}
            columns={[
              { title: "Sales", dataIndex: "owner_name" },
              { title: "Total", dataIndex: "total_deals", width: 80 },
              { title: "Open", dataIndex: "open_deals", width: 80 },
              { title: "Won", dataIndex: "won_deals", width: 80 },
              { title: "Lost", dataIndex: "lost_deals", width: 80 },
              { title: "Pipeline", dataIndex: "pipeline_amount", render: (v: number) => Number(v || 0).toLocaleString() },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
