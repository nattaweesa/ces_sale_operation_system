import { useEffect, useState } from "react";
import { Button, Card, Input, Popconfirm, Space, Table, Tag, Typography, Upload, message } from "antd";
import type { UploadProps } from "antd";
import { DeleteOutlined, ReloadOutlined, UploadOutlined } from "@ant-design/icons";
import { aiKnowledgeApi, type AIKnowledgeDocumentOut } from "../api";

export default function AIKnowledgePage() {
  const [rows, setRows] = useState<AIKnowledgeDocumentOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await aiKnowledgeApi.listDocuments();
      setRows(res.data || []);
    } catch {
      message.error("โหลดรายการเอกสารไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const uploadProps: UploadProps = {
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      const name = (file.name || "").toLowerCase();
      const ok = [".pdf", ".txt", ".md", ".csv", ".json", ".yaml", ".yml"].some((ext) => name.endsWith(ext));
      if (!ok) {
        message.error("รองรับไฟล์ PDF/TXT/MD/CSV/JSON/YAML เท่านั้น");
      }
      return ok ? true : Upload.LIST_IGNORE;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file as File);
        if (title.trim()) form.append("title", title.trim());
        await aiKnowledgeApi.uploadDocument(form);
        message.success("อัปโหลดและเพิ่มเข้า AI Knowledge แล้ว");
        setTitle("");
        onSuccess?.({}, new XMLHttpRequest());
        await load();
      } catch (error: any) {
        message.error(error?.response?.data?.detail || "อัปโหลดไม่สำเร็จ");
        onError?.(error);
      } finally {
        setUploading(false);
      }
    },
  };

  const deactivate = async (id: number) => {
    try {
      await aiKnowledgeApi.deactivateDocument(id);
      message.success("ปิดใช้งานเอกสารแล้ว");
      await load();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "ปิดใช้งานไม่สำเร็จ");
    }
  };

  return (
    <div>
      <Card
        title={<Typography.Title level={4} style={{ margin: 0 }}>AI Knowledge</Typography.Title>}
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          อัปโหลดคู่มือ/เอกสาร เพื่อให้ AI Assistant นำไปตอบคำถามได้ (PDF/TXT/MD/CSV/JSON/YAML)
        </Typography.Paragraph>

        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Title (optional)"
            style={{ width: 320 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
          />
          <Upload {...uploadProps} disabled={uploading}>
            <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
              Upload Document
            </Button>
          </Upload>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "Title",
              dataIndex: "title",
              width: 260,
            },
            {
              title: "Source File",
              dataIndex: "source_filename",
              width: 220,
            },
            {
              title: "Chars",
              dataIndex: "content_chars",
              width: 110,
              render: (v: number) => v.toLocaleString("en-US"),
            },
            {
              title: "Uploaded By",
              dataIndex: "uploaded_by_name",
              width: 180,
              render: (v: string) => v || "-",
            },
            {
              title: "Status",
              dataIndex: "is_active",
              width: 120,
              render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "Active" : "Inactive"}</Tag>,
            },
            {
              title: "Created",
              dataIndex: "created_at",
              width: 180,
              render: (v: string) => new Date(v).toLocaleString("th-TH"),
            },
            {
              title: "Action",
              key: "action",
              width: 120,
              render: (_: any, row: AIKnowledgeDocumentOut) => (
                row.is_active ? (
                  <Popconfirm title="ปิดใช้งานเอกสารนี้?" onConfirm={() => deactivate(row.id)}>
                    <Button danger size="small" icon={<DeleteOutlined />}>Disable</Button>
                  </Popconfirm>
                ) : null
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
