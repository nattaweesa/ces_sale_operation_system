import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, Tag, Space, Typography, message } from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import { usersApi } from "../api";

const ROLE_COLORS: Record<string, string> = { admin: "red", manager: "blue", sales_admin: "purple", sales: "green" };

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => { setLoading(true); const r = await usersApi.list(); setUsers(r.data); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditRecord(null); form.resetFields(); setOpen(true); };
  const openEdit = (r: any) => { setEditRecord(r); form.setFieldsValue({ ...r, password: "" }); setOpen(true); };

  const handleSave = async () => {
    const v = await form.validateFields();
    delete v.confirm_password;
    if (!v.password) delete v.password;
    if (editRecord) { await usersApi.update(editRecord.id, v); message.success("User updated"); }
    else { await usersApi.create(v); message.success("User created"); }
    setOpen(false); load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Users</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New User</Button>
      </div>
      <Table
        dataSource={users} rowKey="id" loading={loading} size="small"
        columns={[
          { title: "Username", dataIndex: "username" },
          { title: "Full Name", dataIndex: "full_name" },
          { title: "Email", dataIndex: "email" },
          { title: "Role", dataIndex: "role", render: (v: string) => <Tag color={ROLE_COLORS[v]}>{v.toUpperCase()}</Tag> },
          { title: "Active", dataIndex: "is_active", render: (v: boolean) => v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag> },
          { title: "", width: 60, render: (_: any, r: any) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /> },
        ]}
      />
      <Modal open={open} title={editRecord ? "Edit User" : "New User"} onOk={handleSave} onCancel={() => setOpen(false)} okText="Save">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="username" label="Username" rules={editRecord ? [] : [{ required: true }]}><Input disabled={!!editRecord} /></Form.Item>
            <Form.Item name="role" label="Role" initialValue="sales">
              <Select options={[
                { value: "admin", label: "Admin" },
                { value: "manager", label: "Manager" },
                { value: "sales_admin", label: "Sales Admin" },
                { value: "sales", label: "Sales" },
              ]} />
            </Form.Item>
          </div>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="password" label={editRecord ? "New Password (leave blank to keep)" : "Password"} rules={editRecord ? [] : [{ required: true }]}>
            <Input.Password />
          </Form.Item>
          {!editRecord && (
            <Form.Item
              name="confirm_password"
              label="Confirm Password"
              dependencies={["password"]}
              rules={[
                { required: true, message: "Please confirm password" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("Passwords do not match"));
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
          )}
          {editRecord && (
            <Form.Item name="is_active" label="Status" initialValue={true}>
              <Select options={[{ value: true, label: "Active" }, { value: false, label: "Inactive" }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
