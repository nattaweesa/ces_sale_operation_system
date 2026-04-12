import { useEffect, useState } from "react";
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, Typography, message, theme,
} from "antd";
import { PlusOutlined, EditOutlined, FileTextOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { departmentsApi, projectsApi, customersApi } from "../api";

const STATUS_COLORS: Record<string, string> = {
  active: "blue", won: "green", lost: "red", cancelled: "default",
};

export default function ProjectsPage() {
  const { token } = theme.useToken();
  const [projects, setProjects] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [departmentIdsFilter, setDepartmentIdsFilter] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const params = departmentIdsFilter.length ? { department_ids: departmentIdsFilter } : undefined;
      const [pRes, cRes, dRes] = await Promise.all([projectsApi.list(params), customersApi.list(params), departmentsApi.list()]);
      setProjects(pRes.data);
      setCustomers(cRes.data);
      setDepartments((dRes.data || []).filter((d: any) => d.is_active).map((d: any) => ({ id: d.id, name: d.name })));
    } catch {
      message.error("Unable to load projects data. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [departmentIdsFilter]);

  const openCreate = () => { setEditRecord(null); form.resetFields(); setOpen(true); };
  const openEdit = (r: any) => { setEditRecord(r); form.setFieldsValue(r); setOpen(true); };

  const handleSave = async () => {
    const v = await form.validateFields();
    if (editRecord) { await projectsApi.update(editRecord.id, v); message.success("Updated"); }
    else { await projectsApi.create(v); message.success("Created"); }
    setOpen(false); load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Projects</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Project</Button>
      </div>

      <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: token.colorTextSecondary }}>Departments</span>
        <Select
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          placeholder="All departments"
          style={{ minWidth: 280 }}
          value={departmentIdsFilter}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          onChange={(vals) => setDepartmentIdsFilter((vals || []).map((v) => Number(v)))}
        />
      </div>

      <Table
        dataSource={projects} rowKey="id" loading={loading} size="small"
        columns={[
          { title: "Project Name", dataIndex: "name" },
          { title: "Customer", dataIndex: "customer_name", width: 180 },
          { title: "Location", dataIndex: "location", width: 160 },
          {
            title: "Status", dataIndex: "status", width: 100,
            render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v.toUpperCase()}</Tag>,
          },
          {
            title: "Actions", width: 130, render: (_: any, r: any) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Button size="small" icon={<FileTextOutlined />} onClick={() => navigate(`/quotations?project_id=${r.id}`)}>Quotations</Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal open={open} title={editRecord ? "Edit Project" : "New Project"} onOk={handleSave} onCancel={() => setOpen(false)} width={560} okText="Save">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
            <Select options={customers.map((c) => ({ value: c.id, label: c.name }))} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="name" label="Project Name" rules={[{ required: true }]}><Input /></Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="location" label="Location"><Input /></Form.Item>
            <Form.Item name="status" label="Status" initialValue="active">
              <Select options={[
                { value: "active", label: "Active" },
                { value: "won", label: "Won" },
                { value: "lost", label: "Lost" },
                { value: "cancelled", label: "Cancelled" },
              ]} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
