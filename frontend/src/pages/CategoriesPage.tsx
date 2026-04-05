import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm, Typography, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { categoriesApi } from "../api";

export default function CategoriesPage() {
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => { setLoading(true); const r = await categoriesApi.list(); setCats(r.data); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditRecord(null); form.resetFields(); setOpen(true); };
  const openEdit = (r: any) => { setEditRecord(r); form.setFieldsValue(r); setOpen(true); };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editRecord) { await categoriesApi.update(editRecord.id, values); message.success("Updated"); }
    else { await categoriesApi.create(values); message.success("Created"); }
    setOpen(false); load();
  };

  const handleDelete = async (id: number) => { await categoriesApi.delete(id); message.success("Deleted"); load(); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Categories</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Category</Button>
      </div>
      <Table
        dataSource={cats} rowKey="id" loading={loading} size="small"
        columns={[
          { title: "Category Name", dataIndex: "name" },
          {
            title: "Parent", dataIndex: "parent_id",
            render: (pid: number) => cats.find((c) => c.id === pid)?.name || "—",
          },
          {
            title: "", width: 100, render: (_: any, r: any) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Popconfirm title="Delete category?" onConfirm={() => handleDelete(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal open={open} title={editRecord ? "Edit Category" : "New Category"} onOk={handleSave} onCancel={() => setOpen(false)} okText="Save">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Category Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="parent_id" label="Parent Category">
            <Select options={cats.filter((c) => c.id !== editRecord?.id).map((c) => ({ value: c.id, label: c.name }))} allowClear placeholder="None (root)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
