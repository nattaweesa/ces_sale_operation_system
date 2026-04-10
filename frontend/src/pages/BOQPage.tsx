import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Space,
  Typography, Upload, message, Popconfirm, Tag, Tooltip,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined, DownloadOutlined, EyeOutlined } from "@ant-design/icons";
import { boqPricingV2Api, boqsApi, productsApi } from "../api";

export default function BOQPage() {
  const { id } = useParams<{ id: string }>();
  const boqId = parseInt(id!);
  const navigate = useNavigate();
  const [boq, setBoq] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [startingV2, setStartingV2] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    const [bRes, pRes] = await Promise.all([boqsApi.get(boqId), productsApi.list()]);
    setBoq(bRes.data);
    setProducts(pRes.data?.data || []);
  };
  useEffect(() => { load(); }, [boqId]);

  const openAdd = (item?: any) => {
    setEditItem(item || null);
    if (item) form.setFieldsValue(item);
    else { form.resetFields(); form.setFieldsValue({ seq: (boq?.items?.length || 0) + 1, quantity: 1 }); }
    setOpen(true);
  };

  const saveItem = async () => {
    const v = await form.validateFields();
    if (editItem) { await boqsApi.updateItem(boqId, editItem.id, v); }
    else { await boqsApi.addItem(boqId, v); }
    setOpen(false); load();
  };

  const deleteItem = async (itemId: number) => { await boqsApi.deleteItem(boqId, itemId); load(); };

  const runPreview = async () => {
    if (!selectedImportFile) {
      message.warning("Please select Excel file first");
      return;
    }
    setPreviewLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedImportFile);
      const res = await boqsApi.previewImport(fd);
      setImportPreview(res.data);
      setPreviewOpen(true);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "Unable to preview this file");
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmImport = async () => {
    if (!selectedImportFile) return;
    setImportLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedImportFile);
      await boqsApi.importExcel(boqId, fd);
      message.success("Imported from Excel");
      setPreviewOpen(false);
      setImportPreview(null);
      setSelectedImportFile(null);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await boqsApi.downloadTemplate();
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "BOQ_Import_Template.xlsx";
      a.click();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "Unable to download template");
    }
  };

  const startV2Pricing = async () => {
    setStartingV2(true);
    try {
      const existing = await boqPricingV2Api.listPricingSessionsByBoq(boqId);
      if (existing.data && existing.data.length > 0) {
        const latest = existing.data[0];
        message.info(`Found ${existing.data.length} existing V2 pricing session(s) — opening latest.`);
        navigate(`/v2/pricing-sessions/${latest.id}`);
        return;
      }
      const revisionRes = await boqPricingV2Api.createRevisionFromBoq(boqId);
      const sessionRes = await boqPricingV2Api.createPricingSession({
        boq_revision_id: revisionRes.data.id,
        currency: "THB",
        vat_rate: 7,
      });
      message.success("V2 pricing session created");
      navigate(`/v2/pricing-sessions/${sessionRes.data.id}`);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "Unable to start V2 pricing flow");
    } finally {
      setStartingV2(false);
    }
  };

  if (!boq) return <div>Loading...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>BOQ — {boq.name || `BOQ #${boq.id}`}</Typography.Title>
        <Space>
          <Button onClick={startV2Pricing} loading={startingV2}>Start V2 Pricing</Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>Download Template</Button>
          <Upload
            beforeUpload={(file) => {
              setSelectedImportFile(file as File);
              return false;
            }}
            showUploadList={false}
            accept=".xlsx"
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>{selectedImportFile ? "Change File" : "Select Excel"}</Button>
          </Upload>
          <Button icon={<EyeOutlined />} onClick={runPreview} loading={previewLoading} disabled={!selectedImportFile}>Preview Import</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openAdd()}>Add Item</Button>
        </Space>
      </div>
      {selectedImportFile && (
        <div style={{ marginBottom: 12 }}>
          <Tag color="blue">Selected: {selectedImportFile.name}</Tag>
        </div>
      )}
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 10 }}>
        แก้ไขแต่ละรายการด้วยปุ่มดินสอ แล้วกด Save ใน popup เพื่อบันทึกทันที (หน้านี้ไม่มีปุ่ม Save รวม)
      </Typography.Text>
      <Table
        dataSource={boq.items} rowKey="id" size="small"
        columns={[
          { title: "#", dataIndex: "seq", width: 50, align: "center" as const },
          { title: "Section", dataIndex: "section_label", width: 140 },
          { title: "Description", dataIndex: "description", ellipsis: true },
          { title: "Qty", dataIndex: "quantity", width: 70, align: "center" as const },
          { title: "Unit", dataIndex: "unit", width: 60 },
          { title: "Mapped Product", dataIndex: "product_code", width: 150 },
          {
            title: "Actions", width: 110, render: (_: any, r: any) => (
              <Space>
                <Tooltip title="Edit item">
                  <Button size="small" icon={<EditOutlined />} onClick={() => openAdd(r)} />
                </Tooltip>
                <Popconfirm title="Delete?" onConfirm={() => deleteItem(r.id)}>
                  <Tooltip title="Delete item">
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal open={open} title={editItem ? "Edit Item" : "Add BOQ Item"} onOk={saveItem} onCancel={() => setOpen(false)} okText="Save">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="seq" label="Seq" rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="section_label" label="Section"><Input placeholder="Zone A / MDB..." /></Form.Item>
          </div>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="quantity" label="Quantity"><InputNumber style={{ width: "100%" }} min={0} /></Form.Item>
            <Form.Item name="unit" label="Unit"><Input /></Form.Item>
          </div>
          <Form.Item name="product_id" label="Map to Product">
            <Select showSearch optionFilterProp="label" options={products.map((p) => ({ value: p.id, label: `${p.item_code} — ${p.description}` }))} allowClear placeholder="Search product..." />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal
        open={previewOpen}
        title="Import Preview"
        onCancel={() => setPreviewOpen(false)}
        width={900}
        okText="Confirm Import"
        onOk={confirmImport}
        confirmLoading={importLoading}
      >
        {importPreview && (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Tag color="purple">Mode: {importPreview.mode}</Tag>
              <Tag color="green">Import: {importPreview.imported_rows}</Tag>
              <Tag color="orange">Skipped: {importPreview.skipped_rows}</Tag>
              <Tag>Total scanned: {importPreview.total_rows}</Tag>
            </div>
            <Table
              rowKey={(r: any) => `${r.seq}-${r.description}`}
              size="small"
              pagination={{ pageSize: 10 }}
              dataSource={importPreview.sample_rows || []}
              columns={[
                { title: "Seq", dataIndex: "seq", width: 70 },
                { title: "Section", dataIndex: "section_label", width: 220, render: (v: string) => v || "-" },
                { title: "Description", dataIndex: "description", ellipsis: true },
                { title: "Qty", dataIndex: "quantity", width: 90 },
                { title: "Unit", dataIndex: "unit", width: 90, render: (v: string) => v || "-" },
                { title: "Notes", dataIndex: "notes", width: 180, ellipsis: true, render: (v: string) => v || "-" },
              ]}
            />
            <Typography.Text type="secondary">Preview shows first 20 rows only. Click Confirm Import to import all parsed rows.</Typography.Text>
          </Space>
        )}
      </Modal>
    </div>
  );
}
