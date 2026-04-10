import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { CheckCircleOutlined, EditOutlined, FileTextOutlined, ReloadOutlined } from "@ant-design/icons";

import { boqPricingV2Api } from "../api";
import { formatTHB, numberInputFormatter, numberInputParser } from "../utils/currency";

export default function PricingSessionV2Page() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sessionId = Number(id);

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await boqPricingV2Api.getPricingSession(sessionId);
      setSession(res.data);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to load V2 pricing session");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [sessionId]);

  const openEditLine = (line: any) => {
    setEditingLine(line);
    form.setFieldsValue({
      description: line.description,
      quantity: Number(line.quantity || 0),
      unit: line.unit,
      list_price: Number(line.list_price || 0),
      discount_pct: Number(line.discount_pct || 0),
    });
    setLineModalOpen(true);
  };

  const saveLine = async () => {
    if (!editingLine) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await boqPricingV2Api.updatePricingLine(sessionId, editingLine.id, values);
      message.success("Pricing line updated");
      setLineModalOpen(false);
      setEditingLine(null);
      await load();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to update pricing line");
    } finally {
      setSaving(false);
    }
  };

  const finalizeSession = async () => {
    setFinalizing(true);
    try {
      await boqPricingV2Api.finalizePricingSession(sessionId);
      message.success("Pricing session finalized");
      await load();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to finalize pricing session");
    } finally {
      setFinalizing(false);
    }
  };

  const issueQuotation = async () => {
    setIssuing(true);
    try {
      const res = await boqPricingV2Api.createQuotationFromPricing(sessionId);
      message.success(`V2 quotation ${res.data.quotation_number} issued`);
      navigate(`/v2/quotations/${res.data.id}`);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to issue V2 quotation");
    } finally {
      setIssuing(false);
    }
  };

  if (!session && loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>V2 Pricing Session #{session?.id}</Typography.Title>
          <Typography.Text type="secondary">
            BOQ Revision #{session?.boq_revision_id} · Project #{session?.project_id}
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
          {session?.status === "draft" && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={finalizeSession} loading={finalizing}>
              Finalize Pricing
            </Button>
          )}
          {session?.status === "finalized" && (
            <Button type="primary" icon={<FileTextOutlined />} onClick={issueQuotation} loading={issuing}>
              Issue V2 Quotation
            </Button>
          )}
        </Space>
      </div>

      <Descriptions bordered size="small" column={4} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Status">
          <Tag color={session?.status === "finalized" ? "green" : "blue"}>{String(session?.status || "draft").toUpperCase()}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Currency">{session?.currency || "THB"}</Descriptions.Item>
        <Descriptions.Item label="VAT Rate">{session?.vat_rate}%</Descriptions.Item>
        <Descriptions.Item label="Created By">{session?.created_by || "-"}</Descriptions.Item>
      </Descriptions>

      <Card style={{ marginBottom: 16 }}>
        <Space size={24} wrap>
          <Statistic title="Subtotal" value={formatTHB(session?.totals?.subtotal || 0)} />
          <Statistic title={`VAT ${session?.totals?.vat_rate || 0}%`} value={formatTHB(session?.totals?.vat_amount || 0)} />
          <Statistic title="Grand Total" value={formatTHB(session?.totals?.grand_total || 0)} />
        </Space>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={session?.lines || []}
        size="small"
        scroll={{ x: 1200 }}
        columns={[
          { title: "Seq", dataIndex: "seq", width: 70 },
          { title: "Section", dataIndex: "section_label", width: 180, render: (v: string) => v || "-" },
          { title: "Item Code", dataIndex: "item_code", width: 160, render: (v: string) => v || "-" },
          { title: "Description", dataIndex: "description" },
          { title: "Brand", dataIndex: "brand", width: 140, render: (v: string) => v || "-" },
          { title: "Qty", dataIndex: "quantity", width: 90 },
          { title: "Unit", dataIndex: "unit", width: 90, render: (v: string) => v || "-" },
          { title: "List Price", dataIndex: "list_price", width: 140, align: "right" as const, render: (v: number) => formatTHB(v) },
          { title: "Disc%", dataIndex: "discount_pct", width: 90, align: "center" as const },
          { title: "Net Price", dataIndex: "net_price", width: 140, align: "right" as const, render: (v: number) => formatTHB(v) },
          { title: "Amount", dataIndex: "amount", width: 140, align: "right" as const, render: (v: number) => formatTHB(v) },
          {
            title: "",
            width: 90,
            render: (_: any, row: any) => (
              <Button
                size="small"
                icon={<EditOutlined />}
                disabled={session?.status !== "draft"}
                onClick={() => openEditLine(row)}
              />
            ),
          },
        ]}
      />

      <Modal
        open={lineModalOpen}
        title="Edit Pricing Line"
        onCancel={() => {
          setLineModalOpen(false);
          setEditingLine(null);
        }}
        onOk={saveLine}
        okText="Save"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="description" label="Description" rules={[{ required: true, message: "Please enter description" }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="quantity" label="Quantity" rules={[{ required: true, message: "Please enter quantity" }]}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="unit" label="Unit">
              <Input />
            </Form.Item>
            <Form.Item name="list_price" label="List Price" rules={[{ required: true, message: "Please enter list price" }]}>
              <InputNumber
                min={0}
                precision={2}
                style={{ width: "100%" }}
                formatter={numberInputFormatter}
                parser={(value) => numberInputParser(value as string)}
              />
            </Form.Item>
            <Form.Item name="discount_pct" label="Discount %" rules={[{ required: true, message: "Please enter discount" }]}>
              <InputNumber min={0} max={100} precision={2} style={{ width: "100%" }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}