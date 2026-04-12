import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Select, Input, Tag, Space, Typography, message } from "antd";
import { PlusOutlined, EyeOutlined } from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { departmentsApi, quotationsApi, projectsApi } from "../api";
import { formatTHB } from "../utils/currency";

const STATUS_COLORS: Record<string, string> = {
  draft: "default", issued: "blue", accepted: "green", rejected: "red", cancelled: "orange",
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [departmentIdsFilter, setDepartmentIdsFilter] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectIdFilter = searchParams.get("project_id");

  const load = async () => {
    setLoading(true);
    try {
      const params: { project_id?: number; status?: string; department_ids?: number[] } = {};
      if (projectIdFilter) params.project_id = parseInt(projectIdFilter);
      if (statusFilter) params.status = statusFilter;
      if (departmentIdsFilter.length) params.department_ids = departmentIdsFilter;

      const listParams = Object.keys(params).length ? params : undefined;
      const projectParams = departmentIdsFilter.length ? { department_ids: departmentIdsFilter } : undefined;

      const [qRes, pRes, dRes] = await Promise.all([
        quotationsApi.list(listParams),
        projectsApi.list(projectParams),
        departmentsApi.list(),
      ]);
      setQuotations(qRes.data);
      setProjects(pRes.data);
      setDepartments((dRes.data || []).filter((d: any) => d.is_active).map((d: any) => ({ id: Number(d.id), name: String(d.name) })));
    } catch {
      message.error("Unable to load quotations. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [projectIdFilter, departmentIdsFilter, statusFilter]);

  const handleCreate = async () => {
    const v = await form.validateFields();
    const selectedProject = projects.find((p) => p.id === v.project_id);

    Modal.confirm({
      title: "Please confirm quotation creation",
      content: (
        <div>
          <div><strong>Project:</strong> {selectedProject ? `${selectedProject.customer_name} - ${selectedProject.name}` : `#${v.project_id}`}</div>
          <div><strong>Subject:</strong> {v.subject || "-"}</div>
          <div><strong>VAT:</strong> {v.vat_rate ?? 7}%</div>
          <div><strong>Validity:</strong> {v.validity_days ?? 30} days</div>
        </div>
      ),
      okText: "Confirm",
      cancelText: "Cancel",
      okButtonProps: { loading: creating },
      onOk: async () => {
        setCreating(true);
        try {
          const res = await quotationsApi.create(v);
          message.success(`Quotation ${res.data.quotation_number} created`);
          setOpen(false);
          navigate(`/quotations/${res.data.id}`);
        } finally {
          setCreating(false);
        }
      },
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Quotations</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true); }}>New Quotation</Button>
      </div>

      <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Select
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          placeholder="Departments: All"
          style={{ minWidth: 280 }}
          value={departmentIdsFilter}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          onChange={(vals) => setDepartmentIdsFilter((vals || []).map((v) => Number(v)))}
        />
        <Select
          allowClear
          placeholder="Status: All"
          style={{ minWidth: 180 }}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
          options={[
            { value: "draft", label: "Draft" },
            { value: "issued", label: "Issued" },
            { value: "accepted", label: "Accepted" },
            { value: "rejected", label: "Rejected" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </div>

      <Table
        dataSource={quotations} rowKey="id" loading={loading} size="small"
        columns={[
          { title: "QT No.", dataIndex: "quotation_number", width: 160, render: (v: string, r: any) => <a onClick={() => navigate(`/quotations/${r.id}`)}>{v}</a> },
          { title: "Project", dataIndex: "project_name" },
          { title: "Customer", dataIndex: "customer_name", width: 180 },
          { title: "Subject", dataIndex: "subject", ellipsis: true },
          {
            title: "Status", dataIndex: "status", width: 90,
            render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v.toUpperCase()}</Tag>,
          },
          { title: "Rev.", dataIndex: "current_revision", width: 50, align: "center" as const },
          {
            title: "Grand Total (THB)", dataIndex: "grand_total", width: 180, align: "right" as const,
            render: (v: number) => formatTHB(v),
          },
          {
            title: "", width: 60, render: (_: any, r: any) => (
              <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/quotations/${r.id}`)} />
            ),
          },
        ]}
      />

        <Modal
          open={open}
          title="New Quotation"
          onOk={handleCreate}
          onCancel={() => setOpen(false)}
          okText="Continue"
          confirmLoading={creating}
        >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="project_id" label="Project" rules={[{ required: true }]}>
            <Select
              options={projects.map((p) => ({ value: p.id, label: `${p.customer_name} — ${p.name}` }))}
              showSearch optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="subject" label="Subject"><Input /></Form.Item>
          <Form.Item name="vat_rate" label="VAT Rate (%)" initialValue={7}><Input type="number" /></Form.Item>
          <Form.Item name="validity_days" label="Validity (days)" initialValue={30}><Input type="number" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
