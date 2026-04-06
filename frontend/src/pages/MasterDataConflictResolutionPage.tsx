import { useEffect, useMemo, useState } from "react";
import { Card, Table, Tag, Typography, message } from "antd";
import { masterDataApi } from "../api";

export default function MasterDataConflictResolutionPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const conflictRows = useMemo(
    () => rows.filter((r) => (r.suggestions?.length || 0) > 1 || r.source_classification !== "catalog_product"),
    [rows]
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await masterDataApi.listCandidates({ limit: 500 });
      setRows(res.data?.items || []);
    } catch {
      message.error("Unable to load conflict data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <Typography.Title level={4}>Module 1 - Conflict / Match Resolution</Typography.Title>
      <Card>
        <Table
          loading={loading}
          dataSource={conflictRows}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 25 }}
          columns={[
            { title: "Candidate", dataIndex: "id", width: 90 },
            { title: "Code", dataIndex: "candidate_code", width: 160 },
            { title: "Description", dataIndex: "canonical_description", ellipsis: true },
            { title: "Class", dataIndex: "source_classification", width: 140, render: (v: string) => <Tag color={v === "catalog_product" ? "green" : "orange"}>{v}</Tag> },
            { title: "Match Suggestions", width: 140, render: (_: any, r: any) => r.suggestions?.length || 0 },
            { title: "Status", dataIndex: "status", width: 130 },
          ]}
        />
      </Card>
    </div>
  );
}
