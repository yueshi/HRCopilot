import React from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  Space,
  Alert,
} from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { WindowState } from "@/shared/types/ipc";

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, error, clearError, isLoading } = useAuthStore();
  const [form] = Form.useForm();

  const onFinish = async (values: { email: string; password: string }) => {
    clearError();
    try {
      await login(values.email, values.password);
      message.success("登录成功");
      await (window as any).electronAPI?.window?.transitionState?.(
        WindowState.MAIN_ONLY,
      );
      navigate("/home");
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "20px",
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
          borderRadius: "12px",
        }}
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <Title level={2} style={{ margin: 0, color: "#1890ff" }}>
              ResumerHelper
            </Title>
            <Text type="secondary">智能简历匹配分析平台</Text>
          </div>

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: "请输入邮箱" },
                { type: "email", message: "请输入有效的邮箱地址" },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="邮箱地址" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>

            {error && (
              <Alert
                message={error}
                type="error"
                closable
                onClose={clearError}
                style={{ marginBottom: 16 }}
              />
            )}

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                block
                style={{ height: "40px" }}
              >
                登录
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: "center" }}>
            <Text>
              还没有账号？{" "}
              <Link to="/register" style={{ color: "#1890ff" }}>
                立即注册
              </Link>
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
