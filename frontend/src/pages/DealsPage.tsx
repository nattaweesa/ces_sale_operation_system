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
import { CheckOutlined, PlusOutlined } from "@ant-design/icons";
import { boqsApi, dealMasterDataApi, dealsApi, departmentsApi, projectsApi, usersApi } from "../api";
import { useAuthStore } from "../store/authStore";
import { formatTHBCompact, numberInputFormatter, numberInputParser } from "../utils/currency";

const KANBAN_COLUMNS = [
  { key: "lead", label: "Discovery", color: "bg-[#7f91b9]" },
  { key: "qualified", label: "Qualified", color: "bg-[#76c4ff]" },
  { key: "proposal", label: "Proposal Sent", color: "bg-[#c8a6ff]" },
  { key: "negotiation", label: "Negotiation", color: "bg-[#ffc074]" },
  { key: "won", label: "Won", color: "bg-[#6bffc1]" },
  { key: "lost", label: "Lost", color: "bg-[#ff8aa0]" },
];

const DEFAULT_CES_STAGE_OPTIONS = [
  { value: "lead", label: "Lead / Discovery" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const DEFAULT_PROJECT_STATUS_OPTIONS = [
  { value: "design", label: "Design" },
  { value: "bidding", label: "Bidding" },
  { value: "award", label: "Award" },
  { value: "on_hold", label: "On Hold" },
];

const PROJECT_STATUS_STYLES: Record<string, string> = {
  design: "bg-[#1f2d5a] text-[#76c4ff]",
  bidding: "bg-[#26225a] text-[#c8a6ff]",
  award: "bg-[#11372f] text-[#6bffc1]",
  on_hold: "bg-[#3a2a1a] text-[#ffc074]",
  completed: "bg-[#11372f] text-[#6bffc1]",
  cancelled: "bg-[#2a2a2a] text-[#9fb0d2]",
  open: "bg-[#1f3159] text-[#9fb0d2]",
  won: "bg-[#11372f] text-[#6bffc1]",
  lost: "bg-[#3a1f2a] text-[#ffb7c4]",
};

const OWNER_BADGE_CLASSES = [
  "bg-[#1a2b45] text-[#8fd3ff]",
  "bg-[#11372f] text-[#6bffc1]",
  "bg-[#3a2a1a] text-[#ffc074]",
  "bg-[#26225a] text-[#c8a6ff]",
  "bg-[#3a1f2a] text-[#ffb7c4]",
  "bg-[#1a3d4a] text-[#76e4ff]",
  "bg-[#273a1a] text-[#c4ff76]",
  "bg-[#3a2a1a] text-[#ffc874]",
];

function ownerBadgeClass(ownerName?: string) {
  if (!ownerName) return "bg-[#2a2a2a] text-[#9fb0d2]";
  let hash = 0;
  for (let i = 0; i < ownerName.length; i += 1) {
    hash = (hash * 31 + ownerName.charCodeAt(i)) >>> 0;
  }
  return OWNER_BADGE_CLASSES[hash % OWNER_BADGE_CLASSES.length];
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

  const [projects, setProjects] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [customerTypes, setCustomerTypes] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [productSystemTypes, setProductSystemTypes] = useState<any[]>([]);
  const [cesStageOptions, setCesStageOptions] = useState(DEFAULT_CES_STAGE_OPTIONS);
  const [projectStatusOptions, setProjectStatusOptions] = useState(DEFAULT_PROJECT_STATUS_OPTIONS);

  const [openDeal, setOpenDeal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [dealForm] = Form.useForm();
  const selectedCustomerTypeId = Form.useWatch("deal_customer_type_id", dealForm);
  const selectedProductSystemTypeIds = Form.useWatch("product_system_type_ids", dealForm) || [];
  const [quickCompanyOpen, setQuickCompanyOpen] = useState(false);
  const [quickCompanySaving, setQuickCompanySaving] = useState(false);
  const [quickCompanyForm] = Form.useForm();
  const [quickProductSystemOpen, setQuickProductSystemOpen] = useState(false);
  const [quickProductSystemSaving, setQuickProductSystemSaving] = useState(false);
  const [quickProductSystemForm] = Form.useForm();

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
  const [ownerIdFilter, setOwnerIdFilter] = useState<number | null>(null);
  const [departmentIdFilter, setDepartmentIdFilter] = useState<number | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<{ id: number; name: string }[]>([]);

  const loadMasterData = async () => {
    const res = await dealMasterDataApi.options();
    setCustomerTypes(res.data.customer_types || []);
    setCompanies(res.data.companies || []);
    setProductSystemTypes(res.data.product_system_types || []);
    setCesStageOptions(
      (res.data.ces_stages || []).map((item) => ({ value: item.key, label: item.label }))
    );
    setProjectStatusOptions(
      (res.data.project_statuses || []).map((item) => ({ value: item.key, label: item.label }))
    );
  };

  const loadReference = async () => {
    try {
      const [p] = await Promise.all([projectsApi.list(), loadMasterData()]);
      setProjects(p.data);
      if (isManager) {
        const [u, d] = await Promise.all([usersApi.list(), departmentsApi.list()]);
        setOwners(u.data || []);
        setDepartmentOptions((d.data || []).map((dep: any) => ({ id: dep.id, name: dep.name })));
      }
    } catch {
      message.error("Unable to load reference data.");
    }
  };

  const loadDeals = async () => {
    setLoading(true);
    try {
      const params: { owner_id?: number; department_id?: number } = {};
      if (isManager && ownerIdFilter) params.owner_id = ownerIdFilter;
      if (isManager && departmentIdFilter) params.department_id = departmentIdFilter;
      const r = await dealsApi.list(Object.keys(params).length ? params : undefined);
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

  useEffect(() => {
    if (!isManager) return;
    loadDeals();
  }, [ownerIdFilter, departmentIdFilter]);

  const openCreate = () => {
    setEditingDeal(null);
    dealForm.resetFields();
    dealForm.setFieldsValue({
      deal_cycle_stage: "lead",
      status: projectStatusOptions[0]?.value || DEFAULT_PROJECT_STATUS_OPTIONS[0].value,
      probability_pct: 10,
      expected_value: 0,
      product_system_type_ids: [],
      owner_id: user?.user_id,
    });
    setOpenDeal(true);
  };

  const openEdit = (deal: any) => {
    setEditingDeal(deal);
    dealForm.setFieldsValue({
      ...deal,
      product_system_type_ids: (deal.product_system_type_ids || []).map((value: any) => Number(value)),
      expected_close_date: deal.expected_close_date ? dayjs(deal.expected_close_date) : undefined,
    });
    setOpenDeal(true);
  };

  const saveDeal = async () => {
    const v = await dealForm.validateFields();
    const payload = {
      ...v,
      expected_close_date: v.expected_close_date ? v.expected_close_date.format("YYYY-MM-DD") : null,
      product_system_type_ids: v.product_system_type_ids || [],
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

  useEffect(() => {
    const selectedCompanyId = dealForm.getFieldValue("deal_company_id");
    if (!selectedCustomerTypeId || !selectedCompanyId) return;
    const selectedCompany = companies.find((row) => row.id === selectedCompanyId);
    if (selectedCompany && selectedCompany.customer_type_id !== selectedCustomerTypeId) {
      dealForm.setFieldValue("deal_company_id", undefined);
    }
  }, [companies, dealForm, selectedCustomerTypeId]);

  const saveQuickCompany = async () => {
    const values = await quickCompanyForm.validateFields();
    setQuickCompanySaving(true);
    try {
      const res = await dealMasterDataApi.quickAddCompany({
        customer_type_id: values.customer_type_id,
        name: values.name,
      });
      await loadMasterData();
      dealForm.setFieldsValue({
        deal_customer_type_id: res.data.customer_type_id,
        deal_company_id: res.data.id,
      });
      setQuickCompanyOpen(false);
      quickCompanyForm.resetFields();
      message.success("Company added");
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to add company");
    } finally {
      setQuickCompanySaving(false);
    }
  };

  const saveQuickProductSystemType = async () => {
    const values = await quickProductSystemForm.validateFields();
    setQuickProductSystemSaving(true);
    try {
      const res = await dealMasterDataApi.quickAddProductSystemType({ name: values.name });
      await loadMasterData();
      dealForm.setFieldValue(
        "product_system_type_ids",
        Array.from(new Set([...(selectedProductSystemTypeIds || []), res.data.id]))
      );
      setQuickProductSystemOpen(false);
      quickProductSystemForm.resetFields();
      message.success("Product/System Type added");
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to add Product/System Type");
    } finally {
      setQuickProductSystemSaving(false);
    }
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
        product_system_type_id: r.product_system_type_id ? Number(r.product_system_type_id) : null,
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
        product_system_type_id: Number(forecastDeal?.product_system_type_ids?.[0] || 0) || null,
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
        product_system_type_id: r.product_system_type_id ? Number(r.product_system_type_id) : null,
        forecast_year: Number(r.forecast_year),
        forecast_month: Number(r.forecast_month),
        amount: Number(r.amount || 0),
        win_pct: Number(r.win_pct || 0),
        note: (r.note || "").trim() || null,
      }))
      .filter((r) => r.forecast_year && r.forecast_month);

    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.forecast_year}-${item.forecast_month}-${item.product_system_type_id ?? 0}`;
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
    return owners
      .filter((u) => u.is_active)
      .filter((u) => ["sales", "manager"].includes(String(u.role || "").toLowerCase()))
      .map((u) => ({ value: u.id, label: u.full_name }));
  }, [owners, isManager]);

  const projectNameById = useMemo(() => {
    const map: Record<number, string> = {};
    projects.forEach((p) => {
      map[p.id] = p.name || "";
    });
    return map;
  }, [projects]);

  const projectStatusLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    DEFAULT_PROJECT_STATUS_OPTIONS.forEach((item) => {
      map[item.value] = item.label;
    });
    projectStatusOptions.forEach((item) => {
      map[item.value] = item.label;
    });
    return map;
  }, [projectStatusOptions]);

  const customerTypeOptions = useMemo(
    () => customerTypes.map((row) => ({ value: row.id, label: row.name })),
    [customerTypes]
  );

  const companyOptions = useMemo(
    () => companies
      .filter((row) => !selectedCustomerTypeId || row.customer_type_id === selectedCustomerTypeId)
      .map((row) => ({ value: row.id, label: row.name })),
    [companies, selectedCustomerTypeId]
  );

  const productSystemTypeOptions = useMemo(
    () => productSystemTypes.map((row) => ({ value: row.id, label: row.name })),
    [productSystemTypes]
  );

  const statusOptions = useMemo(() => {
    if (projectStatusOptions.length > 0) return projectStatusOptions;
    return DEFAULT_PROJECT_STATUS_OPTIONS;
  }, [projectStatusOptions]);

  const stageOptions = useMemo(() => {
    if (cesStageOptions.length > 0) return cesStageOptions;
    return DEFAULT_CES_STAGE_OPTIONS;
  }, [cesStageOptions]);

  const formatProjectStatus = (status?: string) => {
    if (!status) return "Design";
    return projectStatusLabelMap[status] || status.replace(/_/g, " ");
  };

  const filteredDeals = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((d) => {
      const projectName = d.project_name || (d.project_id ? projectNameById[d.project_id] : "") || "";
      const customerName = d.company_name || d.customer_name || "";
      const dealTitle = d.title || "";
      const productSystemNames = (d.product_system_types || []).map((row: any) => row.name).join(" ");
      const searchableText = `${projectName} ${customerName} ${dealTitle} ${productSystemNames}`.toLowerCase();
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
    <div className="deals-funnel-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-headline tracking-tight text-[#dbe3ff]">Sales Funnel</h2>
          <p className="text-[#97a6c9] mt-1">
            Managing <span className="font-bold text-[#dbe3ff]">{filteredDeals.filter(d => !["won","lost"].includes(d.deal_cycle_stage)).length}</span> active deals · Pipeline: <span className="font-bold text-[#dbe3ff]">{fmt(totalPipeline)}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadDeals}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2848] text-[#dbe3ff] text-sm font-medium hover:bg-[#1f3159] transition-colors border border-[#233861]"
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
        {isManager && (
          <Select
            style={{ minWidth: 200 }}
            value={departmentIdFilter ?? "all"}
            options={[{ value: "all", label: "All Departments" }, ...departmentOptions.map((d) => ({ value: d.id, label: d.name }))]}
            onChange={(value) => setDepartmentIdFilter(value === "all" ? null : Number(value))}
          />
        )}
        {isManager && (
          <Select
            style={{ minWidth: 220 }}
            value={ownerIdFilter ?? "all"}
            options={[{ value: "all", label: "All Owners" }, ...ownerOptions]}
            onChange={(value) => setOwnerIdFilter(value === "all" ? null : Number(value))}
          />
        )}
        {projectSearch.trim() && (
          <p className="text-xs text-[#97a6c9]">
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
                  <h3 className="text-xs font-extrabold font-headline uppercase tracking-wider text-[#dbe3ff]">{col.label}</h3>
                  <span className="bg-[#1f3159] text-[10px] font-bold px-2 py-0.5 rounded-full text-[#9fb0d2]">
                    {colDeals.length}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#9fb0d2]">{fmt(colValue)}</span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {colDeals.length === 0 && (
                  <div className="h-20 border-2 border-dashed border-[#233861]/40 rounded-xl flex items-center justify-center">
                    <p className="text-xs text-[#97a6c9]">No deals</p>
                  </div>
                )}
                {colDeals.map((deal) => {
                  const openTaskCount = (deal.tasks || []).filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;
                  const ownerName = deal.owner_name || "Unassigned";
                  const initials = ownerName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
                  const isWon = col.key === "won";
                  const isLost = col.key === "lost";

                  return (
                    <div
                      key={deal.id}
                      className={`bg-[#101d3b] p-4 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all group border border-[#1f3159] ${
                        isWon ? "" : isLost ? "" : ""
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
                      <h4 className="font-headline font-bold text-[#dbe3ff] text-sm mb-0.5 group-hover:text-[#a6d8ff] transition-colors line-clamp-2">
                        {deal.title}
                      </h4>
                      <p className="text-xs text-[#97a6c9] mb-3">{deal.company_name || deal.customer_name || "—"}</p>

                      {(deal.product_system_types || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(deal.product_system_types || []).slice(0, 3).map((item: any) => (
                            <span key={item.id} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a2848] text-[#9fb0d2]">
                              {item.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Next action */}
                      {deal.next_action && (
                        <p className="text-[10px] text-[#97a6c9] mb-3 bg-[#1a2848] px-2 py-1 rounded line-clamp-1">
                          <span className="material-symbols-outlined text-[10px] mr-1">bolt</span>
                          {deal.next_action}
                        </p>
                      )}

                      {/* Footer */}
                      <div className="flex justify-between items-center pt-3 border-t border-[#1f3159]">
                        <div>
                          <p className="text-[10px] font-bold text-[#97a6c9] uppercase tracking-tighter">Value</p>
                          <p className="text-sm font-bold text-[#dbe3ff]">{fmt(Number(deal.expected_value || 0))}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {openTaskCount > 0 && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded">
                              {openTaskCount} task{openTaskCount > 1 ? "s" : ""}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-1 rounded-full ${ownerBadgeClass(ownerName)}`}
                            title={ownerName}
                          >
                            {initials} · {ownerName}
                          </span>
                        </div>
                      </div>

                      {/* Actions on hover */}
                      <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(deal)}
                          className="flex-1 py-1.5 text-[10px] font-bold bg-[#1a2848] text-[#dbe3ff] hover:bg-[#8f95ff] hover:text-[#0f154b] rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openTaskModal(deal)}
                          className="flex-1 py-1.5 text-[10px] font-bold bg-[#1a2848] text-[#dbe3ff] hover:bg-[#1f3159] rounded-lg transition-colors"
                        >
                          Tasks
                        </button>
                        <button
                          onClick={() => openUpdateModal(deal)}
                          className="flex-1 py-1.5 text-[10px] font-bold bg-[#1a2848] text-[#dbe3ff] hover:bg-[#76c4ff] hover:text-[#0f154b] rounded-lg transition-colors"
                        >
                          Updates
                        </button>
                        <button
                          onClick={() => openForecastModal(deal)}
                          className="flex-1 py-1.5 text-[10px] font-bold bg-[#1a2848] text-[#dbe3ff] hover:bg-[#8f95ff] hover:text-[#0f154b] rounded-lg transition-colors"
                        >
                          Forecast
                        </button>
                        <button
                          onClick={() => createBoqFromDeal(deal)}
                          disabled={!deal.project_id || creatingBoqDealId === deal.id}
                          className="flex-1 py-1.5 text-[10px] font-bold bg-[#1a2848] text-[#dbe3ff] hover:bg-[#6bffc1] hover:text-[#0f154b] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <Form.Item name="deal_customer_type_id" label="Type of Customer" rules={[{ required: true }]}> 
              <Select allowClear options={customerTypeOptions} placeholder="Select customer type" />
            </Form.Item>
            <Form.Item
              name="deal_company_id"
              label="Company"
              rules={[{ required: true }]}
            >
              <Select
                allowClear
                showSearch
                disabled={!selectedCustomerTypeId}
                options={companyOptions}
                placeholder={selectedCustomerTypeId ? "Select company" : "Select customer type first"}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <div style={{ padding: 8, borderTop: "1px solid #f0f0f0" }}>
                      <Button
                        type="text"
                        icon={<PlusOutlined />}
                        disabled={!selectedCustomerTypeId}
                        onClick={() => {
                          quickCompanyForm.setFieldsValue({ customer_type_id: selectedCustomerTypeId });
                          setQuickCompanyOpen(true);
                        }}
                      >
                        Quick add company
                      </Button>
                    </div>
                  </>
                )}
              />
            </Form.Item>
            <Form.Item name="project_id" label="Project">
              <Select allowClear options={projects.map((p) => ({ value: p.id, label: p.name }))} />
            </Form.Item>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isManager ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
            <Form.Item name="product_system_type_ids" label="Product / System Type">
              <Select
                mode="multiple"
                allowClear
                options={productSystemTypeOptions}
                placeholder="Select one or more types"
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <div style={{ padding: 8, borderTop: "1px solid #f0f0f0" }}>
                      <Button type="text" icon={<PlusOutlined />} onClick={() => setQuickProductSystemOpen(true)}>
                        Quick add product/system type
                      </Button>
                    </div>
                  </>
                )}
              />
            </Form.Item>
            {isManager && (
              <Form.Item name="owner_id" label="Owner" rules={[{ required: true }]}>
                <Select options={ownerOptions} />
              </Form.Item>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <Form.Item name="deal_cycle_stage" label="CES Stage" rules={[{ required: true }]}>
              <Select options={stageOptions} />
            </Form.Item>
            <Form.Item name="status" label="Project Status" rules={[{ required: true }]}>
              <Select options={statusOptions} />
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

      <Modal
        open={quickCompanyOpen}
        title="Quick Add Company"
        onCancel={() => setQuickCompanyOpen(false)}
        onOk={saveQuickCompany}
        okText="Add"
        confirmLoading={quickCompanySaving}
      >
        <Form form={quickCompanyForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer_type_id" label="Type of Customer" rules={[{ required: true }]}> 
            <Select options={customerTypeOptions} />
          </Form.Item>
          <Form.Item name="name" label="Company Name" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={quickProductSystemOpen}
        title="Quick Add Product / System Type"
        onCancel={() => setQuickProductSystemOpen(false)}
        onOk={saveQuickProductSystemType}
        okText="Add"
        confirmLoading={quickProductSystemSaving}
      >
        <Form form={quickProductSystemForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Product / System Type" rules={[{ required: true }]}> 
            <Input />
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
                  <Form.Item name="deal_cycle_stage" label="Move CES Stage to (optional)">
                    <Select allowClear placeholder="Keep current CES stage" options={stageOptions} />
                  </Form.Item>
                  <Form.Item name="status" label="Project Status (optional)">
                    <Select allowClear placeholder="Keep current project status" options={statusOptions} />
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
                <p className="text-sm text-[#97a6c9] text-center py-4">No updates yet. Add the first update above.</p>
              ) : (
                <div className="space-y-3 mt-1">
                  {(updateDeal.activities || [])
                    .filter((a: any) => a.action_type === "weekly_update")
                    .map((a: any) => (
                      <div key={a.id} className="border border-[#233861]/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#8f95ff] flex items-center justify-center text-[10px] font-bold text-[#0f154b]">
                              {(a.creator_name || "?").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                            <span className="text-xs font-semibold text-[#9fb0d2]">{a.creator_name || "Unknown"}</span>
                          </div>
                          <span className="text-[10px] text-[#97a6c9]">
                            {new Date(a.created_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <p className="text-sm text-[#c5d0e8] whitespace-pre-wrap">{a.note}</p>
                        {(a.to_stage && a.from_stage !== a.to_stage) && (
                          <div className="flex items-center gap-1 mt-2">
                            <Tag color="default" className="text-[10px]">{a.from_stage}</Tag>
                            <span className="material-symbols-outlined text-[12px] text-on-surface-variant">arrow_forward</span>
                            <Tag color="blue" className="text-[10px]">{a.to_stage}</Tag>
                          </div>
                        )}
                        {a.next_action && (
                          <div className="mt-2 bg-[#3a2a1a] rounded px-2 py-1.5">
                            <p className="text-[10px] font-bold text-[#ffc074] uppercase tracking-wide">Next Action</p>
                            <p className="text-xs text-[#ffd9a8]">{a.next_action}</p>
                            {a.next_action_date && <p className="text-[10px] text-[#ffb74d] mt-0.5">By {a.next_action_date}</p>}
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
              Plan expected revenue by month and product/system type. Net = Amount x Win %.
            </p>
            <Button size="small" type="dashed" onClick={addForecastRow}>Add Row</Button>
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
                title: "Product / System",
                width: 210,
                render: (_: any, row: any) => (
                  <Select
                    allowClear
                    placeholder="General"
                    value={row.product_system_type_id ?? undefined}
                    options={productSystemTypeOptions}
                    onChange={(v) => updateForecastRow(row.key, { product_system_type_id: v ? Number(v) : null })}
                  />
                ),
              },
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
