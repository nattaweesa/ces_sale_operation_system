import { useEffect, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { masterDataApi, productsApi } from "../api";

export default function MasterDataCandidateQueuePage() {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        masterDataApi.listCandidates({ status: "pending_review", limit: 300 }),
        productsApi.list(),
      ]);
      setCandidates(cRes.data?.items || []);
      setProducts(pRes.data || []);
    } catch {
      message.error("Unable to load candidate queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openReview = (row: any) => {
    setSelected(row);
    form.setFieldsValue({
      action: "approve_new",
      target_product_id: row.suggestions?.[0]?.product_id,
      canonical_description: row.canonical_description,
      selected_list_price: row.price_observations?.[0]?.observed_list_price,
      note: "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!selected) return;
    const v = await form.validateFields();
    try {
      await masterDataApi.reviewCandidate(selected.id, v);
      message.success("Review action saved");
      setOpen(false);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "Review action failed");
    }
  };

  return (
    <div>
      <Typography.Title level={4}>Module 1 - Candidate Review Queue</Typography.Title>
      <Card>
        <Table
          loading={loading}
          dataSource={candidates}
          rowKey="id"
          size="small"
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 25 }}
          columns={[
            { title: "ID", dataIndex: "id", width: 70 },
            { title: "Code", dataIndex: "candidate_code", width: 140 },
            { title: "Description", dataIndex: "canonical_description", ellipsis: true },
            { title: "Brand", dataIndex: "canonical_brand", width: 140 },
            { title: "Class", dataIndex: "source_classification", width: 140, render: (v: string) => <Tag color={v === "catalog_product" ? "green" : "default"}>{v}</Tag> },
            { title: "Price Obs", width: 120, render: (_: any, r: any) => r.price_observations?.length || 0 },
            { title: "Suggestions", width: 120, render: (_: any, r: any) => r.suggestions?.length || 0 },
            { title: "Status", dataIndex: "status", width: 130 },
            { title: "Action", width: 110, render: (_: any, r: any) => <Button onClick={() => openReview(r)}>Review</Button> },
          ]}
        />
      </Card>

      <Modal open={open} title="Review Candidate" onCancel={() => setOpen(false)} onOk={submit} okText="Submit" width={700}>
        <Form form={form} layout="vertical">
          <Form.Item name="action" label="Action" rules={[{ required: true }]}> 
            <Select options={[
              { value: "approve_new", label: "Approve as New Product" },
              { value: "merge_existing", label: "Merge into Existing Product" },
              { value: "reject", label: "Reject" },
            ]} />
          </Form.Item>
          <Form.Item name="target_product_id" label="Target Product (for merge)">
            <Select allowClear showSearch optionFilterProp="label" options={products.map((p: any) => ({ value: p.id, label: `${p.item_code} — ${p.description}` }))} />
          </Form.Item>
          <Space style={{ width: "100%" }}>
            <Form.Item name="canonical_description" label="Canonical Description" style={{ flex: 1 }}>
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item label="AI Suggest" style={{ marginTop: 30 }}>
              <Button onClick={async () => {
                const d = form.getFieldValue("canonical_description") || selected?.canonical_description || "";
                const res = await masterDataApi.aiCanonical(selected.id, { draft_description: d });
                form.setFieldValue("canonical_description", res.data.suggestion);
                message.success(`Suggested by ${res.data.provider}`);
              }}>Suggest</Button>
            </Form.Item>
          </Space>
          <Form.Item name="selected_list_price" label="Preferred List Price (manual pick)">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="note" label="Review Note"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
