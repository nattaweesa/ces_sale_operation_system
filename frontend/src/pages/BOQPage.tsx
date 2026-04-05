import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Space,
  Typography, Upload, message, Popconfirm,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined } from "@ant-design/icons";
import { boqsApi, productsApi } from "../api";

export default function BOQPage() {
  const { id } = useParams<{ id: string }>();
  const boqId = parseInt(id!);
  const [boq, setBoq] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    const [bRes, pRes] = await Promise.all([boqsApi.get(boqId), productsApi.list()]);
    setBoq(bRes.data);
    setProducts(pRes.data);
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

  const handleImport = async ({ file }: any) => {
    const fd = new FormData(); fd.append("file", file);
    await boqsApi.importExcel(boqId, fd);
    message.success("Imported from Excel");
    load();
    return false;
  };

  if (!boq) return <div>Loading...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>BOQ — {boq.name || `BOQ #${boq.id}`}</Typography.Title>
        <Space>
          <Upload beforeUpload={() => false} customRequest={handleImport} showUploadList={false} accept=".xlsx">
            <Button icon={<UploadOutlined />}>Import Excel</Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openAdd()}>Add Item</Button>
        </Space>
      </div>
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
            title: "", width: 80, render: (_: any, r: any) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openAdd(r)} />
                <Popconfirm title="Delete?" onConfirm={() => deleteItem(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
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
    </div>
  );
}
