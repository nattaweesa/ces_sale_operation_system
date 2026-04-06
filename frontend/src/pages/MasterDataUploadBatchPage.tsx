import { useEffect, useState } from "react";
import { Button, Card, Space, Table, Tag, Typography, Upload, message } from "antd";
import type { UploadProps } from "antd";
import { InboxOutlined, ReloadOutlined } from "@ant-design/icons";
import { masterDataApi } from "../api";
import { useNavigate } from "react-router-dom";

export default function MasterDataUploadBatchPage() {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [batches, setBatches] = useState<any[]>([]);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await masterDataApi.listBatches();
      setBatches(res.data || []);
    } catch {
      message.error("Unable to load ingestion batches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const uploadProps: UploadProps = {
    multiple: true,
    accept: ".pdf",
    showUploadList: true,
    beforeUpload: (file) => {
      const ok = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!ok) message.error("PDF only");
      return ok ? true : Upload.LIST_IGNORE;
    },
    customRequest: async (options) => {
      const files = [options.file as File];
      const form = new FormData();
      for (const f of files) form.append("files", f);

      setUploading(true);
      setProgress(0);
      try {
        const res = await masterDataApi.uploadBatch(form, (p) => {
          setProgress(p);
          options.onProgress?.({ percent: p });
        });
        options.onSuccess?.(res.data);
        message.success(`Batch ${res.data.batch_id} uploaded`);
        await load();
      } catch (error: any) {
        options.onError?.(error);
        message.error(error?.response?.data?.detail || "Upload failed");
      } finally {
        setUploading(false);
        setTimeout(() => setProgress(0), 300);
      }
    },
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Module 1 - Upload Batch</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      <Card title="Upload Historical Quotation PDFs" style={{ marginBottom: 16 }}>
        <Upload.Dragger {...uploadProps} disabled={uploading}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Drop quotation PDFs here</p>
          <p className="ant-upload-hint">PDF only in v1. Files are stored with batch evidence.</p>
        </Upload.Dragger>
        {uploading && <Typography.Text style={{ marginTop: 10, display: "inline-block" }}>Uploading... {progress}%</Typography.Text>}
      </Card>

      <Card title="Ingestion Batches">
        <Table
          loading={loading}
          dataSource={batches}
          rowKey={(r: any) => r.batch.id}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: "Batch ID", render: (_: any, r: any) => r.batch.id },
            {
              title: "Status",
              render: (_: any, r: any) => <Tag color={r.batch.status === "parsed" ? "green" : r.batch.status === "failed" ? "red" : "blue"}>{String(r.batch.status).toUpperCase()}</Tag>,
            },
            { title: "Files", render: (_: any, r: any) => `${r.batch.processed_files}/${r.batch.total_files}` },
            { title: "Failed", render: (_: any, r: any) => r.batch.failed_files },
            { title: "Created", render: (_: any, r: any) => new Date(r.batch.created_at).toLocaleString() },
            {
              title: "Action",
              render: (_: any, r: any) => (
                <Space>
                  <Button size="small" onClick={() => navigate(`/master-data/batches/${r.batch.id}`)}>Detail</Button>
                  <Button size="small" onClick={async () => {
                    await masterDataApi.reprocessBatch(r.batch.id);
                    message.success("Reprocess requested");
                    await load();
                  }}>Reprocess</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
