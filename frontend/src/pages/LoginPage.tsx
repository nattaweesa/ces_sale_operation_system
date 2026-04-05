import { useState } from "react";
import { Card, Form, Input, Button, Typography, Alert } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(values.username, values.password);
      const data = res.data;
      setAuth(data.access_token, {
        user_id: data.user_id,
        username: data.username,
        full_name: data.full_name,
        role: data.role,
      });
      navigate("/quotations");
    } catch {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f5" }}>
      <Card style={{ width: 360 }} bodyStyle={{ padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Typography.Title level={3} style={{ color: "#1a3a5c", marginBottom: 4 }}>CES Sale Operation</Typography.Title>
          <Typography.Text type="secondary">Sign in to continue</Typography.Text>
        </div>
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item name="username" rules={[{ required: true, message: "Username required" }]}>
            <Input prefix={<UserOutlined />} placeholder="Username" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: "Password required" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading} style={{ background: "#1a3a5c" }}>
            Sign In
          </Button>
        </Form>
      </Card>
    </div>
  );
}
