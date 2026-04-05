import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Space, Popconfirm, Typography, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { brandsApi } from "../api";

export default function BrandsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => { setLoading(true); const r = await brandsApi.list(); setBrands(r.data); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditRecord(null); form.resetFields(); setOpen(true); };
  const openEdit = (r: any) => { setEditRecord(r); form.setFieldsValue(r); setOpen(true); };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editRecord) { await brandsApi.update(editRecord.id, values); message.success("Brand updated"); }
    else { await brandsApi.create(values); message.success("Brand created"); }
    setOpen(false); load();
  };

  const handleDelete = async (id: number) => { await brandsApi.delete(id); message.success("Deleted"); load(); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Brands</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Brand</Button>
      </div>
      <Table
        dataSource={brands} rowKey="id" loading={loading} size="small"
        columns={[
          { title: "Brand Name", dataIndex: "name" },
          {
            title: "", width: 100, render: (_: any, r: any) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Popconfirm title="Delete brand?" onConfirm={() => handleDelete(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal open={open} title={editRecord ? "Edit Brand" : "New Brand"} onOk={handleSave} onCancel={() => setOpen(false)} okText="Save">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Brand Name" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
