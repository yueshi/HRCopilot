import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Descriptions,
  Button,
  Form,
  Input,
  message,
  Space,
  Typography,
  Tag,
} from "antd";
import { LockOutlined, UserOutlined, MailOutlined, IdcardOutlined } from "@ant-design/icons";
import { useAuthStore } from "../store/authStore";

const { Title } = Typography;

const ProfilePage: React.FC = () => {
  // 使用选择器模式订阅状态
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const changePassword = useAuthStore((state) => state.changePassword);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [passwordForm] = Form.useForm();
  const [profileForm] = Form.useForm();

  const [isEditing, setIsEditing] = useState(false);
  const formInitializedRef = useRef(false);

  console.log('[ProfilePage] render, user:', user, 'isEditing:', isEditing);

  // 当用户信息变化时，同步表单值
  useEffect(() => {
    console.log('[ProfilePage] useEffect - user:', user);
    if (user) {
      profileForm.setFieldsValue({
        name: user.name,
      });
      formInitializedRef.current = true;
    }
  }, [user?.id, user?.name]); // 只在用户ID或名称变化时更新

  // 当进入编辑模式时，确保表单值是最新的
  useEffect(() => {
    console.log('[ProfilePage] isEditing changed:', isEditing);
    if (isEditing && user) {
      profileForm.setFieldsValue({
        name: user.name,
      });
    }
  }, [isEditing]);

  const handleUpdateProfile = async () => {
    console.log('[ProfilePage] handleUpdateProfile');
    try {
      const values = await profileForm.validateFields();
      console.log('[ProfilePage] values:', values);
      await updateProfile(values);
      message.success("个人信息更新成功");
      setIsEditing(false);
    } catch (error) {
      console.error("更新个人信息失败:", error);
    }
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      await changePassword(values.currentPassword, values.newPassword);
      message.success("密码修改成功");
      passwordForm.resetFields();
    } catch (error) {
      console.error("修改密码失败:", error);
    }
  };

  const handleCancelEdit = () => {
    console.log('[ProfilePage] handleCancelEdit');
    // 重置表单为当前用户值
    if (user) {
      profileForm.setFieldsValue({
        name: user.name,
      });
    }
    setIsEditing(false);
  };

  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case "free":
        return <Tag color="default">免费用户</Tag>;
      case "vip":
        return <Tag color="gold">VIP 用户</Tag>;
      case "admin":
        return <Tag color="red">管理员</Tag>;
      default:
        return <Tag color="default">免费用户</Tag>;
    }
  };

  console.log('[ProfilePage] rendering, user exists:', !!user, 'user:', user);

  if (!user) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Title level={3}>用户详情</Title>

      {/* 个人信息卡片 */}
      <Card
        title="个人信息"
        style={{ marginBottom: 24 }}
        extra={
          <Space>
            {!isEditing ? (
              <Button type="primary" onClick={() => setIsEditing(true)}>
                编辑
              </Button>
            ) : (
              <Space>
                <Button onClick={handleCancelEdit}>取消</Button>
                <Button type="primary" onClick={handleUpdateProfile} loading={isLoading}>
                  保存
                </Button>
              </Space>
            )}
          </Space>
        }
      >
        {!isEditing ? (
          // 查看模式：显示所有信息
          <Descriptions bordered column={1}>
            <Descriptions.Item label="用户 ID">{user.id}</Descriptions.Item>
            <Descriptions.Item label="用户名">{user.name}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
            <Descriptions.Item label="账户类型">{getUserTypeLabel(user.userType)}</Descriptions.Item>
          </Descriptions>
        ) : (
          // 编辑模式：只显示可编辑的用户名
          <Space direction="vertical" style={{ width: "100%" }}>
            {/* 不可编辑的字段：只读显示 */}
            <div>
              <div style={{ color: "#666", marginBottom: 8 }}>用户 ID</div>
              <Input
                value={user.id}
                disabled
                prefix={<IdcardOutlined />}
                style={{ marginBottom: 16 }}
              />
            </div>

            <div>
              <div style={{ color: "#666", marginBottom: 8 }}>邮箱</div>
              <Input
                value={user.email}
                disabled
                prefix={<MailOutlined />}
                style={{ marginBottom: 16 }}
              />
            </div>

            <div>
              <div style={{ color: "#666", marginBottom: 8 }}>账户类型</div>
              <div style={{ marginBottom: 16 }}>{getUserTypeLabel(user.userType)}</div>
            </div>

            {/* 可编辑的字段：用户名 */}
            <Form form={profileForm} layout="vertical">
              <Form.Item
                label="用户名"
                name="name"
                rules={[{ required: true, message: "请输入用户名" }]}
              >
                <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Card>

      {/* 修改密码卡片 */}
      <Card title="修改密码">
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
        >
          <Form.Item
            label="当前密码"
            name="currentPassword"
            rules={[{ required: true, message: "请输入当前密码" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 6, message: "密码长度至少 6 位" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "请确认新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={isLoading} block>
              修改密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ProfilePage;
