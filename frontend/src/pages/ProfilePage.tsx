import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Space, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";

import { usersApi } from "../api";
import { useAuthStore } from "../store/authStore";

export default function ProfilePage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    const loadMe = async () => {
      try {
        const res = await usersApi.me();
        profileForm.setFieldsValue({
          full_name: res.data.full_name,
          email: res.data.email || "",
        });
      } catch {
        profileForm.setFieldsValue({
          full_name: user?.full_name,
          email: "",
        });
      }
    };
    loadMe();
  }, [profileForm, user?.full_name]);

  const onSaveProfile = async () => {
    try {
      const values = await profileForm.validateFields();
      setProfileLoading(true);
      const res = await usersApi.updateMe({
        full_name: values.full_name,
        email: values.email || null,
      });
      if (token && user) {
        setAuth(token, {
          ...user,
          full_name: res.data.full_name,
        });
      }
      message.success("Profile updated");
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.detail || "Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const onChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      setPasswordLoading(true);
      await usersApi.changeMyPassword({
        current_password: values.current_password,
        new_password: values.new_password,
      });
      passwordForm.resetFields();
      message.success("Password changed. Please login again.");
      logout();
      navigate("/login");
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.detail || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>My Profile</Typography.Title>
        <Typography.Text type="secondary">Manage your own account details and password.</Typography.Text>
      </div>

      <Card title="Profile Information">
        <Form
          form={profileForm}
          layout="vertical"
        >
          <Space direction="vertical" style={{ width: "100%" }} size={4}>
            <Typography.Text type="secondary">Username</Typography.Text>
            <Input value={user?.username} disabled />
          </Space>

          <Form.Item
            name="full_name"
            label="Full Name"
            style={{ marginTop: 12 }}
            rules={[{ required: true, message: "Please enter your full name" }]}
          >
            <Input placeholder="Full name" />
          </Form.Item>

          <Form.Item name="email" label="Email (optional)">
            <Input placeholder="name@example.com" />
          </Form.Item>

          <Space direction="vertical" style={{ width: "100%" }} size={4}>
            <Typography.Text type="secondary">Role</Typography.Text>
            <Input value={user?.role} disabled />
          </Space>

          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={onSaveProfile} loading={profileLoading}>Save Profile</Button>
          </div>
        </Form>
      </Card>

      <Card title="Change Password">
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 16 }}
          message="Security"
          description="Password must be at least 8 chars and include uppercase, lowercase, and digit."
        />

        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="current_password"
            label="Current Password"
            rules={[{ required: true, message: "Please enter current password" }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            name="new_password"
            label="New Password"
            rules={[
              { required: true, message: "Please enter new password" },
              { min: 8, message: "Password must be at least 8 characters" },
              { pattern: /[A-Z]/, message: "Need at least 1 uppercase letter" },
              { pattern: /[a-z]/, message: "Need at least 1 lowercase letter" },
              { pattern: /\d/, message: "Need at least 1 digit" },
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label="Confirm New Password"
            dependencies={["new_password"]}
            rules={[
              { required: true, message: "Please confirm new password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("new_password") === value) return Promise.resolve();
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Button type="primary" onClick={onChangePassword} loading={passwordLoading}>Change Password</Button>
        </Form>
      </Card>
    </div>
  );
}
