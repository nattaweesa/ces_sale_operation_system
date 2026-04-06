import { useEffect, useState } from "react";
import { Card, Input, Space, Table, Typography, message } from "antd";
import { masterDataApi } from "../api";

export default function MasterDataPublishedEvidencePage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [productId, setProductId] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const res = productId
        ? await masterDataApi.publishedEvidenceByProduct(Number(productId))
        : await masterDataApi.publishedEvidence();
      setRows(res.data?.items || []);
    } catch {
      message.error("Unable to load published evidence");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <Typography.Title level={4}>Module 1 - Published Product Evidence</Typography.Title>
      <Card style={{ marginBottom: 12 }}>
        <Space>
          <Input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Filter by product id" style={{ width: 220 }} />
          <a onClick={load}>Apply</a>
        </Space>
      </Card>
      <Card>
        <Table
          loading={loading}
          dataSource={rows}
          rowKey="action_id"
          size="small"
          pagination={{ pageSize: 25 }}
          columns={[
            { title: "Action ID", dataIndex: "action_id", width: 90 },
            { title: "Candidate", dataIndex: "candidate_id", width: 90 },
            { title: "Product", dataIndex: "product_id", width: 90 },
            { title: "Price", dataIndex: "selected_list_price", width: 120 },
            { title: "Reviewer", dataIndex: "reviewer_id", width: 90 },
            { title: "Timestamp", dataIndex: "created_at", width: 180 },
            { title: "Notes", dataIndex: "notes", ellipsis: true },
            { title: "Evidence", dataIndex: "evidence_json", ellipsis: true },
          ]}
        />
      </Card>
    </div>
  );
}
