import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { PlusOutlined, ReloadOutlined, CheckOutlined } from "@ant-design/icons";
import { customersApi, dealsApi, projectsApi, usersApi } from "../api";
import { useAuthStore } from "../store/authStore";

const STAGE_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "on_hold", label: "On Hold" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const STAGE_COLORS: Record<string, string> = {
  lead: "default",
  qualified: "blue",
  proposal: "gold",
  negotiation: "purple",
  won: "green",
  lost: "red",
};

const STATUS_COLORS: Record<string, string> = {
  open: "processing",
  on_hold: "warning",
  won: "success",
  lost: "error",
};

export default function DealsPage() {
  const user = useAuthStore((s) => s.user);
  const isManager = ["admin", "manager", "sales_admin"].includes(user?.role || "");

  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);

  const [openDeal, setOpenDeal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [dealForm] = Form.useForm();

  const [openTasks, setOpenTasks] = useState(false);
  const [taskDeal, setTaskDeal] = useState<any>(null);
  const [taskForm] = Form.useForm();

  const loadReference = async () => {
    try {
      const [c, p] = await Promise.all([customersApi.list(), projectsApi.list()]);
      setCustomers(c.data);
      setProjects(p.data);
      if (isManager) {
        const u = await usersApi.list();
        setOwners(u.data || []);
      }
    } catch {
      message.error("Unable to load reference data. Please refresh and try again.");
    }
  };

  const loadDeals = async () => {
    setLoading(true);
    try {
      const r = await dealsApi.list();
      setDeals(r.data || []);
    } catch {
      message.error("Unable to load deals. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReference();
    loadDeals();
  }, []);

  const openCreate = () => {
    setEditingDeal(null);
    dealForm.resetFields();
    dealForm.setFieldsValue({
      deal_cycle_stage: "lead",
      status: "open",
      probability_pct: 10,
      expected_value: 0,
      owner_id: user?.user_id,
    });
    setOpenDeal(true);
  };

  const openEdit = (deal: any) => {
    setEditingDeal(deal);
    dealForm.setFieldsValue({
      ...deal,
      expected_close_date: deal.expected_close_date ? dayjs(deal.expected_close_date) : undefined,
      next_action_date: deal.next_action_date ? dayjs(deal.next_action_date) : undefined,
    });
    setOpenDeal(true);
  };

  const saveDeal = async () => {
    const v = await dealForm.validateFields();
    const payload = {
      ...v,
      expected_close_date: v.expected_close_date ? v.expected_close_date.format("YYYY-MM-DD") : null,
      next_action_date: v.next_action_date ? v.next_action_date.format("YYYY-MM-DD") : null,
    };

    if (editingDeal) {
      await dealsApi.update(editingDeal.id, payload);
      message.success("Deal updated");
    } else {
      await dealsApi.create(payload);
      message.success("Deal created");
    }

    setOpenDeal(false);
    setEditingDeal(null);
    loadDeals();
  };

  const openTaskModal = async (deal: any) => {
    const d = await dealsApi.get(deal.id);
    setTaskDeal(d.data);
    taskForm.resetFields();
    setOpenTasks(true);
  };

  const addTask = async () => {
    if (!taskDeal) return;
    const v = await taskForm.validateFields();
    await dealsApi.addTask(taskDeal.id, {
      ...v,
      due_date: v.due_date ? v.due_date.format("YYYY-MM-DD") : null,
    });
    message.success("Task added");
    const d = await dealsApi.get(taskDeal.id);
    setTaskDeal(d.data);
    loadDeals();
    taskForm.resetFields();
  };

  const markTaskDone = async (taskId: number) => {
    if (!taskDeal) return;
    await dealsApi.updateTask(taskDeal.id, taskId, { status: "done" });
    const d = await dealsApi.get(taskDeal.id);
    setTaskDeal(d.data);
    loadDeals();
  };

  const ownerOptions = useMemo(() => {
    if (!isManager) return [];
    return owners.map((u) => ({ value: u.id, label: u.full_name }));
  }, [owners, isManager]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Sale Project Management - Deals
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadDeals}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Deal</Button>
        </Space>
      </div>

      <Table
        dataSource={deals}
        rowKey="id"
        loading={loading}
        size="small"
        columns={[
          { title: "Deal", dataIndex: "title", width: 260 },
          { title: "Owner", dataIndex: "owner_name", width: 150 },
          { title: "Customer", dataIndex: "customer_name", width: 170 },
          {
            title: "Stage",
            dataIndex: "deal_cycle_stage",
            width: 120,
            render: (v: string) => <Tag color={STAGE_COLORS[v] || "default"}>{(v || "").toUpperCase()}</Tag>,
          },
          {
            title: "Status",
            dataIndex: "status",
            width: 100,
            render: (v: string) => <Badge status={STATUS_COLORS[v] as any} text={(v || "").toUpperCase()} />,
          },
          {
            title: "Value",
            dataIndex: "expected_value",
            width: 130,
            render: (v: number) => Number(v || 0).toLocaleString(),
          },
          { title: "Prob%", dataIndex: "probability_pct", width: 80 },
          { title: "Next Action", dataIndex: "next_action", ellipsis: true },
          {
            title: "Task",
            width: 80,
            render: (_: any, r: any) => {
              const openTasksCount = (r.tasks || []).filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;
              return <Badge count={openTasksCount} size="small" />;
            },
          },
          {
            title: "",
            width: 190,
            render: (_: any, r: any) => (
              <Space>
                <Button size="small" onClick={() => openEdit(r)}>Update</Button>
                <Button size="small" onClick={() => openTaskModal(r)}>Tasks</Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={openDeal}
        title={editingDeal ? "Update Deal" : "New Deal"}
        onCancel={() => setOpenDeal(false)}
        onOk={saveDeal}
        width={760}
        okText="Save"
      >
        <Form form={dealForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="Deal Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Form.Item name="customer_id" label="Customer">
              <Select allowClear options={customers.map((c) => ({ value: c.id, label: c.name }))} />
            </Form.Item>
            <Form.Item name="project_id" label="Project">
              <Select allowClear options={projects.map((p) => ({ value: p.id, label: p.name }))} />
            </Form.Item>
            {isManager && (
              <Form.Item name="owner_id" label="Owner" rules={[{ required: true }]}>
                <Select options={ownerOptions} />
              </Form.Item>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <Form.Item name="deal_cycle_stage" label="Deal Cycle Stage" rules={[{ required: true }]}>
              <Select options={STAGE_OPTIONS} />
            </Form.Item>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="probability_pct" label="Probability %">
              <InputNumber min={0} max={100} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="expected_value" label="Expected Value">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="expected_close_date" label="Expected Close Date">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="next_action_date" label="Next Action Date">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </div>

          <Form.Item name="next_action" label="Next Action">
            <Input.TextArea rows={2} />
          </Form.Item>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="source" label="Lead Source"><Input /></Form.Item>
            <Form.Item name="competitor" label="Competitor"><Input /></Form.Item>
          </div>

          <Form.Item name="description" label="Description / Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={openTasks}
        title={taskDeal ? `Tasks - ${taskDeal.title}` : "Tasks"}
        onCancel={() => setOpenTasks(false)}
        footer={null}
        width={800}
      >
        {taskDeal && (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Card size="small" title="Add Task">
              <Form form={taskForm} layout="vertical">
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px", gap: 10, alignItems: "end" }}>
                  <Form.Item name="title" label="Task" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                    <Input placeholder="Call client to review proposal" />
                  </Form.Item>
                  <Form.Item name="due_date" label="Due Date" style={{ marginBottom: 0 }}>
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item name="priority" label="Priority" initialValue="medium" style={{ marginBottom: 0 }}>
                    <Select options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} />
                  </Form.Item>
                  <Button type="primary" onClick={addTask}>Add</Button>
                </div>
              </Form>
            </Card>

            <Card size="small" title="Task List">
              <Table
                rowKey="id"
                size="small"
                dataSource={taskDeal.tasks || []}
                pagination={false}
                columns={[
                  { title: "Task", dataIndex: "title" },
                  { title: "Due", dataIndex: "due_date", width: 130 },
                  { title: "Priority", dataIndex: "priority", width: 110, render: (v: string) => <Tag>{v}</Tag> },
                  { title: "Status", dataIndex: "status", width: 120, render: (v: string) => <Tag color={v === "done" ? "green" : "default"}>{v}</Tag> },
                  {
                    title: "",
                    width: 90,
                    render: (_: any, r: any) => (
                      <Button size="small" icon={<CheckOutlined />} disabled={r.status === "done"} onClick={() => markTaskDone(r.id)}>
                        Done
                      </Button>
                    ),
                  },
                ]}
              />
            </Card>
          </Space>
        )}
      </Modal>
    </div>
  );
}
