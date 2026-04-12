import { useEffect, useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Space, Switch, Table, Typography, message } from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";

import { departmentsApi, DepartmentOut } from "../api";

export default function DepartmentsPage() {
  const [rows, setRows] = useState<DepartmentOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentOut | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    try {
      setLoading(true);
      const res = await departmentsApi.list();
      setRows(res.data || []);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setOpen(true);
  };

  const openEdit = (row: DepartmentOut) => {
    setEditing(row);
    form.setFieldsValue({ name: row.name, is_active: row.is_active });
    setOpen(true);
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        await departmentsApi.update(editing.id, values);
        message.success("Department updated");
      } else {
        await departmentsApi.create({ name: values.name });
        message.success("Department created");
      }
      setOpen(false);
      setEditing(null);
      await load();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.detail || "Failed to save department");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: DepartmentOut) => {
    try {
      await departmentsApi.update(row.id, { is_active: !row.is_active });
      message.success(row.is_active ? "Department disabled" : "Department enabled");
      await load();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Failed to update department");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Departments</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Department</Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        size="small"
        columns={[
          { title: "Name", dataIndex: "name" },
          {
            title: "Status",
            dataIndex: "is_active",
            render: (v: boolean) => (v ? "Active" : "Inactive"),
          },
          {
            title: "Actions",
            width: 200,
            render: (_: unknown, row: DepartmentOut) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
                <Popconfirm
                  title={row.is_active ? "Disable this department?" : "Enable this department?"}
                  okText="Yes"
                  cancelText="Cancel"
                  onConfirm={() => toggleActive(row)}
                >
                  <Button size="small">{row.is_active ? "Disable" : "Enable"}</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={open}
        title={editing ? "Edit Department" : "New Department"}
        onCancel={() => setOpen(false)}
        onOk={save}
        okButtonProps={{ loading: saving }}
        okText="Save"
      >
        <Form layout="vertical" form={form} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Department name is required" }]}>
            <Input maxLength={120} />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
