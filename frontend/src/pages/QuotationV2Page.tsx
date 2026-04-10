import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, Descriptions, Space, Statistic, Table, Tag, Typography, message } from "antd";

import { boqPricingV2Api } from "../api";
import { formatTHB } from "../utils/currency";

export default function QuotationV2Page() {
  const { id } = useParams<{ id: string }>();
  const quotationId = Number(id);

  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await boqPricingV2Api.getQuotation(quotationId);
      setQuotation(res.data);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to load V2 quotation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [quotationId]);

  const snapshot = quotation?.snapshots?.[quotation.snapshots.length - 1]?.snapshot_json;
  const lines = snapshot?.lines || [];

  if (!quotation && loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {quotation?.quotation_number || `V2 Quotation #${quotationId}`} <Tag color="blue">{String(quotation?.status || "issued").toUpperCase()}</Tag>
        </Typography.Title>
        <Typography.Text type="secondary">Pricing Session #{quotation?.pricing_session_id} · Project #{quotation?.project_id}</Typography.Text>
      </div>

      <Descriptions bordered size="small" column={4} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Revision">{quotation?.revision_no || 1}</Descriptions.Item>
        <Descriptions.Item label="Created By">{quotation?.created_by || "-"}</Descriptions.Item>
        <Descriptions.Item label="Created At">{quotation?.created_at ? new Date(quotation.created_at).toLocaleString("th-TH") : "-"}</Descriptions.Item>
        <Descriptions.Item label="Snapshots">{quotation?.snapshots?.length || 0}</Descriptions.Item>
      </Descriptions>

      <Card style={{ marginBottom: 16 }}>
        <Space size={24} wrap>
          <Statistic title="Subtotal" value={formatTHB(quotation?.subtotal || 0)} />
          <Statistic title={`VAT ${quotation?.vat_rate || 0}%`} value={formatTHB(quotation?.vat_amount || 0)} />
          <Statistic title="Grand Total" value={formatTHB(quotation?.grand_total || 0)} />
        </Space>
      </Card>

      <Card title="Issued Snapshot">
        <Table
          rowKey={(row: any) => row.id}
          loading={loading}
          dataSource={lines}
          size="small"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "Seq", dataIndex: "seq", width: 70 },
            { title: "Section", dataIndex: "section_label", width: 180, render: (v: string) => v || "-" },
            { title: "Item Code", dataIndex: "item_code", width: 150, render: (v: string) => v || "-" },
            { title: "Description", dataIndex: "description" },
            { title: "Brand", dataIndex: "brand", width: 140, render: (v: string) => v || "-" },
            { title: "Qty", dataIndex: "quantity", width: 90 },
            { title: "Unit", dataIndex: "unit", width: 90, render: (v: string) => v || "-" },
            { title: "List Price", dataIndex: "list_price", width: 140, align: "right" as const, render: (v: number) => formatTHB(v) },
            { title: "Disc%", dataIndex: "discount_pct", width: 90, align: "center" as const },
            { title: "Net Price", dataIndex: "net_price", width: 140, align: "right" as const, render: (v: number) => formatTHB(v) },
            { title: "Amount", dataIndex: "amount", width: 140, align: "right" as const, render: (v: number) => formatTHB(v) },
          ]}
        />
      </Card>
    </div>
  );
}