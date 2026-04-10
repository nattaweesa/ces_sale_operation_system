import { useEffect, useState } from "react";
import { Button, Table, Upload, Empty, message, Popconfirm, Spin, Typography } from "antd";
import { DeleteOutlined, UploadOutlined, ReloadOutlined } from "@ant-design/icons";
import type { TableProps, UploadFile } from "antd";
import api from "../api/client";

type UploadedFile = {
  id: number;
  filename: string;
  file_size: number;
  uploaded_at: string;
};

export default function SaleUploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await api.get("/quotation-uploads/my-uploads");
      setFiles(res.data?.data || []);
    } catch (error) {
      message.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleUpload = async (file: UploadFile) => {
    const formData = new FormData();
    formData.append("file", file as any);

    setUploading(true);
    try {
      await api.post("/quotation-uploads/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      message.success("File uploaded successfully");
      await loadFiles();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleDelete = async (fileId: number) => {
    try {
      await api.delete(`/quotation-uploads/${fileId}`);
      message.success("File deleted successfully");
      await loadFiles();
    } catch (error) {
      message.error("Failed to delete file");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const columns: TableProps<UploadedFile>["columns"] = [
    {
      title: "Filename",
      dataIndex: "filename",
      key: "filename",
    },
    {
      title: "File Size",
      dataIndex: "file_size",
      key: "file_size",
      width: 120,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: "Uploaded At",
      dataIndex: "uploaded_at",
      key: "uploaded_at",
      width: 180,
      render: (date: string) => new Date(date).toLocaleString("th-TH"),
    },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="Delete file?"
          description="Are you sure you want to delete this file?"
          onConfirm={() => handleDelete(record.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            size="small"
          >
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0, marginBottom: 8 }}>
          Upload Quotation PDF Files
        </Typography.Title>
        <Typography.Text type="secondary">
          Upload raw PDF quotation files. You can manage your uploaded files below.
        </Typography.Text>
      </div>

      <div style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center" }}>
        <Upload
          maxCount={1}
          beforeUpload={handleUpload}
          accept=".pdf"
          disabled={uploading}
        >
          <Button
            icon={<UploadOutlined />}
            loading={uploading}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload PDF"}
          </Button>
        </Upload>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadFiles}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      <Spin spinning={loading}>
        {files.length === 0 ? (
          <Empty description="No files uploaded yet" style={{ marginTop: 40 }} />
        ) : (
          <Table
            columns={columns}
            dataSource={files}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        )}
      </Spin>
    </div>
  );
}
