import { useEffect, useMemo, useState } from "react";
import { Card, Col, Row, Table, Tag, Typography, message } from "antd";
import { useParams } from "react-router-dom";
import { masterDataApi } from "../api";

export default function MasterDataBatchDetailPage() {
  const { batchId } = useParams();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const classStats = useMemo(() => {
    const out: Record<string, number> = {};
    for (const row of detail?.normalized_lines || []) {
      out[row.classification] = (out[row.classification] || 0) + 1;
    }
    return out;
  }, [detail]);

  const load = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const res = await masterDataApi.getBatchDetail(Number(batchId));
      setDetail(res.data);
    } catch {
      message.error("Unable to load batch detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [batchId]);

  return (
    <div>
      <Typography.Title level={4}>Module 1 - Batch Detail #{batchId}</Typography.Title>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} md={8}><Card title="Batch Status">{detail?.batch?.status || "-"}</Card></Col>
        <Col xs={24} md={8}><Card title="Documents">{detail?.documents?.length || 0}</Card></Col>
        <Col xs={24} md={8}><Card title="Raw Lines">{detail?.raw_lines?.length || 0}</Card></Col>
      </Row>

      <Card title="Classification Summary" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          {Object.entries(classStats).map(([k, v]) => (
            <Col key={k}><Tag color={k === "catalog_product" ? "green" : "blue"}>{k}: {v}</Tag></Col>
          ))}
        </Row>
      </Card>

      <Card title="Document Headers" style={{ marginBottom: 12 }}>
        <Table
          loading={loading}
          dataSource={detail?.headers || []}
          rowKey={(r: any) => `${r.quotation_number || ""}-${r.project_name || ""}-${r.quote_date_text || ""}`}
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "Quotation #", dataIndex: "quotation_number" },
            { title: "Project", dataIndex: "project_name" },
            { title: "Date", dataIndex: "quote_date_text" },
            { title: "Subject", dataIndex: "subject", ellipsis: true },
          ]}
        />
      </Card>

      <Card title="Normalized Lines">
        <Table
          loading={loading}
          dataSource={detail?.normalized_lines || []}
          rowKey="id"
          size="small"
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 25 }}
          columns={[
            { title: "Raw Line", dataIndex: "raw_line_id", width: 90 },
            { title: "Class", dataIndex: "classification", width: 130, render: (v: string) => <Tag color={v === "catalog_product" ? "green" : "default"}>{v}</Tag> },
            { title: "Item Code", dataIndex: "item_code_norm", width: 150 },
            { title: "Description", dataIndex: "description_norm", ellipsis: true },
            { title: "Brand", dataIndex: "brand_norm", width: 140 },
            { title: "List Price", dataIndex: "list_price_norm", width: 120 },
            { title: "Qty", dataIndex: "qty_norm", width: 80 },
            { title: "Uncertain", dataIndex: "uncertain", width: 90, render: (v: boolean) => v ? <Tag color="orange">YES</Tag> : <Tag color="green">NO</Tag> },
            { title: "Notes", dataIndex: "normalize_notes", width: 220, ellipsis: true },
          ]}
        />
      </Card>
    </div>
  );
}
