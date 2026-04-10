import { useEffect, useState } from "react";
import {
  Table, Button, Modal, Form, Input, Select, InputNumber,
  Tag, Space, Popconfirm, Typography, Upload, Tooltip, message,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, PaperClipOutlined,
  UploadOutlined, DownloadOutlined,
} from "@ant-design/icons";
import { productsApi, brandsApi, categoriesApi } from "../api";
import { formatTHB, numberInputFormatter, numberInputParser } from "../utils/currency";

const STATUS_COLORS: Record<string, string> = {
  active: "green", obsolete: "red", on_request: "orange",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [form] = Form.useForm();
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, bRes, cRes] = await Promise.all([
        productsApi.list({ q: search || undefined }),
        brandsApi.list(),
        categoriesApi.list(),
      ]);
      setProducts(pRes.data?.data || []);
      setBrands(bRes.data);
      setCategories(cRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const openCreate = () => { setEditRecord(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (r: any) => {
    setEditRecord(r);
    form.setFieldsValue({ ...r });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editRecord) {
      await productsApi.update(editRecord.id, values);
      message.success("Product updated");
    } else {
      await productsApi.create(values);
      message.success("Product created");
    }
    setModalOpen(false);
    load();
  };

  const openAttachments = async (product: any) => {
    setSelectedProduct(product);
    const res = await productsApi.listAttachments(product.id);
    setAttachments(res.data);
    setAttachModalOpen(true);
  };

  const handleUpload = async ({ file }: any) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("label", file.name.replace(/\.[^.]+$/, ""));
    await productsApi.uploadAttachment(selectedProduct.id, formData);
    const res = await productsApi.listAttachments(selectedProduct.id);
    setAttachments(res.data);
    message.success("Uploaded");
    return false;
  };

  const deleteAttachment = async (attId: number) => {
    await productsApi.deleteAttachment(selectedProduct.id, attId);
    const res = await productsApi.listAttachments(selectedProduct.id);
    setAttachments(res.data);
  };

  const columns = [
    { title: "Item Code", dataIndex: "item_code", width: 130, sorter: (a: any, b: any) => a.item_code.localeCompare(b.item_code) },
    { title: "Description", dataIndex: "description", ellipsis: true },
    { title: "Brand", dataIndex: "brand_name", width: 110 },
    { title: "Category", dataIndex: "category_name", width: 130 },
    {
      title: "List Price (THB)", dataIndex: "list_price", width: 140, align: "right" as const,
      render: (v: number) => formatTHB(v),
    },
    { title: "MOQ", dataIndex: "moq", width: 60, align: "center" as const },
    {
      title: "Status", dataIndex: "status", width: 100,
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v.toUpperCase()}</Tag>,
    },
    {
      title: "Actions", width: 120, render: (_: any, r: any) => (
        <Space>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Attachments"><Button size="small" icon={<PaperClipOutlined />} onClick={() => openAttachments(r)} /></Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Products</Typography.Title>
        <Space>
          <Input.Search placeholder="Search code or description" onSearch={setSearch} allowClear style={{ width: 280 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Product</Button>
        </Space>
      </div>

      <Table
        dataSource={products}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20 }}
      />

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        title={editRecord ? "Edit Product" : "New Product"}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={640}
        okText="Save"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="item_code" label="Item Code" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="status" label="Status" initialValue="active">
              <Select options={[
                { value: "active", label: "Active" },
                { value: "obsolete", label: "Obsolete" },
                { value: "on_request", label: "On Request" },
              ]} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="brand_id" label="Brand">
              <Select options={brands.map((b) => ({ value: b.id, label: b.name }))} allowClear showSearch />
            </Form.Item>
            <Form.Item name="category_id" label="Category">
              <Select options={categories.map((c) => ({ value: c.id, label: c.name }))} allowClear showSearch />
            </Form.Item>
            <Form.Item name="list_price" label="List Price (THB)" initialValue={0}>
              <InputNumber
                min={0}
                precision={2}
                style={{ width: "100%" }}
                formatter={numberInputFormatter}
                parser={(v) => numberInputParser(v as string)}
              />
            </Form.Item>
            <Form.Item name="moq" label="MOQ" initialValue={1}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="lead_time_days" label="Lead Time (days)">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="currency" label="Currency" initialValue="THB">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="remark" label="Remark">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Attachments Modal */}
      <Modal
        open={attachModalOpen}
        title={`Attachments — ${selectedProduct?.item_code}`}
        onCancel={() => setAttachModalOpen(false)}
        footer={null}
        width={560}
      >
        <Upload beforeUpload={() => false} customRequest={handleUpload} showUploadList={false}>
          <Button icon={<UploadOutlined />} style={{ marginBottom: 12 }}>Upload Datasheet / Image</Button>
        </Upload>
        <Table
          dataSource={attachments}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: "File", dataIndex: "file_name", ellipsis: true },
            { title: "Label", dataIndex: "label" },
            { title: "Type", dataIndex: "file_type", width: 60 },
            {
              title: "", width: 80, render: (_: any, r: any) => (
                <Space>
                  <Tooltip title="Download">
                    <Button size="small" icon={<DownloadOutlined />}
                      onClick={() => window.open(productsApi.downloadAttachmentUrl(selectedProduct.id, r.id), "_blank")} />
                  </Tooltip>
                  <Popconfirm title="Delete attachment?" onConfirm={() => deleteAttachment(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
