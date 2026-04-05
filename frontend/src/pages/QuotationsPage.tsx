import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Select, Input, Tag, Space, Typography, message } from "antd";
import { PlusOutlined, EyeOutlined } from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { quotationsApi, projectsApi, customersApi } from "../api";

const STATUS_COLORS: Record<string, string> = {
  draft: "default", issued: "blue", accepted: "green", rejected: "red", cancelled: "orange",
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectIdFilter = searchParams.get("project_id");

  const load = async () => {
    setLoading(true);
    const params = projectIdFilter ? { project_id: parseInt(projectIdFilter) } : undefined;
    const [qRes, pRes] = await Promise.all([quotationsApi.list(params), projectsApi.list()]);
    setQuotations(qRes.data);
    setProjects(pRes.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectIdFilter]);

  const handleCreate = async () => {
    const v = await form.validateFields();
    const res = await quotationsApi.create(v);
    message.success(`Quotation ${res.data.quotation_number} created`);
    setOpen(false);
    navigate(`/quotations/${res.data.id}`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Quotations</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true); }}>New Quotation</Button>
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
            title: "Grand Total", dataIndex: "grand_total", width: 130, align: "right" as const,
            render: (v: number) => v.toLocaleString("th-TH", { minimumFractionDigits: 2 }),
          },
          {
            title: "", width: 60, render: (_: any, r: any) => (
              <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/quotations/${r.id}`)} />
            ),
          },
        ]}
      />

      <Modal open={open} title="New Quotation" onOk={handleCreate} onCancel={() => setOpen(false)} okText="Create">
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
