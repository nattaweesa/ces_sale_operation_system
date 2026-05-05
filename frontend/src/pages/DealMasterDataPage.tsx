import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  customersApi,
  dealMasterDataApi,
  DealMasterDataBundle,
  DealMasterDataCESStage,
  DealMasterDataCompany,
  DealMasterDataCustomerType,
  DealMasterDataProductSystemType,
  DealMasterDataProjectStatus,
  projectsApi,
} from "../api";

type ModalType = "customer-type" | "company" | "product-system" | "project-status" | "ces-stage" | "project" | null;

export default function DealMasterDataPage() {
  const [data, setData] = useState<DealMasterDataBundle>({
    customer_types: [],
    companies: [],
    product_system_types: [],
    project_statuses: [],
    ces_stages: [],
  });
  const [projectRows, setProjectRows] = useState<any[]>([]);
  const [customerRows, setCustomerRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [masterRes, projectsRes, customersRes] = await Promise.all([
        dealMasterDataApi.overview(),
        projectsApi.list(),
        customersApi.list(),
      ]);
      setData(masterRes.data);
      setProjectRows(projectsRes.data || []);
      setCustomerRows(customersRes.data || []);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to load deal master data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openModal = (type: ModalType, record?: any) => {
    setModalType(type);
    setEditingRecord(record || null);
    form.resetFields();
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.setFieldsValue(type === "project" ? { status: "active" } : { sort_order: 0, is_active: true });
    }
  };

  const closeModal = () => {
    setModalType(null);
    setEditingRecord(null);
    form.resetFields();
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (modalType === "customer-type") {
        if (editingRecord) await dealMasterDataApi.updateCustomerType(editingRecord.id, values);
        else await dealMasterDataApi.createCustomerType(values);
      }
      if (modalType === "company") {
        if (editingRecord) await dealMasterDataApi.updateCompany(editingRecord.id, values);
        else await dealMasterDataApi.createCompany(values);
      }
      if (modalType === "product-system") {
        if (editingRecord) await dealMasterDataApi.updateProductSystemType(editingRecord.id, values);
        else await dealMasterDataApi.createProductSystemType(values);
      }
      if (modalType === "project-status") {
        if (editingRecord) await dealMasterDataApi.updateProjectStatus(editingRecord.id, values);
        else await dealMasterDataApi.createProjectStatus(values);
      }
      if (modalType === "ces-stage") {
        if (editingRecord) await dealMasterDataApi.updateCESStage(editingRecord.id, values);
        else await dealMasterDataApi.createCESStage(values);
      }
      if (modalType === "project") {
        if (editingRecord) await projectsApi.update(editingRecord.id, values);
        else await projectsApi.create(values);
      }
      message.success(editingRecord ? "Updated" : "Created");
      closeModal();
      load();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Unable to save master data");
    }
  };

  const customerTypeOptions = data.customer_types.map((item) => ({ value: item.id, label: item.name }));

  const renderState = (value: boolean) => (value ? <Tag color="green">ACTIVE</Tag> : <Tag>INACTIVE</Tag>);

  const modalTitleMap: Record<Exclude<ModalType, null>, string> = {
    "customer-type": editingRecord ? "Edit Customer Type" : "New Customer Type",
    company: editingRecord ? "Edit Company" : "New Company",
    "product-system": editingRecord ? "Edit Product/System Type" : "New Product/System Type",
    "project-status": editingRecord ? "Edit Project Status" : "New Project Status",
    "ces-stage": editingRecord ? "Edit CES Stage" : "New CES Stage",
    "project": editingRecord ? "Edit Project" : "New Project",
  };

  const customerOptions = customerRows.map((item: any) => ({ value: item.id, label: item.name }));

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Deal Master Data</Typography.Title>
          <Typography.Text type="secondary">
            Manage customer type, company, product/system type, and project status options for deal entry.
          </Typography.Text>
        </div>
        <Button onClick={load} loading={loading}>Refresh</Button>
      </div>

      <Card
        title="Customer Types"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal("customer-type")}>New</Button>}
      >
        <Table<DealMasterDataCustomerType>
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          dataSource={data.customer_types}
          columns={[
            { title: "Name", dataIndex: "name" },
            { title: "Sort", dataIndex: "sort_order", width: 90 },
            { title: "Status", dataIndex: "is_active", width: 110, render: renderState },
            {
              title: "",
              width: 80,
              render: (_: unknown, record) => <Button icon={<EditOutlined />} size="small" onClick={() => openModal("customer-type", record)} />,
            },
          ]}
        />
      </Card>

      <Card
        title="Companies"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal("company")}>New</Button>}
      >
        <Table<DealMasterDataCompany>
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
          dataSource={data.companies}
          columns={[
            { title: "Company", dataIndex: "name" },
            { title: "Customer Type", dataIndex: "customer_type_name", width: 180 },
            { title: "CRM Customer", dataIndex: "customer_name", width: 220 },
            { title: "Sort", dataIndex: "sort_order", width: 90 },
            { title: "Status", dataIndex: "is_active", width: 110, render: renderState },
            {
              title: "",
              width: 80,
              render: (_: unknown, record) => <Button icon={<EditOutlined />} size="small" onClick={() => openModal("company", record)} />,
            },
          ]}
        />
      </Card>

      <Card
        title="Product/System Types"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal("product-system")}>New</Button>}
      >
        <Table<DealMasterDataProductSystemType>
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          dataSource={data.product_system_types}
          columns={[
            { title: "Name", dataIndex: "name" },
            { title: "Parent", dataIndex: "parent_name", width: 200, render: (v: string | null) => v || <span style={{ color: "#999" }}>—</span> },
            { title: "Sort", dataIndex: "sort_order", width: 90 },
            { title: "Status", dataIndex: "is_active", width: 110, render: renderState },
            {
              title: "",
              width: 80,
              render: (_: unknown, record) => <Button icon={<EditOutlined />} size="small" onClick={() => openModal("product-system", record)} />,
            },
          ]}
        />
      </Card>

      <Card
        title="Project Status Options"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal("project-status")}>New</Button>}
      >
        <Table<DealMasterDataProjectStatus>
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          dataSource={data.project_statuses}
          columns={[
            { title: "Label", dataIndex: "label" },
            { title: "Key", dataIndex: "key", width: 180 },
            { title: "Sort", dataIndex: "sort_order", width: 90 },
            { title: "Status", dataIndex: "is_active", width: 110, render: renderState },
            {
              title: "",
              width: 80,
              render: (_: unknown, record) => <Button icon={<EditOutlined />} size="small" onClick={() => openModal("project-status", record)} />,
            },
          ]}
        />
      </Card>

      <Card
        title="CES Stages"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal("ces-stage")}>New</Button>}
      >
        <Table<DealMasterDataCESStage>
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          dataSource={data.ces_stages}
          columns={[
            { title: "Label", dataIndex: "label" },
            { title: "Key", dataIndex: "key", width: 180 },
            { title: "Sort", dataIndex: "sort_order", width: 90 },
            { title: "Status", dataIndex: "is_active", width: 110, render: renderState },
            {
              title: "",
              width: 80,
              render: (_: unknown, record) => <Button icon={<EditOutlined />} size="small" onClick={() => openModal("ces-stage", record)} />,
            },
          ]}
        />
      </Card>

      <Card
        title="Projects"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal("project")}>New</Button>}
      >
        <Table
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
          dataSource={projectRows}
          columns={[
            { title: "Project", dataIndex: "name" },
            { title: "Customer", dataIndex: "customer_name", width: 220 },
            { title: "Location", dataIndex: "location", width: 180 },
            { title: "Status", dataIndex: "status", width: 120 },
            {
              title: "",
              width: 80,
              render: (_: unknown, record: any) => <Button icon={<EditOutlined />} size="small" onClick={() => openModal("project", record)} />,
            },
          ]}
        />
      </Card>

      <Modal
        open={modalType !== null}
        title={modalType ? modalTitleMap[modalType] : ""}
        onCancel={closeModal}
        onOk={save}
        okText="Save"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          {modalType === "customer-type" && (
            <>
              <Form.Item name="name" label="Customer Type" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="sort_order" label="Sort Order">
                <InputNumber style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </>
          )}

          {modalType === "company" && (
            <>
              <Form.Item name="customer_type_id" label="Customer Type" rules={[{ required: true }]}>
                <Select options={customerTypeOptions} />
              </Form.Item>
              <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="sort_order" label="Sort Order">
                <InputNumber style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </>
          )}

          {modalType === "product-system" && (
            <>
              <Form.Item name="name" label="Product/System Type" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="parent_id" label="Parent (optional)" tooltip="Leave blank for top-level. Only top-level types can be parents.">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="None (top-level)"
                  options={data.product_system_types
                    .filter((row) => row.parent_id === null && row.id !== editingRecord?.id)
                    .map((row) => ({ value: row.id, label: row.name }))}
                />
              </Form.Item>
              <Form.Item name="sort_order" label="Sort Order">
                <InputNumber style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </>
          )}

          {modalType === "project-status" && (
            <>
              <Form.Item name="label" label="Status Label" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="key" label="Status Key">
                <Input placeholder="auto-generated if left blank" />
              </Form.Item>
              <Form.Item name="sort_order" label="Sort Order">
                <InputNumber style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </>
          )}

          {modalType === "ces-stage" && (
            <>
              <Form.Item name="label" label="Stage Label" rules={[{ required: true }]}> 
                <Input />
              </Form.Item>
              <Form.Item name="key" label="Stage Key">
                <Input placeholder="auto-generated if left blank" />
              </Form.Item>
              <Form.Item name="sort_order" label="Sort Order">
                <InputNumber style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </>
          )}

          {modalType === "project" && (
            <>
              <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}> 
                <Select options={customerOptions} showSearch optionFilterProp="label" />
              </Form.Item>
              <Form.Item name="name" label="Project Name" rules={[{ required: true }]}> 
                <Input />
              </Form.Item>
              <Form.Item name="location" label="Location">
                <Input />
              </Form.Item>
              <Form.Item name="status" label="Status" initialValue="active">
                <Select
                  options={[
                    { value: "active", label: "Active" },
                    { value: "won", label: "Won" },
                    { value: "lost", label: "Lost" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="description" label="Notes">
                <Input.TextArea rows={3} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Space>
  );
}