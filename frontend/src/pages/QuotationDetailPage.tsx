import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Descriptions, Table, Button, Modal, Form, Input, InputNumber, Select,
  Tag, Space, Typography, Divider, Statistic, Row, Col, Popconfirm, message, Tabs,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, SendOutlined, FilePdfOutlined,
  EditOutlined, CheckCircleOutlined, SafetyOutlined,
} from "@ant-design/icons";
import { quotationsApi, projectsApi, customersApi, productsApi, usersApi } from "../api";

const STATUS_COLORS: Record<string, string> = {
  draft: "default", issued: "blue", accepted: "green", rejected: "red", cancelled: "orange",
};

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qtId = parseInt(id!);
  const navigate = useNavigate();

  const [qt, setQt] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [headerModal, setHeaderModal] = useState(false);
  const [lineModal, setLineModal] = useState(false);
  const [sectionModal, setSectionModal] = useState(false);
  const [editLine, setEditLine] = useState<any>(null);

  const [headerForm] = Form.useForm();
  const [lineForm] = Form.useForm();
  const [secForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    const [qRes, pRes, uRes] = await Promise.all([
      quotationsApi.get(qtId),
      productsApi.list(),
      usersApi.list(),
    ]);
    setQt(qRes.data);
    setProducts(pRes.data);
    setUsers(uRes.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [qtId]);

  const saveHeader = async () => {
    const v = await headerForm.validateFields();
    await quotationsApi.update(qtId, v);
    message.success("Header updated");
    setHeaderModal(false);
    load();
  };

  const openEditHeader = () => {
    headerForm.setFieldsValue({
      subject: qt.subject,
      contact_id: qt.contact_id,
      sales_owner_id: qt.sales_owner_id,
      delivery_terms: qt.delivery_terms,
      validity_days: qt.validity_days,
      validity_text: qt.validity_text,
      payment_terms: qt.payment_terms,
      scope_of_work: qt.scope_of_work,
      warranty_text: qt.warranty_text,
      exclusions: qt.exclusions,
      vat_rate: qt.vat_rate,
    });
    setHeaderModal(true);
  };

  const addSection = async () => {
    const v = await secForm.validateFields();
    await quotationsApi.addSection(qtId, { ...v, sort_order: (qt.sections?.length || 0) });
    message.success("Section added");
    setSectionModal(false);
    secForm.resetFields();
    load();
  };

  const openAddLine = (line?: any) => {
    setEditLine(line || null);
    if (line) {
      lineForm.setFieldsValue(line);
    } else {
      lineForm.resetFields();
      lineForm.setFieldsValue({ quantity: 1, discount_pct: 0, list_price: 0, seq: (qt.lines?.length || 0) + 1 });
    }
    setLineModal(true);
  };

  const onProductSelect = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      lineForm.setFieldsValue({
        item_code: product.item_code,
        description: product.description,
        brand: product.brand_name,
        list_price: parseFloat(product.list_price),
      });
      recalcLine();
    }
  };

  const recalcLine = () => {
    const vals = lineForm.getFieldsValue();
    const listPrice = parseFloat(vals.list_price || 0);
    const discPct = parseFloat(vals.discount_pct || 0);
    const qty = parseFloat(vals.quantity || 1);
    const net = listPrice * (1 - discPct / 100);
    lineForm.setFieldsValue({
      net_price: parseFloat(net.toFixed(2)),
      amount: parseFloat((net * qty).toFixed(2)),
    });
  };

  const saveLine = async () => {
    const v = await lineForm.validateFields();
    if (editLine) {
      await quotationsApi.updateLine(qtId, editLine.id, v);
      message.success("Line updated");
    } else {
      await quotationsApi.addLine(qtId, v);
      message.success("Line added");
    }
    setLineModal(false);
    load();
  };

  const deleteLine = async (lid: number) => {
    await quotationsApi.deleteLine(qtId, lid);
    message.success("Line deleted");
    load();
  };

  const issueQuotation = async () => {
    await quotationsApi.issue(qtId);
    message.success("Quotation issued! PDF is being generated.");
    load();
  };

  if (loading || !qt) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  const sectionOptions = qt.sections?.map((s: any) => ({ value: s.id, label: s.label || `Section ${s.id}` })) || [];
  const contacts = qt.project?.contacts || [];

  const lineColumns = [
    { title: "#", dataIndex: "seq", width: 45, align: "center" as const },
    { title: "Section", dataIndex: "section_id", width: 120, render: (sid: number) => sectionOptions.find((s: any) => s.value === sid)?.label || "—" },
    { title: "Item Code", dataIndex: "item_code", width: 120 },
    { title: "Description", dataIndex: "description", ellipsis: true },
    { title: "Brand", dataIndex: "brand", width: 90 },
    { title: "List Price", dataIndex: "list_price", width: 100, align: "right" as const, render: (v: any) => parseFloat(v).toLocaleString("th-TH", { minimumFractionDigits: 2 }) },
    { title: "Disc%", dataIndex: "discount_pct", width: 65, align: "center" as const, render: (v: any) => parseFloat(v) > 0 ? `${v}%` : "—" },
    { title: "Net Price", dataIndex: "net_price", width: 100, align: "right" as const, render: (v: any) => parseFloat(v).toLocaleString("th-TH", { minimumFractionDigits: 2 }) },
    { title: "Qty", dataIndex: "quantity", width: 55, align: "center" as const },
    { title: "Amount", dataIndex: "amount", width: 110, align: "right" as const, render: (v: any) => parseFloat(v).toLocaleString("th-TH", { minimumFractionDigits: 2 }) },
    {
      title: "", width: 80, render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openAddLine(r)} />
          <Popconfirm title="Delete line?" onConfirm={() => deleteLine(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {qt.quotation_number} <Tag color={STATUS_COLORS[qt.status]}>{qt.status.toUpperCase()}</Tag>
            {qt.current_revision > 0 && <Tag color="purple">Rev.{qt.current_revision}</Tag>}
          </Typography.Title>
          <Typography.Text type="secondary">{qt.customer_name} — {qt.project_name}</Typography.Text>
        </div>
        <Space>
          {qt.status === "draft" && (
            <>
              <Button icon={<PlusOutlined />} onClick={() => { secForm.resetFields(); setSectionModal(true); }}>Add Section</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddLine()}>Add Line</Button>
              <Popconfirm title="Issue this quotation and generate PDF?" onConfirm={issueQuotation}>
                <Button type="primary" icon={<SendOutlined />} style={{ background: "#1a3a5c" }}>Issue Quotation</Button>
              </Popconfirm>
            </>
          )}
          <Button icon={<SafetyOutlined />} onClick={() => navigate(`/quotations/${qtId}/material-approval`)}>Material Approval</Button>
          <Button icon={<EditOutlined />} onClick={openEditHeader}>Edit Terms</Button>
        </Space>
      </div>

      <Tabs
        items={[
          {
            key: "lines",
            label: "Line Items",
            children: (
              <>
                {/* Totals summary */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col><Statistic title="Subtotal (THB)" value={parseFloat(qt.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })} /></Col>
                  <Col><Statistic title={`VAT ${qt.vat_rate}%`} value={parseFloat(qt.vat_amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} /></Col>
                  <Col><Statistic title="Grand Total (THB)" value={parseFloat(qt.grand_total).toLocaleString("th-TH", { minimumFractionDigits: 2 })} valueStyle={{ color: "#1a3a5c", fontWeight: "bold" }} /></Col>
                </Row>
                <Table
                  dataSource={qt.lines} columns={lineColumns} rowKey="id" size="small"
                  scroll={{ x: 1000 }} pagination={false}
                />
              </>
            ),
          },
          {
            key: "terms",
            label: "Commercial Terms",
            children: (
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Subject" span={2}>{qt.subject || "—"}</Descriptions.Item>
                <Descriptions.Item label="Attention">{qt.contact_name || "—"}</Descriptions.Item>
                <Descriptions.Item label="Sales Owner">{qt.sales_owner_name || "—"}</Descriptions.Item>
                <Descriptions.Item label="Delivery">{qt.delivery_terms || "—"}</Descriptions.Item>
                <Descriptions.Item label="Validity">{qt.validity_days} days {qt.validity_text ? `— ${qt.validity_text}` : ""}</Descriptions.Item>
                <Descriptions.Item label="Payment Terms" span={2}>{qt.payment_terms || "—"}</Descriptions.Item>
                <Descriptions.Item label="Scope of Work" span={2}><pre style={{ margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap" }}>{qt.scope_of_work || "—"}</pre></Descriptions.Item>
                <Descriptions.Item label="Warranty" span={2}><pre style={{ margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap" }}>{qt.warranty_text || "—"}</pre></Descriptions.Item>
                <Descriptions.Item label="Exclusions / Remarks" span={2}><pre style={{ margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap" }}>{qt.exclusions || "—"}</pre></Descriptions.Item>
              </Descriptions>
            ),
          },
          {
            key: "revisions",
            label: "Revision History",
            children: (
              <Table
                dataSource={qt.revisions} rowKey="id" size="small" pagination={false}
                columns={[
                  { title: "Revision", dataIndex: "revision_number", width: 80 },
                  { title: "Issued At", dataIndex: "issued_at", width: 180, render: (v: string) => new Date(v).toLocaleString() },
                  {
                    title: "PDF", dataIndex: "pdf_path", render: (_: any, r: any) => r.pdf_path ? (
                      <a href={quotationsApi.revisionPdfUrl(qtId, r.revision_number)} target="_blank" rel="noreferrer">
                        <Button size="small" icon={<FilePdfOutlined />}>Download</Button>
                      </a>
                    ) : "Generating…",
                  },
                ]}
              />
            ),
          },
        ]}
      />

      {/* Header Edit Modal */}
      <Modal open={headerModal} title="Edit Quotation Terms" onOk={saveHeader} onCancel={() => setHeaderModal(false)} width={700} okText="Save">
        <Form form={headerForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="subject" label="Subject"><Input /></Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="sales_owner_id" label="Sales Owner">
              <Select options={users.map((u: any) => ({ value: u.id, label: u.full_name }))} allowClear />
            </Form.Item>
            <Form.Item name="vat_rate" label="VAT Rate (%)"><InputNumber style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="validity_days" label="Validity (days)"><InputNumber style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="delivery_terms" label="Delivery Terms"><Input /></Form.Item>
          </div>
          <Form.Item name="validity_text" label="Validity Note"><Input /></Form.Item>
          <Form.Item name="payment_terms" label="Payment Terms"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="scope_of_work" label="Scope of Work"><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="warranty_text" label="Warranty"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="exclusions" label="Exclusions / Remarks"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      {/* Section Modal */}
      <Modal open={sectionModal} title="Add Section" onOk={addSection} onCancel={() => setSectionModal(false)} okText="Add">
        <Form form={secForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="label" label="Section Label" rules={[{ required: true }]}><Input placeholder="e.g. Zone A – MDB Panel" /></Form.Item>
        </Form>
      </Modal>

      {/* Line Modal */}
      <Modal open={lineModal} title={editLine ? "Edit Line" : "Add Line Item"} onOk={saveLine} onCancel={() => setLineModal(false)} width={680} okText="Save">
        <Form form={lineForm} layout="vertical" style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="section_id" label="Section">
              <Select options={sectionOptions} allowClear placeholder="No section" />
            </Form.Item>
            <Form.Item name="seq" label="Line #" rules={[{ required: true }]}>
              <InputNumber style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="product_id" label="Product (search to auto-fill)">
            <Select
              showSearch
              optionFilterProp="label"
              options={products.map((p) => ({ value: p.id, label: `${p.item_code} — ${p.description}` }))}
              allowClear
              onChange={onProductSelect}
              placeholder="Type to search product..."
            />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="item_code" label="Item Code"><Input /></Form.Item>
            <Form.Item name="brand" label="Brand"><Input /></Form.Item>
          </div>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0 12px" }}>
            <Form.Item name="list_price" label="List Price"><InputNumber style={{ width: "100%" }} min={0} precision={2} onChange={recalcLine} /></Form.Item>
            <Form.Item name="discount_pct" label="Disc%"><InputNumber style={{ width: "100%" }} min={0} max={100} precision={2} onChange={recalcLine} /></Form.Item>
            <Form.Item name="net_price" label="Net Price"><InputNumber style={{ width: "100%" }} min={0} precision={2} onChange={recalcLine} /></Form.Item>
            <Form.Item name="quantity" label="Qty"><InputNumber style={{ width: "100%" }} min={0.001} precision={3} onChange={recalcLine} /></Form.Item>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="unit" label="Unit"><Input placeholder="EA, SET, LOT..." /></Form.Item>
            <Form.Item name="amount" label="Amount"><InputNumber style={{ width: "100%" }} precision={2} disabled /></Form.Item>
          </div>
          <Form.Item name="remark" label="Remark"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
