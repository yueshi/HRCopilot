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
import "../styles/AuthPages.css";

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
    <div className="auth-container-transparent">
      <Card className="auth-card-glass">
        <div className="auth-header">
          <h1 className="auth-title">HRCopilot</h1>
          <p className="auth-subtitle">智能 HR 助手平台</p>
        </div>

        <Form
          form={form}
          className="auth-form"
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
              className="auth-alert"
              message={error}
              type="error"
              closable
              onClose={clearError}
            />
          )}

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              className="auth-primary-button"
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div className="auth-link-text">
          还没有账号？ <Link to="/register" className="auth-link">立即注册</Link>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
