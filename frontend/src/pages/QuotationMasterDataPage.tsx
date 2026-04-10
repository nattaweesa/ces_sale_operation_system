import { useState } from "react";
import { Alert, Button, Card, Empty, Space, Table, Tag, Typography, Upload, message } from "antd";
import { InboxOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { quotationMasterDataApi } from "../api";

type ExistingMatch = {
  id: number;
  label: string;
  reason: string;
};

type EntityCandidate = {
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status: string;
  matches: ExistingMatch[];
};

type ProductCandidate = {
  line_no: number;
  item_code?: string;
  description: string;
  quantity: number;
  unit?: string;
  list_price: number;
  amount: number;
  status: string;
  matches: ExistingMatch[];
};

type PreviewResult = {
  filename: string;
  text_preview: string;
  warnings: string[];
  customer?: EntityCandidate | null;
  project?: EntityCandidate | null;
  contacts: EntityCandidate[];
  products: ProductCandidate[];
};

const statusColor = (status: string) => {
  if (status === "existing") return "green";
  if (status === "new") return "blue";
  if (status === "missing_item_code") return "orange";
  return "default";
};

const renderMatches = (matches: ExistingMatch[]) => {
  if (!matches?.length) return <Typography.Text type="secondary">No existing match</Typography.Text>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {matches.map((match) => (
        <div key={`${match.id}-${match.reason}`}>
          <Typography.Text>{match.label}</Typography.Text>
          <Typography.Text type="secondary"> ({match.reason})</Typography.Text>
        </div>
      ))}
    </div>
  );
};

export default function QuotationMasterDataPage() {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [uploading, setUploading] = useState(false);

  const resetPreview = () => setPreview(null);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const res = await quotationMasterDataApi.preview(formData);
      setPreview(res.data);
      message.success("Quotation analyzed. Review extracted master data candidates below.");
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to analyze this quotation file");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const entityColumns: ColumnsType<EntityCandidate> = [
    {
      title: "Extracted Value",
      key: "value",
      render: (_, record) => (
        <div>
          <div>{record.full_name || record.name || "-"}</div>
          {(record.email || record.phone) && (
            <Typography.Text type="secondary">{[record.email, record.phone].filter(Boolean).join(" | ")}</Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (status: string) => <Tag color={statusColor(status)}>{status.toUpperCase()}</Tag>,
    },
    {
      title: "Existing Matches",
      key: "matches",
      render: (_, record) => renderMatches(record.matches),
    },
  ];

  const productColumns: ColumnsType<ProductCandidate> = [
    { title: "Line", dataIndex: "line_no", width: 70 },
    { title: "Item Code", dataIndex: "item_code", width: 150, render: (v?: string) => v || "-" },
    { title: "Description", dataIndex: "description" },
    { title: "Qty", dataIndex: "quantity", width: 80 },
    { title: "Unit", dataIndex: "unit", width: 80, render: (v?: string) => v || "-" },
    { title: "List Price", dataIndex: "list_price", width: 120, render: (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    { title: "Status", dataIndex: "status", width: 140, render: (status: string) => <Tag color={statusColor(status)}>{status.toUpperCase()}</Tag> },
    { title: "Existing Matches", key: "matches", width: 320, render: (_, record) => renderMatches(record.matches) },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Quotation Master Data Extractor</Typography.Title>
        <Typography.Text type="secondary">
          Upload a quotation PDF here to preview customer, project, contact, and product candidates before inserting them into master data.
        </Typography.Text>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          <Alert
            type="info"
            showIcon
            message="Preview only in this phase"
            description="This screen already checks likely duplicates against Products, Customers, Projects, and Contacts. Insert/confirm actions will be added next."
          />
          <Upload.Dragger beforeUpload={handleUpload} showUploadList={false} accept=".pdf" disabled={uploading} maxCount={1}>
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Click or drag quotation PDF here</p>
            <p className="ant-upload-hint">Use this page for admin-side extraction into master data candidates.</p>
          </Upload.Dragger>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={resetPreview} disabled={!preview || uploading}>Clear Preview</Button>
          </Space>
        </Space>
      </Card>

      {!preview ? (
        <Card>
          <Empty description="Upload a quotation PDF to preview extracted master data candidates" />
        </Card>
      ) : (
        <Space direction="vertical" style={{ width: "100%" }} size={24}>
          <Card>
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              <Typography.Title level={5} style={{ margin: 0 }}>{preview.filename}</Typography.Title>
              <Typography.Text type="secondary">Detected {preview.products.length} product candidate(s)</Typography.Text>
              {preview.warnings.map((warning) => (
                <Alert key={warning} type="warning" showIcon message={warning} />
              ))}
            </Space>
          </Card>

          <Card title="Customer Candidate">
            {preview.customer ? <Table columns={entityColumns} dataSource={[preview.customer]} rowKey={(r) => `${r.name || r.email || r.phone}`} pagination={false} size="small" /> : <Empty description="No customer candidate detected" />}
          </Card>

          <Card title="Project Candidate">
            {preview.project ? <Table columns={entityColumns} dataSource={[preview.project]} rowKey={(r) => `${r.name || r.email || r.phone}`} pagination={false} size="small" /> : <Empty description="No project candidate detected" />}
          </Card>

          <Card title="Contact Candidates">
            {preview.contacts.length ? <Table columns={entityColumns} dataSource={preview.contacts} rowKey={(r) => `${r.full_name || r.email || r.phone}`} pagination={false} size="small" /> : <Empty description="No contact candidate detected" />}
          </Card>

          <Card title="Product Candidates">
            <Table columns={productColumns} dataSource={preview.products} rowKey={(r) => `${r.line_no}-${r.item_code || r.description}`} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 1200 }} />
          </Card>

          <Card title="Extracted Text Preview">
            <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{preview.text_preview || "-"}</Typography.Paragraph>
          </Card>
        </Space>
      )}
    </div>
  );
}