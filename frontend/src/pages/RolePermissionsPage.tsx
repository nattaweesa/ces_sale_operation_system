import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import { SaveOutlined } from "@ant-design/icons";

import { rolePermissionsApi } from "../api";

type CatalogPermission = {
  permission_key: string;
  label: string;
};

type RolePermission = {
  permission_key: string;
  is_allowed: boolean;
};

export default function RolePermissionsPage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState<CatalogPermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [rows, setRows] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const rowsMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const row of rows) map[row.permission_key] = row.is_allowed;
    return map;
  }, [rows]);

  const loadCatalog = async () => {
    const res = await rolePermissionsApi.catalog();
    setRoles(res.data.roles || []);
    setPermissionsCatalog(res.data.permissions || []);
    if (res.data.roles?.length && !res.data.roles.includes(selectedRole)) {
      setSelectedRole(res.data.roles[0]);
    }
  };

  const loadRolePermissions = async (role: string) => {
    setLoading(true);
    try {
      const res = await rolePermissionsApi.getByRole(role);
      setRows(res.data.permissions || []);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Failed to load role permissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await loadCatalog();
      } catch (error: any) {
        message.error(error?.response?.data?.detail || "Failed to load permission catalog");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRole) return;
    loadRolePermissions(selectedRole);
  }, [selectedRole]);

  const onToggle = (permissionKey: string, next: boolean) => {
    setRows((prev) =>
      prev.map((item) =>
        item.permission_key === permissionKey
          ? { ...item, is_allowed: next }
          : item
      )
    );
  };

  const onSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await rolePermissionsApi.updateByRole(selectedRole, rows);
      message.success("Permissions updated");
      await loadRolePermissions(selectedRole);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || "Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }} align="start">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Role Permissions</Typography.Title>
          <Typography.Text type="secondary">
            Configure what each role can see across the system. Defaults are pre-defined and can be overridden here.
          </Typography.Text>
        </div>
        <Space>
          <Select
            style={{ minWidth: 180 }}
            value={selectedRole}
            onChange={setSelectedRole}
            options={roles.map((role) => ({ value: role, label: role.toUpperCase() }))}
          />
          <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saving}>
            Save
          </Button>
        </Space>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Long-term RBAC"
        description="Use this page to customize role visibility without changing code. Admin can update and apply permission overrides anytime."
      />

      <Card>
        <Table
          rowKey="permission_key"
          dataSource={permissionsCatalog.map((p) => ({
            permission_key: p.permission_key,
            label: p.label,
            is_allowed: rowsMap[p.permission_key] ?? false,
          }))}
          loading={loading}
          pagination={false}
          size="small"
          columns={[
            {
              title: "Permission Key",
              dataIndex: "permission_key",
              width: 260,
              render: (v: string) => <Tag>{v}</Tag>,
            },
            {
              title: "Description",
              dataIndex: "label",
            },
            {
              title: "Allowed",
              width: 120,
              render: (_: any, r: any) => (
                <Switch checked={!!r.is_allowed} onChange={(next) => onToggle(r.permission_key, next)} />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
