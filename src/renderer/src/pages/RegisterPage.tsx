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
import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { WindowState } from "@/shared/types/ipc";
import "../styles/AuthPages.css";

const { Title, Text } = Typography;

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, error, clearError, isLoading } = useAuthStore();
  const [form] = Form.useForm();

  const onFinish = async (values: {
    email: string;
    password: string;
    name: string;
  }) => {
    clearError();
    try {
      await register(values.email, values.password, values.name);
      message.success("注册成功");
      await (window as any).electronAPI?.window?.transitionState?.(
        WindowState.MAIN_ONLY,
      );
      navigate("/home");
    } catch (error) {
      console.error("Register error:", error);
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
          name="register"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="name"
            rules={[
              { required: true, message: "请输入用户名" },
              { min: 2, message: "用户名至少2个字符" },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

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
            rules={[
              { required: true, message: "请输入密码" },
              { min: 8, message: "密码至少8位" },
              {
                pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
                message: "密码需包含字母和数字",
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码（至少8位，包含字母和数字）"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={["password"]}
            rules={[
              { required: true, message: "请确认密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="确认密码"
            />
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
              注册
            </Button>
          </Form.Item>
        </Form>

        <div className="auth-link-text">
          已有账号？ <Link to="/login" className="auth-link">立即登录</Link>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
