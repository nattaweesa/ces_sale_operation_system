import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { FileTextOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";

import { boqPricingV2Api } from "../api";
import { formatTHB } from "../utils/currency";

const { Title } = Typography;

const STATUS_COLORS: Record<string, string> = {
  draft: "orange",
  finalized: "blue",
  issued: "green",
  cancelled: "red",
};

export default function V2OverviewPage() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingQuotations, setLoadingQuotations] = useState(false);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await boqPricingV2Api.listPricingSessions();
      setSessions(res.data);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "Unable to load pricing sessions");
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadQuotations = async () => {
    setLoadingQuotations(true);
    try {
      const res = await boqPricingV2Api.listQuotations();
      setQuotations(res.data);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "Unable to load V2 quotations");
    } finally {
      setLoadingQuotations(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadQuotations();
  }, []);

  const sessionColumns = [
    { title: "Session ID", dataIndex: "id", key: "id", width: 100 },
    { title: "Project ID", dataIndex: "project_id", key: "project_id", width: 110 },
    { title: "BOQ Rev", dataIndex: "boq_revision_id", key: "boq_revision_id", width: 100 },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: string) => <Tag color={STATUS_COLORS[v] ?? "default"}>{v}</Tag>,
    },
    { title: "Currency", dataIndex: "currency", key: "currency", width: 90 },
    {
      title: "Subtotal",
      key: "subtotal",
      width: 140,
      render: (_: any, row: any) => formatTHB(row.totals?.subtotal ?? 0),
    },
    {
      title: "Grand Total",
      key: "grand_total",
      width: 140,
      render: (_: any, row: any) => formatTHB(row.totals?.grand_total ?? 0),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 130,
      render: (v: string) => v ? new Date(v).toLocaleDateString("th-TH") : "-",
    },
    {
      title: "Action",
      key: "action",
      width: 90,
      render: (_: any, row: any) => (
        <Button
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => navigate(`/v2/pricing-sessions/${row.id}`)}
        >
          Open
        </Button>
      ),
    },
  ];

  const quotationColumns = [
    { title: "Quotation No.", dataIndex: "quotation_number", key: "quotation_number", width: 170 },
    { title: "Project ID", dataIndex: "project_id", key: "project_id", width: 110 },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: string) => <Tag color={STATUS_COLORS[v] ?? "default"}>{v}</Tag>,
    },
    { title: "Rev", dataIndex: "revision_no", key: "revision_no", width: 60 },
    {
      title: "Subtotal",
      dataIndex: "subtotal",
      key: "subtotal",
      width: 140,
      render: (v: number) => formatTHB(v),
    },
    {
      title: "Grand Total",
      dataIndex: "grand_total",
      key: "grand_total",
      width: 140,
      render: (v: number) => formatTHB(v),
    },
    {
      title: "Issued",
      dataIndex: "created_at",
      key: "created_at",
      width: 130,
      render: (v: string) => v ? new Date(v).toLocaleDateString("th-TH") : "-",
    },
    {
      title: "Action",
      key: "action",
      width: 90,
      render: (_: any, row: any) => (
        <Button
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => navigate(`/v2/quotations/${row.id}`)}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 24 }} align="center">
        <Title level={3} style={{ margin: 0 }}>
          V2 Pricing &amp; Quotations
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => { loadSessions(); loadQuotations(); }}
        >
          Refresh
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/boqs")}
        >
          Start from BOQ
        </Button>
      </Space>

      <Card>
        <Tabs
          defaultActiveKey="sessions"
          items={[
            {
              key: "sessions",
              label: `Pricing Sessions (${sessions.length})`,
              children: (
                <Table
                  rowKey="id"
                  columns={sessionColumns}
                  dataSource={sessions}
                  loading={loadingSessions}
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 900 }}
                  size="small"
                />
              ),
            },
            {
              key: "quotations",
              label: `V2 Quotations (${quotations.length})`,
              children: (
                <Table
                  rowKey="id"
                  columns={quotationColumns}
                  dataSource={quotations}
                  loading={loadingQuotations}
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 900 }}
                  size="small"
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
