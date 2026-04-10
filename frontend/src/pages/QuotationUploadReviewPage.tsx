import { useEffect, useMemo, useState } from "react";
import { Button, Input, Space, Table, Typography, message } from "antd";
import type { TableProps } from "antd";
import { EyeOutlined, ReloadOutlined } from "@ant-design/icons";
import { quotationUploadsApi } from "../api";
import { useAuthStore } from "../store/authStore";


type UploadedFileReviewRow = {
  id: number;
  user_id: number;
  username?: string | null;
  full_name?: string | null;
  filename: string;
  file_size: number;
  uploaded_at: string;
};

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** index) * 100) / 100} ${units[index]}`;
}

export default function QuotationUploadReviewPage() {
  const user = useAuthStore((s) => s.user);
  const [files, setFiles] = useState<UploadedFileReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);

  const isAllowed = ["admin", "manager"].includes(user?.role || "");

  const load = async () => {
    if (!isAllowed) return;
    setLoading(true);
    try {
      const response = await quotationUploadsApi.review();
      setFiles(response.data?.data || []);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to load uploaded files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isAllowed]);

  const openPdf = async (fileId: number) => {
    setOpeningId(fileId);
    try {
      const response = await quotationUploadsApi.view(fileId);
      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to open PDF");
    } finally {
      setOpeningId(null);
    }
  };

  const filteredFiles = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return files;
    return files.filter((file) =>
      [file.filename, file.username || "", file.full_name || ""]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [files, search]);

  const columns: TableProps<UploadedFileReviewRow>["columns"] = [
    {
      title: "Uploaded By",
      key: "uploaded_by",
      width: 220,
      render: (_, row) => (
        <div>
          <div>{row.full_name || row.username || "-"}</div>
          <Typography.Text type="secondary">{row.username || "-"}</Typography.Text>
        </div>
      ),
    },
    {
      title: "Filename",
      dataIndex: "filename",
    },
    {
      title: "File Size",
      dataIndex: "file_size",
      width: 120,
      render: (value: number) => formatFileSize(value),
    },
    {
      title: "Uploaded At",
      dataIndex: "uploaded_at",
      width: 180,
      render: (value: string) => new Date(value).toLocaleString("th-TH"),
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      render: (_, row) => (
        <Button
          icon={<EyeOutlined />}
          loading={openingId === row.id}
          onClick={() => openPdf(row.id)}
        >
          Open PDF
        </Button>
      ),
    },
  ];

  if (!isAllowed) {
    return <Typography.Text type="danger">You do not have permission to view this page.</Typography.Text>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Uploaded Quotation Files</Typography.Title>
          <Typography.Text type="secondary">
            Review all raw quotation PDFs uploaded by sale upload users.
          </Typography.Text>
        </div>
        <Space>
          <Input.Search
            placeholder="Search uploader / filename"
            allowClear
            style={{ width: 280 }}
            onSearch={setSearch}
            onChange={(event) => setSearch(event.target.value)}
            value={search}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredFiles}
        loading={loading}
        size="small"
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}
