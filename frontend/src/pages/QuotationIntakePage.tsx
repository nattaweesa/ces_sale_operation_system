import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Row, Space, Table, Tag, Typography, Upload, message } from "antd";
import type { UploadProps } from "antd";
import { InboxOutlined, CheckCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { quotationIntakeApi } from "../api";

export default function QuotationIntakePage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedLineKeys, setSelectedLineKeys] = useState<number[]>([]);

  const pendingRows = useMemo(() => lines.filter((ln) => ln.status === "pending"), [lines]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await quotationIntakeApi.listDocuments();
      setDocuments(res.data || []);
      if ((res.data || []).length > 0) {
        await loadDocumentDetail(res.data[0].id);
      } else {
        setSelectedDoc(null);
        setLines([]);
      }
    } catch {
      message.error("Unable to load uploaded quotation documents");
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentDetail = async (documentId: number) => {
    try {
      const res = await quotationIntakeApi.getDocument(documentId);
      setSelectedDoc(res.data.document);
      setLines(res.data.lines || []);
      setSelectedLineKeys([]);
    } catch {
      message.error("Unable to load document details");
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const uploadProps: UploadProps = {
    accept: ".pdf",
    maxCount: 1,
    showUploadList: false,
    beforeUpload: () => false,
    customRequest: async (options) => {
      const file = options.file as File;
      const formData = new FormData();
      formData.append("file", file);

      setUploading(true);
      try {
        const res = await quotationIntakeApi.uploadPdf(formData);
        message.success("Upload successful. Product lines extracted.");
        setSelectedDoc(res.data.document);
        setLines(res.data.lines || []);
        setSelectedLineKeys([]);
        await loadDocuments();
      } catch (error: any) {
        message.error(error?.response?.data?.detail || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
  };

  const confirmMissing = async () => {
    if (!selectedDoc) return;
    if (selectedLineKeys.length === 0) {
      message.warning("Please select at least one new item to create");
      return;
    }

    setConfirming(true);
    try {
      const res = await quotationIntakeApi.confirmMissing(selectedDoc.id, { line_ids: selectedLineKeys });
      message.success(
        `Done: created ${res.data.created_products}, marked existing ${res.data.existing_lines}, skipped ${res.data.skipped_lines}`
      );
      await loadDocumentDetail(selectedDoc.id);
      await loadDocuments();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Failed to confirm items");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Quotation PDF Upload (Product Intake)
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadDocuments} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} md={10}>
          <Card title="Upload Quotation PDF">
            <Upload.Dragger {...uploadProps} disabled={uploading}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Drop PDF here or click to upload</p>
              <p className="ant-upload-hint">System stores original file in your user folder and extracts product-like lines.</p>
            </Upload.Dragger>
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card title="Uploaded Files (My Account)">
            <Table
              dataSource={documents}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
              onRow={(record) => ({ onClick: () => loadDocumentDetail(record.id), style: { cursor: "pointer" } })}
              columns={[
                { title: "File", dataIndex: "original_filename", ellipsis: true },
                { title: "Status", dataIndex: "status", width: 100, render: (v: string) => <Tag color={v === "confirmed" ? "green" : "blue"}>{String(v).toUpperCase()}</Tag> },
                { title: "Lines", dataIndex: "total_lines", width: 70 },
                { title: "Existing", dataIndex: "existing_lines", width: 80 },
                { title: "New", dataIndex: "new_lines", width: 70 },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={selectedDoc ? `Extracted Items from: ${selectedDoc.original_filename}` : "Extracted Items"}
        extra={
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={confirmMissing}
            loading={confirming}
            disabled={!selectedDoc || pendingRows.length === 0}
          >
            Confirm Selected New Items
          </Button>
        }
      >
        <Table
          dataSource={lines}
          rowKey="id"
          size="small"
          scroll={{ x: 1400 }}
          rowSelection={{
            selectedRowKeys: selectedLineKeys,
            onChange: (keys) => setSelectedLineKeys(keys as number[]),
            getCheckboxProps: (record) => ({ disabled: record.status !== "pending" }),
          }}
          columns={[
            { title: "Line", dataIndex: "line_no", width: 70 },
            { title: "Item Code", dataIndex: "item_code", width: 150 },
            { title: "Description", dataIndex: "description", ellipsis: true },
            { title: "Qty", dataIndex: "quantity", width: 90 },
            { title: "Unit", dataIndex: "unit", width: 80 },
            { title: "List Price", dataIndex: "list_price", width: 120, render: (v: number) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 }) },
            { title: "Net Price", dataIndex: "net_price", width: 120, render: (v: number) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 }) },
            { title: "Amount", dataIndex: "amount", width: 120, render: (v: number) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 }) },
            {
              title: "Match",
              width: 240,
              render: (_: any, row: any) =>
                row.matched_product_id ? (
                  <span>{`${row.matched_product_code || ""} ${row.matched_product_description || ""}`}</span>
                ) : (
                  <Tag color="orange">NEW ITEM</Tag>
                ),
            },
            {
              title: "Status",
              dataIndex: "status",
              width: 100,
              render: (v: string) => {
                const color = v === "existing" ? "green" : v === "created" ? "blue" : v === "skipped" ? "default" : "orange";
                return <Tag color={color}>{String(v || "").toUpperCase()}</Tag>;
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
