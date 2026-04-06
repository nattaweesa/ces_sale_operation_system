import { useEffect, useState } from "react";
import {
  Table, Button, Modal, Form, Input, Space, Typography, message,
  Collapse, Tag, Popconfirm,
} from "antd";
import { PlusOutlined, EditOutlined, UserAddOutlined, DeleteOutlined } from "@ant-design/icons";
import { customersApi } from "../api";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [custModal, setCustModal] = useState(false);
  const [contactModal, setContactModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [editContact, setEditContact] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [custForm] = Form.useForm();
  const [contactForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const r = await customersApi.list();
      setCustomers(r.data);
    } catch {
      message.error("Unable to load customers. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openCreateCust = () => { setEditCustomer(null); custForm.resetFields(); setCustModal(true); };
  const openEditCust = (r: any) => { setEditCustomer(r); custForm.setFieldsValue(r); setCustModal(true); };

  const saveCust = async () => {
    const v = await custForm.validateFields();
    if (editCustomer) { await customersApi.update(editCustomer.id, v); message.success("Updated"); }
    else { await customersApi.create(v); message.success("Created"); }
    setCustModal(false); load();
  };

  const openAddContact = (cust: any) => { setSelectedCustomer(cust); setEditContact(null); contactForm.resetFields(); setContactModal(true); };
  const openEditContact = (cust: any, ct: any) => { setSelectedCustomer(cust); setEditContact(ct); contactForm.setFieldsValue(ct); setContactModal(true); };

  const saveContact = async () => {
    const v = await contactForm.validateFields();
    if (editContact) { await customersApi.updateContact(selectedCustomer.id, editContact.id, v); message.success("Updated"); }
    else { await customersApi.addContact(selectedCustomer.id, v); message.success("Added"); }
    setContactModal(false); load();
  };

  const deleteContact = async (custId: number, ctId: number) => {
    await customersApi.deleteContact(custId, ctId);
    message.success("Deleted"); load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Customers</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateCust}>New Customer</Button>
      </div>

      <Table
        dataSource={customers} rowKey="id" loading={loading} size="small"
        expandable={{
          expandedRowRender: (r) => (
            <div style={{ padding: "4px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <Typography.Text strong>Contacts</Typography.Text>
                <Button size="small" icon={<UserAddOutlined />} onClick={() => openAddContact(r)}>Add Contact</Button>
              </div>
              {r.contacts.length === 0 ? <Typography.Text type="secondary">No contacts yet</Typography.Text> :
                r.contacts.map((ct: any) => (
                  <div key={ct.id} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
                    <Tag>{ct.is_primary ? "Primary" : "Contact"}</Tag>
                    <span style={{ fontWeight: 500 }}>{ct.full_name}</span>
                    {ct.title && <span style={{ color: "#888" }}>{ct.title}</span>}
                    {ct.phone && <span>{ct.phone}</span>}
                    {ct.email && <span>{ct.email}</span>}
                    <Space>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditContact(r, ct)} />
                      <Popconfirm title="Delete contact?" onConfirm={() => deleteContact(r.id, ct.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </div>
                ))
              }
            </div>
          ),
        }}
        columns={[
          { title: "Customer Name", dataIndex: "name" },
          { title: "Industry", dataIndex: "industry", width: 140 },
          { title: "Phone", dataIndex: "phone", width: 130 },
          { title: "Email", dataIndex: "email", width: 180 },
          { title: "Contacts", width: 80, align: "center" as const, render: (_: any, r: any) => r.contacts.length },
          {
            title: "", width: 80, render: (_: any, r: any) => (
              <Button size="small" icon={<EditOutlined />} onClick={() => openEditCust(r)} />
            ),
          },
        ]}
      />

      <Modal open={custModal} title={editCustomer ? "Edit Customer" : "New Customer"} onOk={saveCust} onCancel={() => setCustModal(false)} width={580} okText="Save">
        <Form form={custForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Customer Name" rules={[{ required: true }]}><Input /></Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="tax_id" label="Tax ID"><Input /></Form.Item>
            <Form.Item name="industry" label="Industry"><Input /></Form.Item>
            <Form.Item name="phone" label="Phone"><Input /></Form.Item>
            <Form.Item name="email" label="Email"><Input /></Form.Item>
          </div>
          <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="remark" label="Remark"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal open={contactModal} title={editContact ? "Edit Contact" : "Add Contact"} onOk={saveContact} onCancel={() => setContactModal(false)} okText="Save">
        <Form form={contactForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="title" label="Title"><Input placeholder="e.g. Engineer, Manager" /></Form.Item>
            <Form.Item name="phone" label="Phone"><Input /></Form.Item>
            <Form.Item name="email" label="Email"><Input /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
