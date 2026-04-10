import { useEffect, useMemo, useState } from "react";
import { Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined, EyeOutlined, FileTextOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { boqsApi, dealsApi, projectsApi, quotationsApi } from "../api";

export default function BOQsPage() {
  const [boqs, setBoqs] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingQuotationBoqId, setCreatingQuotationBoqId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [bRes, dRes, pRes] = await Promise.all([
        boqsApi.list(),
        dealsApi.list(),
        projectsApi.list(),
      ]);
      setBoqs(bRes.data || []);
      setDeals(dRes.data || []);
      setProjects(pRes.data || []);
    } catch {
      message.error("Unable to load BOQ data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const projectNameMap = useMemo(() => {
    const map = new Map<number, string>();
    (projects || []).forEach((p: any) => map.set(p.id, p.name));
    return map;
  }, [projects]);

  const validDeals = useMemo(() => {
    return (deals || []).filter((d: any) => !!d.project_id);
  }, [deals]);

  const dealOptions = useMemo(() => {
    return validDeals.map((d: any) => ({
      value: d.id,
      label: `${d.title} (${d.customer_name || "No customer"})`,
    }));
  }, [validDeals]);

  const openCreate = () => {
    form.resetFields();
    setOpen(true);
  };

  const createBoq = async () => {
    const v = await form.validateFields();
    const selectedDeal = validDeals.find((d: any) => d.id === v.deal_id);
    if (!selectedDeal || !selectedDeal.project_id) {
      message.error("Selected deal has no project link");
      return;
    }

    setCreating(true);
    try {
      const existingForDeal = (boqs || []).find((b: any) => b.deal_id === selectedDeal.id);
      if (existingForDeal) {
        message.info("This deal already has a BOQ. Opening existing BOQ.");
        setOpen(false);
        navigate(`/boqs/${existingForDeal.id}`);
        return;
      }

      const res = await boqsApi.create({
        project_id: selectedDeal.project_id,
        deal_id: selectedDeal.id,
        name: (v.name || `${selectedDeal.title} - BOQ`).trim(),
      });
      message.success("BOQ created");
      setOpen(false);
      navigate(`/boqs/${res.data.id}`);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 409 && typeof detail === "string") {
        const m = detail.match(/id=(\d+)/);
        if (m?.[1]) {
          message.info("This deal already has BOQ. Opening existing BOQ.");
          setOpen(false);
          navigate(`/boqs/${m[1]}`);
          return;
        }
      }
      message.error(detail || "Unable to create BOQ");
    } finally {
      setCreating(false);
    }
  };

  const createQuotationFromBoq = (boqRow: any) => {
    if (!boqRow?.project_id) {
      message.error("This BOQ has no project link");
      return;
    }

    Modal.confirm({
      title: "Confirm create quotation from BOQ",
      content: (
        <div>
          <div><strong>BOQ:</strong> {boqRow.name || `BOQ #${boqRow.id}`}</div>
          <div><strong>Project:</strong> {projectNameMap.get(boqRow.project_id) || `Project #${boqRow.project_id}`}</div>
          <div><strong>Items:</strong> {(boqRow.items || []).length}</div>
        </div>
      ),
      okText: "Confirm",
      cancelText: "Cancel",
      onOk: async () => {
        setCreatingQuotationBoqId(boqRow.id);
        try {
          const res = await quotationsApi.create({
            project_id: boqRow.project_id,
            boq_id: boqRow.id,
            subject: boqRow.name ? `Quotation for ${boqRow.name}` : undefined,
          });
          message.success(`Quotation ${res.data.quotation_number} created`);
          navigate(`/quotations/${res.data.id}`);
        } catch (e: any) {
          message.error(e?.response?.data?.detail || "Unable to create quotation from this BOQ");
        } finally {
          setCreatingQuotationBoqId(null);
        }
      },
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>BOQ</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New BOQ</Button>
      </div>

      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 10 }}>
        New BOQ must be created from an existing Deal that already has a Project.
      </Typography.Text>

      <Table
        dataSource={boqs || []}
        rowKey="id"
        loading={loading}
        size="small"
        columns={[
          {
            title: "BOQ",
            dataIndex: "name",
            render: (v: string, r: any) => (
              <a onClick={() => navigate(`/boqs/${r.id}`)}>{v || `BOQ #${r.id}`}</a>
            ),
          },
          {
            title: "Project",
            dataIndex: "project_id",
            width: 220,
            render: (v: number) => projectNameMap.get(v) || `Project #${v}`,
          },
          {
            title: "Source",
            dataIndex: "source",
            width: 120,
            render: (v: string) => <Tag color={v === "excel_import" ? "blue" : "default"}>{(v || "manual").toUpperCase()}</Tag>,
          },
          {
            title: "Items",
            width: 90,
            render: (_: any, r: any) => (r.items || []).length,
          },
          {
            title: "Created",
            dataIndex: "created_at",
            width: 180,
            render: (v: string) => new Date(v).toLocaleString("th-TH"),
          },
          {
            title: "",
              width: 130,
            render: (_: any, r: any) => (
                <Space>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/boqs/${r.id}`)} />
                  <Button
                    size="small"
                    icon={<FileTextOutlined />}
                    loading={creatingQuotationBoqId === r.id}
                    onClick={() => createQuotationFromBoq(r)}
                  >
                    Quotation
                  </Button>
                </Space>
            ),
          },
        ]}
      />

      <Modal
        open={open}
        title="Create New BOQ"
        onCancel={() => setOpen(false)}
        onOk={createBoq}
        okText="Create"
        confirmLoading={creating}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="deal_id"
            label="Deal"
            rules={[{ required: true, message: "Please select deal" }]}
            extra="Only deals that already have a project are shown"
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={dealOptions}
              placeholder="Select Deal"
            />
          </Form.Item>
          <Form.Item name="name" label="BOQ Name (optional)">
            <Input placeholder="Default: Deal Title - BOQ" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
