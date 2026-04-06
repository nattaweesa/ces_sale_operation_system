import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Table, Button, Checkbox, Typography, Space, Card, message, List,
} from "antd";
import { FilePdfOutlined, PlusOutlined } from "@ant-design/icons";
import { quotationsApi } from "../api";

interface AttachmentOption {
  productId: number;
  productCode: string;
  productDesc: string;
  brand: string;
  attachmentId: number;
  label: string;
  selected: boolean;
}

export default function MaterialApprovalPage() {
  const { id } = useParams<{ id: string }>();
  const qtId = parseInt(id!);
  const [qt, setQt] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [items, setItems] = useState<AttachmentOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [qRes, pkgRes] = await Promise.all([quotationsApi.get(qtId), quotationsApi.listMaterialApprovals(qtId)]);
      setQt(qRes.data);
      setPackages(pkgRes.data);

      // Build list of unique products with their attachments from quotation lines
      const seen = new Set<number>();
      const opts: AttachmentOption[] = [];
      for (const line of qRes.data.lines) {
        if (!line.product_id || seen.has(line.product_id)) continue;
        seen.add(line.product_id);
        // Fetch product attachments
        const { default: api } = await import("../api/client");
        const attRes = await api.get(`/products/${line.product_id}/attachments`);
        for (const att of attRes.data) {
          if (att.file_type === "pdf") {
            opts.push({
              productId: line.product_id,
              productCode: line.item_code || "",
              productDesc: line.description,
              brand: line.brand || "",
              attachmentId: att.id,
              label: att.label || att.file_name,
              selected: true,
            });
          }
        }
      }
      setItems(opts);
    } catch {
      message.error("Unable to load material approval data. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [qtId]);

  const toggleItem = (idx: number) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
  };

  const generatePackage = async () => {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) { message.warning("Select at least one datasheet"); return; }
    const payload = {
      quotation_id: qtId,
      name: `Material Approval — ${qt.quotation_number}`,
      items: selected.map((s, idx) => ({
        product_id: s.productId,
        attachment_id: s.attachmentId,
        custom_label: s.label,
      })),
    };
    await quotationsApi.createMaterialApproval(qtId, payload);
    message.success("Material Approval Package generated!");
    load();
  };

  if (loading || !qt) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 4 }}>Material Approval Builder</Typography.Title>
      <Typography.Text type="secondary">Quotation: {qt.quotation_number} — {qt.customer_name} / {qt.project_name}</Typography.Text>

      <Card title="Select Datasheets to Include" style={{ marginTop: 16, marginBottom: 20 }} extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={generatePackage}>Generate Package</Button>
      }>
        {items.length === 0 ? (
          <Typography.Text type="secondary">No products with PDF datasheets found in this quotation. Upload datasheets in Products → Attachments first.</Typography.Text>
        ) : (
          <Table
            dataSource={items.map((it, idx) => ({ ...it, key: idx }))}
            pagination={false} size="small"
            columns={[
              {
                title: "Include", width: 70, render: (_: any, r: any) => (
                  <Checkbox checked={r.selected} onChange={() => toggleItem(r.key)} />
                ),
              },
              { title: "Item Code", dataIndex: "productCode", width: 130 },
              { title: "Description", dataIndex: "productDesc", ellipsis: true },
              { title: "Brand", dataIndex: "brand", width: 100 },
              { title: "Datasheet", dataIndex: "label" },
            ]}
          />
        )}
      </Card>

      <Typography.Title level={5}>Generated Packages</Typography.Title>
      <List
        dataSource={packages}
        renderItem={(pkg: any) => (
          <List.Item
            actions={[
              <a href={quotationsApi.materialApprovalPdfUrl(qtId, pkg.id)} target="_blank" rel="noreferrer">
                <Button icon={<FilePdfOutlined />}>Download PDF</Button>
              </a>,
            ]}
          >
            <List.Item.Meta
              title={pkg.name || `Package #${pkg.id}`}
              description={`${pkg.items.length} datasheets — Generated ${new Date(pkg.created_at).toLocaleDateString()}`}
            />
          </List.Item>
        )}
      />
    </div>
  );
}
