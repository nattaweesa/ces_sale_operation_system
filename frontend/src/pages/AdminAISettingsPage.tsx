import { useEffect, useState } from "react";
import { Alert, Button, Card, Checkbox, Form, Input, Space, Typography, message } from "antd";
import { SaveOutlined, ApiOutlined, ThunderboltOutlined } from "@ant-design/icons";

import { aiSettingsApi } from "../api";

const { Title, Text } = Typography;

type FormValues = {
  model: string;
  api_key?: string;
  clear_api_key?: boolean;
};

export default function AdminAISettingsPage() {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState<string | null>(null);
  const [updatedMeta, setUpdatedMeta] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await aiSettingsApi.get();
      const data = res.data;
      form.setFieldsValue({ model: data.model, api_key: "", clear_api_key: false });
      setHasApiKey(!!data.has_api_key);
      setMaskedApiKey(data.api_key_masked || null);

      if (data.updated_at) {
        const by = data.updated_by_name ? ` โดย ${data.updated_by_name}` : "";
        setUpdatedMeta(`อัปเดตล่าสุด: ${new Date(data.updated_at).toLocaleString("th-TH")}${by}`);
      } else {
        setUpdatedMeta("ยังไม่เคยตั้งค่าผ่านหน้า Admin AI Settings");
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || "โหลดค่า AI Settings ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const normalizedApiKey = values.api_key?.trim() || "";
      const shouldClearApiKey = !!values.clear_api_key && !normalizedApiKey;

      await aiSettingsApi.update({
        model: values.model.trim(),
        api_key: normalizedApiKey || undefined,
        clear_api_key: shouldClearApiKey,
      });
      message.success("บันทึก AI Settings สำเร็จ");
      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || "บันทึก AI Settings ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const res = await aiSettingsApi.test();
      message.success(res.data.detail || "ทดสอบเชื่อมต่อสำเร็จ");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || "ทดสอบเชื่อมต่อไม่สำเร็จ");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ marginBottom: 6 }}>AI Settings (Admin)</Title>
        <Text type="secondary">ตั้งค่า Model และ API Key สำหรับ CES AI Assistant (Minimax)</Text>
      </div>

      <Card loading={loading}>
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="ความปลอดภัย"
            description="API Key จะถูกจัดเก็บฝั่ง backend เท่านั้น และจะแสดงแบบ mask บนหน้านี้"
          />

          <div>
            <Text strong>สถานะ API Key ปัจจุบัน:</Text>{" "}
            <Text>{hasApiKey ? `ตั้งค่าแล้ว (${maskedApiKey || "masked"})` : "ยังไม่ได้ตั้งค่า"}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{updatedMeta}</Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={onSave}
            onValuesChange={(changedValues, allValues) => {
              if (typeof changedValues.api_key === "string" && changedValues.api_key.trim() && allValues.clear_api_key) {
                form.setFieldValue("clear_api_key", false);
              }
            }}
          >
            <Form.Item
              label="Model"
              name="model"
              rules={[{ required: true, message: "กรุณาใส่ชื่อ model" }]}
              tooltip="เช่น MiniMax-M2.7-highspeed"
            >
              <Input placeholder="MiniMax-M2.7-highspeed" prefix={<ApiOutlined />} />
            </Form.Item>

            <Form.Item
              label="API Key (ปล่อยว่างได้ ถ้าไม่ต้องการเปลี่ยน)"
              name="api_key"
              tooltip="ถ้าไม่กรอก จะคงค่าเดิมไว้"
            >
              <Input.Password placeholder="sk-..." />
            </Form.Item>

            <Form.Item name="clear_api_key" valuePropName="checked">
              <Checkbox>ลบ API Key เดิม (ถ้าติ๊ก ระบบ AI Chat จะใช้งานไม่ได้จนกว่าจะใส่ key ใหม่)</Checkbox>
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                บันทึก Settings
              </Button>
              <Button icon={<ThunderboltOutlined />} onClick={onTest} loading={testing}>
                ทดสอบการเชื่อมต่อ
              </Button>
            </Space>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
