import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  message,
} from "antd";
import dayjs from "dayjs";
import { CheckOutlined } from "@ant-design/icons";
import { boqsApi, customersApi, dealsApi, projectsApi, usersApi } from "../api";
import { useAuthStore } from "../store/authStore";
import { formatTHBCompact, numberInputFormatter, numberInputParser } from "../utils/currency";

const KANBAN_COLUMNS = [
  { key: "lead", label: "Discovery", color: "bg-slate-400" },
  { key: "qualified", label: "Qualified", color: "bg-tertiary-fixed-dim" },
  { key: "proposal", label: "Proposal Sent", color: "bg-on-tertiary-container" },
  { key: "negotiation", label: "Negotiation", color: "bg-on-primary-container" },
  { key: "won", label: "Won", color: "bg-emerald-500" },
  { key: "lost", label: "Lost", color: "bg-error" },
];

const STAGE_OPTIONS = [
  { value: "lead", label: "Lead / Discovery" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const STATUS_OPTIONS = [
  { value: "design", label: "Design" },
  { value: "bidding", label: "Bidding" },
  { value: "award", label: "Award" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "open", label: "Open (Legacy)" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const PROJECT_STATUS_LABELS: Record<string, string> = {
  design: "Design",
  bidding: "Bidding",
  award: "Award",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  open: "Open",
  won: "Won",
  lost: "Lost",
};

const PROJECT_STATUS_STYLES: Record<string, string> = {
  design: "bg-sky-50 text-sky-700",
  bidding: "bg-violet-50 text-violet-700",
  award: "bg-emerald-50 text-emerald-700",
  on_hold: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-700",
  open: "bg-secondary-container text-on-secondary-container",
  won: "bg-emerald-50 text-emerald-700",
  lost: "bg-error-container text-on-error-container",
};

function formatProjectStatus(status?: string) {
  if (!status) return "Design";
  return PROJECT_STATUS_LABELS[status] || status.replace("_", " ");
}

const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

function fmt(n: number) {
  return formatTHBCompact(n);
}

const DEALS_SEARCH_STORAGE_KEY = "deals_funnel_search";

export default function DealsPage() {
  const navigate = useNavigate();
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

  const [openUpdates, setOpenUpdates] = useState(false);
  const [updateDeal, setUpdateDeal] = useState<any>(null);
  const [updateForm] = Form.useForm();
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [openForecast, setOpenForecast] = useState(false);
  const [forecastDeal, setForecastDeal] = useState<any>(null);
  const [forecastRows, setForecastRows] = useState<any[]>([]);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [savingForecast, setSavingForecast] = useState(false);
  const [creatingBoqDealId, setCreatingBoqDealId] = useState<number | null>(null);
  const [projectSearch, setProjectSearch] = useState(() => localStorage.getItem(DEALS_SEARCH_STORAGE_KEY) || "");

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
      message.error("Unable to load reference data.");
    }
  };

  const loadDeals = async () => {
    setLoading(true);
    try {
      const r = await dealsApi.list();
      setDeals(r.data || []);
    } catch {
      message.error("Unable to load deals.");
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
      status: "design",
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
    });
    setOpenDeal(true);
  };

  const saveDeal = async () => {
    const v = await dealForm.validateFields();
    const payload = {
      ...v,
      expected_close_date: v.expected_close_date ? v.expected_close_date.format("YYYY-MM-DD") : null,
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

  const openUpdateModal = async (deal: any) => {
    const d = await dealsApi.get(deal.id);
    setUpdateDeal(d.data);
    updateForm.resetFields();
    setOpenUpdates(true);
  };

  const addStatusUpdate = async () => {
    if (!updateDeal) return;
    const v = await updateForm.validateFields();
    setSavingUpdate(true);
    try {
      await dealsApi.addActivity(updateDeal.id, {
        action_type: "weekly_update",
        note: v.note,
        next_action: v.next_action || null,
        next_action_date: v.next_action_date ? v.next_action_date.format("YYYY-MM-DD") : null,
        deal_cycle_stage: v.deal_cycle_stage || null,
        status: v.status || null,
      });
      message.success("Update saved");
      const d = await dealsApi.get(updateDeal.id);
      setUpdateDeal(d.data);
      loadDeals();
      updateForm.resetFields();
    } finally {
      setSavingUpdate(false);
    }
  };

  const openForecastModal = async (deal: any) => {
    setForecastDeal(deal);
    setOpenForecast(true);
    setLoadingForecast(true);
    try {
      const res = await dealsApi.listMonthlyForecasts(deal.id);
      const rows = (res.data || []).map((r: any) => ({
        key: String(r.id),
        forecast_year: Number(r.forecast_year),
        forecast_month: Number(r.forecast_month),
        amount: Number(r.amount || 0),
        win_pct: Number(r.win_pct || 0),
        note: r.note || "",
      }));
      setForecastRows(rows);
    } catch {
      message.error("Unable to load monthly forecast");
      setForecastRows([]);
    } finally {
      setLoadingForecast(false);
    }
  };

  const addForecastRow = () => {
    const today = dayjs();
    setForecastRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random()}`,
        forecast_year: today.year(),
        forecast_month: today.month() + 1,
        amount: 0,
        win_pct: Number(forecastDeal?.probability_pct || 10),
        note: "",
      },
    ]);
  };

  const updateForecastRow = (key: string, patch: Record<string, any>) => {
    setForecastRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeForecastRow = (key: string) => {
    setForecastRows((prev) => prev.filter((r) => r.key !== key));
  };

  const saveMonthlyForecast = async () => {
    if (!forecastDeal) return;
    const items = forecastRows
      .map((r) => ({
        forecast_year: Number(r.forecast_year),
        forecast_month: Number(r.forecast_month),
        amount: Number(r.amount || 0),
        win_pct: Number(r.win_pct || 0),
        note: (r.note || "").trim() || null,
      }))
      .filter((r) => r.forecast_year && r.forecast_month);

    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.forecast_year}-${item.forecast_month}`;
      if (seen.has(key)) {
        message.error(`Duplicate row for ${key}`);
        return;
      }
      seen.add(key);
    }

    setSavingForecast(true);
    try {
      await dealsApi.replaceMonthlyForecasts(forecastDeal.id, items);
      message.success("Monthly forecast saved");
      setOpenForecast(false);
      loadDeals();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "Unable to save monthly forecast");
    } finally {
      setSavingForecast(false);
    }
  };

  const createBoqFromDeal = async (deal: any) => {
    if (!deal.project_id) {
      message.warning("Please set Project for this deal before creating BOQ");
      return;
    }

    setCreatingBoqDealId(deal.id);
    try {
      const res = await boqsApi.create({
        project_id: deal.project_id,
        deal_id: deal.id,
        name: `${deal.title} - BOQ`,
      });
      message.success("BOQ created");
      navigate(`/boqs/${res.data.id}`);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 409 && typeof detail === "string") {
        const m = detail.match(/id=(\d+)/);
        if (m?.[1]) {
          message.info("This deal already has BOQ. Opening existing BOQ.");
          navigate(`/boqs/${m[1]}`);
          return;
        }
      }
      message.error(detail || "Unable to create BOQ from this deal");
    } finally {
      setCreatingBoqDealId(null);
    }
  };

  const ownerOptions = useMemo(() => {
    if (!isManager) return [];
    return owners.map((u) => ({ value: u.id, label: u.full_name }));
  }, [owners, isManager]);

  const projectNameById = useMemo(() => {
    const map: Record<number, string> = {};
    projects.forEach((p) => {
      map[p.id] = p.name || "";
    });
    return map;
  }, [projects]);

  const filteredDeals = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((d) => {
      const projectName = d.project_name || (d.project_id ? projectNameById[d.project_id] : "") || "";
      const customerName = d.customer_name || "";
      const dealTitle = d.title || "";
      const searchableText = `${projectName} ${customerName} ${dealTitle}`.toLowerCase();
      return searchableText.includes(q);
    });
  }, [deals, projectSearch, projectNameById]);

  useEffect(() => {
    localStorage.setItem(DEALS_SEARCH_STORAGE_KEY, projectSearch);
  }, [projectSearch]);

  const dealsByStage = useMemo(() => {
    const map: Record<string, any[]> = {};
    KANBAN_COLUMNS.forEach((col) => { map[col.key] = []; });
    filteredDeals.forEach((d) => {
      const stage = d.deal_cycle_stage || "lead";
      if (map[stage]) map[stage].push(d);
    });
    return map;
  }, [filteredDeals]);

  const totalPipeline = filteredDeals
    .filter((d) => !["won", "lost"].includes(d.deal_cycle_stage))
    .reduce((s, d) => s + Number(d.expected_value || 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-headline tracking-tight text-slate-900">Sales Funnel</h2>
          <p className="text-on-surface-variant mt-1">
            Managing <span className="font-bold text-slate-900">{filteredDeals.filter(d => !["won","lost"].includes(d.deal_cycle_stage)).length}</span> active deals · Pipeline: <span className="font-bold text-slate-900">{fmt(totalPipeline)}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadDeals}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-low text-on-surface text-sm font-medium hover:bg-surface-container-high transition-colors border border-outline-variant/20"
          >
            <span className={`material-symbols-outlined text-base ${loading ? "animate-spin" : ""}`}>refresh</span>
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary-container text-white text-sm font-bold shadow-lg hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">add</span>
            New Deal
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-col md:flex-row md:items-center gap-3">
        <Input
          allowClear
          value={projectSearch}
          onChange={(e) => setProjectSearch(e.target.value)}
          placeholder="Search project, customer, or deal name..."
          className="max-w-md"
          prefix={<span className="material-symbols-outlined text-base text-slate-400">search</span>}
        />
        {projectSearch.trim() && (
          <p className="text-xs text-on-surface-variant">
            Showing {filteredDeals.length} of {deals.length} deals
          </p>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-5 overflow-x-auto pb-6 hide-scrollbar">
        {KANBAN_COLUMNS.map((col) => {
          const colDeals = dealsByStage[col.key] || [];
          const colValue = colDeals.reduce((s, d) => s + Number(d.expected_value || 0), 0);
          return (
            <div key={col.key} className="flex-shrink-0 w-72">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.color}`} />
                  <h3 className="text-xs font-extrabold font-headline uppercase tracking-wider text-slate-900">{col.label}</h3>
                  <span className="bg-surface-container-high text-[10px] font-bold px-2 py-0.5 rounded-full text-on-surface-variant">
                    {colDeals.length}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-on-surface-variant">{fmt(colValue)}</span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {colDeals.length === 0 && (
                  <div className="h-20 border-2 border-dashed border-outline-variant/40 rounded-xl flex items-center justify-center">
                    <p className="text-xs text-on-surface-variant">No deals</p>
                  </div>
                )}
                {colDeals.map((deal) => {
                  const openTaskCount = (deal.tasks || []).filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;
                  const initials = deal.owner_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
                  const isWon = col.key === "won";
                  const isLost = col.key === "lost";

                  return (
                    <div
                      key={deal.id}
                      className={`bg-surface-container-lowest p-4 rounded-xl shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition-all group ${
                        isWon ? "border border-emerald-100" : isLost ? "border border-error/10" : ""
                      }`}
                    >
                      {/* Top row */}
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide ${
                          PROJECT_STATUS_STYLES[deal.status] || "bg-secondary-container text-on-secondary-container"
                        }`}>
                          {formatProjectStatus(deal.status)}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${
                          isWon ? "bg-emerald-500" :
                          isLost ? "bg-error" :
                          deal.probability_pct >= 70 ? "bg-emerald-500" :
                          deal.probability_pct >= 40 ? "bg-amber-500" : "bg-slate-400"
                        }`} />
                      </div>

                      {/* Title + company */}
                      <h4 className="font-headline font-bold text-slate-900 text-sm mb-0.5 group-hover:text-on-tertiary-container transition-colors line-clamp-2">
                        {deal.title}
                      </h4>
                      <p className="text-xs text-on-surface-variant mb-3">{deal.customer_name || "—"}</p>

                      {/* Next action */}
                      {deal.next_action && (
                        <p className="text-[10px] text-on-surface-variant mb-3 bg-surface-container-low px-2 py-1 rounded line-clamp-1">
                          <span className="material-symbols-outlined text-[10px] mr-1">bolt</span>
                          {deal.next_action}
                        </p>
                      )}

                      {/* Footer */}
                      <div className="flex justify-between items-center pt-3 border-t border-surface-container-low">
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">Value</p>
                          <p className="text-sm font-bold text-slate-900">{fmt(Number(deal.expected_value || 0))}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {openTaskCount > 0 && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded">
                              {openTaskCount} task{openTaskCount > 1 ? "s" : ""}
                            </span>
                          )}
                          <div
                            className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 cursor-default"
                            title={deal.owner_name}
                          >
                            {initials}
                          </div>
                        </div>
                      </div>

                      {/* Actions on hover */}
                      <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(deal)}
                          className="flex-1 py-1.5 text-[10px] font-bold bg-surface-container-low hover:bg-primary-container hover:text-white rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openTaskModal(deal)}
                          className="flex-1 py-1.5 text-[10px] font-bold bg-surface-container-low hover:bg-surface-container-high rounded-lg transition-colors"
                        >
                          Tasks
                        </button>
                        <button
                          onClick={() => openUpdateModal(deal)}
                          className="flex-1 py-1.5 text-[10px] font-bold bg-surface-container-low hover:bg-tertiary-container hover:text-white rounded-lg transition-colors"
                        >
                          Updates
                        </button>
                        <button
                          onClick={() => openForecastModal(deal)}
                          className="flex-1 py-1.5 text-[10px] font-bold bg-surface-container-low hover:bg-primary-container hover:text-white rounded-lg transition-colors"
                        >
                          Forecast
                        </button>
                        <button
                          onClick={() => createBoqFromDeal(deal)}
                          disabled={!deal.project_id || creatingBoqDealId === deal.id}
                          className="flex-1 py-1.5 text-[10px] font-bold bg-surface-container-low hover:bg-secondary-container hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {creatingBoqDealId === deal.id ? "Creating..." : "Create BOQ"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal (Ant Design) */}
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
            {editingDeal && (
              <Form.Item name="project_id" label="Project">
                <Select allowClear options={projects.map((p) => ({ value: p.id, label: p.name }))} />
              </Form.Item>
            )}
            {isManager && (
              <Form.Item name="owner_id" label="Owner" rules={[{ required: true }]}>
                <Select options={ownerOptions} />
              </Form.Item>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <Form.Item name="deal_cycle_stage" label="Stage" rules={[{ required: true }]}>
              <Select options={STAGE_OPTIONS} />
            </Form.Item>
            <Form.Item name="status" label="Project Status" rules={[{ required: true }]}>
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="probability_pct" label="Probability %">
              <InputNumber min={0} max={100} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="expected_value" label="Expected Value (THB)">
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                formatter={numberInputFormatter}
                parser={(v) => numberInputParser(v as string)}
              />
            </Form.Item>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="expected_close_date" label="Expected Close Date">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="source" label="Lead Source"><Input /></Form.Item>
            <Form.Item name="competitor" label="Competitor"><Input /></Form.Item>
          </div>
          <Form.Item name="description" label="Description / Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Tasks Modal (Ant Design) */}
      <Modal
        open={openTasks}
        title={taskDeal ? `Tasks — ${taskDeal.title}` : "Tasks"}
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
                    title: "", width: 90,
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

      {/* Status Updates Modal */}
      <Modal
        open={openUpdates}
        title={updateDeal ? `Status Updates — ${updateDeal.title}` : "Status Updates"}
        onCancel={() => setOpenUpdates(false)}
        footer={null}
        width={760}
      >
        {updateDeal && (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            {/* Current next action banner */}
            {updateDeal.next_action && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-sm mt-0.5">bolt</span>
                <div>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-0.5">Current Next Action</p>
                  <p className="text-sm text-amber-900">{updateDeal.next_action}</p>
                  {updateDeal.next_action_date && (
                    <p className="text-xs text-amber-600 mt-0.5">By {updateDeal.next_action_date}</p>
                  )}
                </div>
              </div>
            )}

            {/* Add Update Form */}
            <Card size="small" title="Add Weekly Update">
              <Form form={updateForm} layout="vertical">
                <Form.Item name="note" label="This week's update" rules={[{ required: true, message: "Please enter an update" }]}>
                  <Input.TextArea rows={3} placeholder="What happened this week? Progress, meetings, blockers..." />
                </Form.Item>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Form.Item name="deal_cycle_stage" label="Move Stage to (optional)">
                    <Select allowClear placeholder="Keep current stage" options={STAGE_OPTIONS} />
                  </Form.Item>
                  <Form.Item name="status" label="Project Status (optional)">
                    <Select allowClear placeholder="Keep current project status" options={STATUS_OPTIONS} />
                  </Form.Item>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, alignItems: "end" }}>
                  <Form.Item name="next_action" label="Next Action" style={{ marginBottom: 0 }}>
                    <Input placeholder="What needs to happen next?" />
                  </Form.Item>
                  <Form.Item name="next_action_date" label="By When" style={{ marginBottom: 0 }}>
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </div>
                <div style={{ marginTop: 12, textAlign: "right" }}>
                  <Button type="primary" onClick={addStatusUpdate} loading={savingUpdate}>
                    Save Update
                  </Button>
                </div>
              </Form>
            </Card>

            {/* Update History */}
            <Card size="small" title="Update History">
              {(updateDeal.activities || []).filter((a: any) => a.action_type === "weekly_update").length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-4">No updates yet. Add the first update above.</p>
              ) : (
                <div className="space-y-3 mt-1">
                  {(updateDeal.activities || [])
                    .filter((a: any) => a.action_type === "weekly_update")
                    .map((a: any) => (
                      <div key={a.id} className="border border-outline-variant/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center text-[10px] font-bold text-white">
                              {(a.creator_name || "?").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                            <span className="text-xs font-semibold text-slate-700">{a.creator_name || "Unknown"}</span>
                          </div>
                          <span className="text-[10px] text-on-surface-variant">
                            {new Date(a.created_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{a.note}</p>
                        {(a.to_stage && a.from_stage !== a.to_stage) && (
                          <div className="flex items-center gap-1 mt-2">
                            <Tag color="default" className="text-[10px]">{a.from_stage}</Tag>
                            <span className="material-symbols-outlined text-[12px] text-on-surface-variant">arrow_forward</span>
                            <Tag color="blue" className="text-[10px]">{a.to_stage}</Tag>
                          </div>
                        )}
                        {a.next_action && (
                          <div className="mt-2 bg-amber-50 rounded px-2 py-1.5">
                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Next Action</p>
                            <p className="text-xs text-amber-900">{a.next_action}</p>
                            {a.next_action_date && <p className="text-[10px] text-amber-600 mt-0.5">By {a.next_action_date}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </Space>
        )}
      </Modal>

      <Modal
        open={openForecast}
        title={forecastDeal ? `Monthly Forecast — ${forecastDeal.title}` : "Monthly Forecast"}
        onCancel={() => setOpenForecast(false)}
        onOk={saveMonthlyForecast}
        okText="Save"
        confirmLoading={savingForecast}
        width={920}
      >
        <Space direction="vertical" style={{ width: "100%", marginTop: 12 }} size={10}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-on-surface-variant mb-0">
              Plan expected revenue by month. Net = Amount x Win %.
            </p>
            <Button size="small" type="dashed" onClick={addForecastRow}>Add Month</Button>
          </div>

          <Table
            size="small"
            rowKey="key"
            loading={loadingForecast}
            dataSource={forecastRows}
            pagination={false}
            scroll={{ y: 360 }}
            columns={[
              {
                title: "Year",
                width: 100,
                render: (_: any, row: any) => (
                  <InputNumber
                    min={2000}
                    max={2100}
                    value={row.forecast_year}
                    onChange={(v) => updateForecastRow(row.key, { forecast_year: Number(v || 0) })}
                    style={{ width: "100%" }}
                  />
                ),
              },
              {
                title: "Month",
                width: 130,
                render: (_: any, row: any) => (
                  <Select
                    value={row.forecast_month}
                    options={MONTH_OPTIONS}
                    onChange={(v) => updateForecastRow(row.key, { forecast_month: Number(v) })}
                  />
                ),
              },
              {
                title: "Amount (THB)",
                width: 180,
                render: (_: any, row: any) => (
                  <InputNumber
                    min={0}
                    value={row.amount}
                    onChange={(v) => updateForecastRow(row.key, { amount: Number(v || 0) })}
                    formatter={numberInputFormatter}
                    parser={(v) => numberInputParser(v as string)}
                    style={{ width: "100%" }}
                  />
                ),
              },
              {
                title: "Win %",
                width: 120,
                render: (_: any, row: any) => (
                  <InputNumber
                    min={0}
                    max={100}
                    value={row.win_pct}
                    onChange={(v) => updateForecastRow(row.key, { win_pct: Number(v || 0) })}
                    style={{ width: "100%" }}
                  />
                ),
              },
              {
                title: "Net (THB)",
                width: 160,
                render: (_: any, row: any) => fmt((Number(row.amount || 0) * Number(row.win_pct || 0)) / 100),
              },
              {
                title: "Note",
                render: (_: any, row: any) => (
                  <Input
                    value={row.note}
                    onChange={(e) => updateForecastRow(row.key, { note: e.target.value })}
                    placeholder="optional"
                  />
                ),
              },
              {
                title: "",
                width: 80,
                render: (_: any, row: any) => (
                  <Button size="small" danger onClick={() => removeForecastRow(row.key)}>
                    Remove
                  </Button>
                ),
              },
            ]}
          />
        </Space>
      </Modal>
    </div>
  );
}
