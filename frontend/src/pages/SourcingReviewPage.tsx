import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { CheckOutlined, ReloadOutlined, PlayCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { brandsApi, categoriesApi, productsApi, sourcingApi } from "../api";

export default function SourcingReviewPage() {
  const [loading, setLoading] = useState(false);
  const [runningBackfill, setRunningBackfill] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);

  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);

  const [confirmForm] = Form.useForm();
  const [createForm] = Form.useForm();

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: `${p.item_code} — ${p.description}` })),
    [products]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statsRes, queueRes, productsRes, brandsRes, categoriesRes] = await Promise.all([
        sourcingApi.stats(),
        sourcingApi.reviewQueue({ limit: 300 }),
        productsApi.list(),
        brandsApi.list(),
        categoriesApi.list(),
      ]);
      setStats(statsRes.data);
      setQueue(queueRes.data || []);
      setProducts(productsRes.data || []);
      setBrands(brandsRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch {
      message.error("Unable to load sourcing review data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const runBackfill = async () => {
    setRunningBackfill(true);
    try {
      const res = await sourcingApi.backfill();
      const s = res.data?.stats || {};
      message.success(`Backfill completed: ${s.lines_created || 0} new lines`);
      await loadAll();
    } catch {
      message.error("Backfill failed. Please try again.");
    } finally {
      setRunningBackfill(false);
    }
  };

  const openConfirmModal = (row: any) => {
    setSelectedReview(row);
    confirmForm.setFieldsValue({
      product_id: row.suggested_product_id || undefined,
      note: "",
    });
    setConfirmModalOpen(true);
  };

  const submitConfirm = async () => {
    if (!selectedReview) return;
    const values = await confirmForm.validateFields();
    try {
      await sourcingApi.confirmMatch(selectedReview.review_id, values.product_id, values.note);
      message.success("Line matched successfully");
      setConfirmModalOpen(false);
      setSelectedReview(null);
      await loadAll();
    } catch {
      message.error("Unable to confirm match. Please try again.");
    }
  };

  const openCreateProductModal = (row: any) => {
    setSelectedReview(row);
    const guessedCode = row.item_code || `SRC-${row.line_item_id}`;
    createForm.setFieldsValue({
      item_code: guessedCode,
      description: row.description,
      list_price: undefined,
      currency: "THB",
      status: "active",
      moq: 1,
      lead_time_days: undefined,
      brand_id: undefined,
      category_id: undefined,
      remark: "",
      note: "",
    });
    setCreateModalOpen(true);
  };

  const submitCreateProduct = async () => {
    if (!selectedReview) return;
    const values = await createForm.validateFields();
    try {
      await sourcingApi.createProductFromReview(selectedReview.review_id, values);
      message.success("Product created and line confirmed");
      setCreateModalOpen(false);
      setSelectedReview(null);
      await loadAll();
    } catch {
      message.error("Unable to create product from line. Please try again.");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Sourcing Review Queue
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
          <Button icon={<PlayCircleOutlined />} loading={runningBackfill} onClick={runBackfill}>
            Run Backfill
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><Card><Statistic title="Source Documents" value={stats?.source_documents || 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Staged Lines" value={stats?.staged_lines || 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Pending Reviews" value={stats?.pending_reviews || 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Auto Matched" value={stats?.auto_matched || 0} /></Card></Col>
      </Row>

      <Table
        loading={loading}
        dataSource={queue}
        rowKey="review_id"
        size="small"
        scroll={{ x: 1300 }}
        columns={[
          { title: "Doc", dataIndex: "document_number", width: 160 },
          {
            title: "Type",
            dataIndex: "document_type",
            width: 90,
            render: (v: string) => <Tag color={v === "quotation" ? "blue" : "gold"}>{String(v || "").toUpperCase()}</Tag>,
          },
          { title: "Line #", dataIndex: "line_item_id", width: 80 },
          { title: "Item Code", dataIndex: "item_code", width: 140 },
          { title: "Description", dataIndex: "description", ellipsis: true },
          { title: "Qty", dataIndex: "quantity", width: 90 },
          { title: "Unit", dataIndex: "unit", width: 90 },
          { title: "Confidence", dataIndex: "confidence", width: 110, render: (v: string) => `${v || "0"}%` },
          { title: "Reason", dataIndex: "reason", width: 220 },
          {
            title: "Action",
            width: 260,
            fixed: "right",
            render: (_: any, row: any) => (
              <Space>
                <Button size="small" icon={<CheckOutlined />} onClick={() => openConfirmModal(row)}>
                  Confirm
                </Button>
                <Button size="small" icon={<PlusOutlined />} onClick={() => openCreateProductModal(row)}>
                  Create Product
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={confirmModalOpen}
        title="Confirm Product Match"
        onCancel={() => setConfirmModalOpen(false)}
        onOk={submitConfirm}
        okText="Confirm"
      >
        <Form form={confirmForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="product_id" label="Product" rules={[{ required: true, message: "Please choose product" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={productOptions}
              placeholder="Search item code or description"
            />
          </Form.Item>
          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={createModalOpen}
        title="Create Product from Line"
        onCancel={() => setCreateModalOpen(false)}
        onOk={submitCreateProduct}
        okText="Create & Confirm"
        width={700}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="item_code" label="Item Code" rules={[{ required: true }]}> 
              <Input />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select options={[{ value: "active", label: "Active" }, { value: "on_request", label: "On Request" }, { value: "obsolete", label: "Obsolete" }]} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="brand_id" label="Brand">
              <Select allowClear options={brands.map((b) => ({ value: b.id, label: b.name }))} />
            </Form.Item>
            <Form.Item name="category_id" label="Category">
              <Select allowClear options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            </Form.Item>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="list_price" label="List Price (THB)">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="moq" label="MOQ">
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="lead_time_days" label="Lead Time (days)">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="remark" label="Remark">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="note" label="Review Note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
