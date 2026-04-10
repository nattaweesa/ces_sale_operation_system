import { useEffect, useMemo, useState } from "react";
import { Button, Input, InputNumber, Select, Space, Table, Tag, Typography, message } from "antd";
import { EditOutlined, ReloadOutlined, SaveOutlined, StopOutlined } from "@ant-design/icons";
import { brandsApi, categoriesApi, productsApi } from "../api";
import { formatTHB, numberInputFormatter, numberInputParser } from "../utils/currency";

type ProductRow = {
  id: number;
  item_code: string;
  description: string;
  brand_id?: number | null;
  category_id?: number | null;
  brand_name?: string | null;
  category_name?: string | null;
  list_price: number;
  currency: string;
  status: "active" | "obsolete" | "on_request";
  moq: number;
  lead_time_days?: number | null;
  remark?: string | null;
};

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "obsolete", label: "Obsolete" },
  { value: "on_request", label: "On Request" },
];

export default function ProductManualEditPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<ProductRow>>({});
  const [pagination, setPagination] = useState({ page: 1, page_size: 25, total: 0, pages: 0 });

  const brandOptions = useMemo(() => brands.map((b) => ({ value: b.id, label: b.name })), [brands]);
  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c.id, label: c.name })), [categories]);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const [pRes, bRes, cRes] = await Promise.all([
        productsApi.list({ q: search || undefined, page, page_size: 25 }),
        brandsApi.list(),
        categoriesApi.list(),
      ]);
      setProducts((pRes.data?.data || []) as ProductRow[]);
      setBrands(bRes.data || []);
      setCategories(cRes.data || []);
      setPagination({
        page: pRes.data?.page || 1,
        page_size: pRes.data?.page_size || 25,
        total: pRes.data?.total || 0,
        pages: pRes.data?.pages || 0,
      });
    } catch {
      message.error("Unable to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [search]);

  const startEdit = (row: ProductRow) => {
    setEditingId(row.id);
    setDraft({ ...row });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const updateDraft = (key: keyof ProductRow, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const saveRow = async () => {
    if (!editingId) return;

    const payload = {
      description: (draft.description || "").trim(),
      brand_id: draft.brand_id ?? null,
      category_id: draft.category_id ?? null,
      list_price: Number(draft.list_price || 0),
      currency: (draft.currency || "THB").trim() || "THB",
      status: (draft.status as string) || "active",
      moq: Number(draft.moq || 1),
      lead_time_days: draft.lead_time_days ?? null,
      remark: (draft.remark || "").trim() || null,
    };

    if (!payload.description) {
      message.warning("Description is required");
      return;
    }

    setSaving(true);
    try {
      await productsApi.update(editingId, payload);
      message.success("Saved");
      setEditingId(null);
      setDraft({});
      await load(pagination.page);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Manual Product Line Editor</Typography.Title>
          <Typography.Text type="secondary">
            Edit line items directly. Part No (Item Code) is locked and cannot be changed.
          </Typography.Text>
        </div>
        <Space>
          <Input.Search
            placeholder="Search part no / description"
            allowClear
            style={{ width: 280 }}
            onSearch={setSearch}
          />
          <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>Refresh</Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        dataSource={products}
        loading={loading}
        size="small"
        pagination={{
          current: pagination.page,
          pageSize: pagination.page_size,
          total: pagination.total,
          onChange: (page: number) => { load(page); },
        }}
        scroll={{ x: 1700 }}
        columns={[
          {
            title: "Part No",
            dataIndex: "item_code",
            width: 190,
            render: (v: string) => <Tag color="blue">{v}</Tag>,
          },
          {
            title: "Description",
            width: 350,
            render: (_: any, row: ProductRow) => (
              editingId === row.id ? (
                <Input value={draft.description} onChange={(e) => updateDraft("description", e.target.value)} />
              ) : row.description
            ),
          },
          {
            title: "Brand",
            width: 180,
            render: (_: any, row: ProductRow) => (
              editingId === row.id ? (
                <Select
                  allowClear
                  showSearch
                  style={{ width: "100%" }}
                  options={brandOptions}
                  value={draft.brand_id ?? undefined}
                  onChange={(v) => updateDraft("brand_id", v ?? null)}
                />
              ) : (row.brand_name || "-")
            ),
          },
          {
            title: "Category",
            width: 180,
            render: (_: any, row: ProductRow) => (
              editingId === row.id ? (
                <Select
                  allowClear
                  showSearch
                  style={{ width: "100%" }}
                  options={categoryOptions}
                  value={draft.category_id ?? undefined}
                  onChange={(v) => updateDraft("category_id", v ?? null)}
                />
              ) : (row.category_name || "-")
            ),
          },
          {
            title: "List Price (THB)",
            width: 130,
            render: (_: any, row: ProductRow) => (
              editingId === row.id ? (
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: "100%" }}
                  value={draft.list_price as number | undefined}
                  onChange={(v) => updateDraft("list_price", v ?? 0)}
                  formatter={numberInputFormatter}
                  parser={(v) => numberInputParser(v as string)}
                />
              ) : formatTHB(row.list_price)
            ),
          },
          {
            title: "Currency",
            width: 110,
            render: (_: any, row: ProductRow) => (
              editingId === row.id ? (
                <Input value={draft.currency} onChange={(e) => updateDraft("currency", e.target.value)} />
              ) : row.currency
            ),
          },
          {
            title: "Status",
            width: 130,
            render: (_: any, row: ProductRow) => (
              editingId === row.id ? (
                <Select
                  style={{ width: "100%" }}
                  options={STATUS_OPTIONS}
                  value={draft.status}
                  onChange={(v) => updateDraft("status", v)}
                />
              ) : <Tag>{row.status}</Tag>
            ),
          },
          {
            title: "MOQ",
            width: 100,
            render: (_: any, row: ProductRow) => (
              editingId === row.id ? (
                <InputNumber
                  min={1}
                  style={{ width: "100%" }}
                  value={draft.moq as number | undefined}
                  onChange={(v) => updateDraft("moq", v ?? 1)}
                />
              ) : row.moq
            ),
          },
          {
            title: "Lead Time (days)",
            width: 140,
            render: (_: any, row: ProductRow) => (
              editingId === row.id ? (
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  value={draft.lead_time_days as number | null | undefined}
                  onChange={(v) => updateDraft("lead_time_days", v ?? null)}
                />
              ) : (row.lead_time_days ?? "-")
            ),
          },
          {
            title: "Remark",
            width: 260,
            render: (_: any, row: ProductRow) => (
              editingId === row.id ? (
                <Input value={draft.remark || ""} onChange={(e) => updateDraft("remark", e.target.value)} />
              ) : (row.remark || "-")
            ),
          },
          {
            title: "Action",
            width: 200,
            fixed: "right",
            render: (_: any, row: ProductRow) => (
              editingId === row.id ? (
                <Space size="middle" wrap>
                  <Button size="small" type="primary" icon={<SaveOutlined />} onClick={saveRow} loading={saving}>
                    Save
                  </Button>
                  <Button size="small" icon={<StopOutlined />} onClick={cancelEdit}>
                    Cancel
                  </Button>
                </Space>
              ) : (
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  disabled={editingId !== null}
                  onClick={() => startEdit(row)}
                >
                  Edit
                </Button>
              )
            ),
          },
        ]}
      />
    </div>
  );
}
