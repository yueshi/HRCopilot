import React, { useEffect, useState } from "react";
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
import { LockOutlined, MailOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { userApi } from "../services/userIpcService";
import { WindowState } from "@/shared/types/ipc";
import type { UserData } from "../../../shared/types";
import "../styles/AuthPages.css";

// 用于调试日志
const console = window.console;

const { Title, Text } = Typography;

interface LoginPageProps {
  lastLoginInfo?: { user: UserData; timestamp: number } | null;
}

const LoginPage: React.FC<LoginPageProps> = ({ lastLoginInfo: propLastLoginInfo }) => {
  const navigate = useNavigate();
  const { login, error, clearError, isLoading } = useAuthStore();
  const [form] = Form.useForm();
  const [lastLoginUser, setLastLoginUser] = useState<{ user: UserData; timestamp: number } | null>(propLastLoginInfo || null);

  useEffect(() => {
    // 如果从 props 传入，直接使用；否则从 localStorage 读取
    if (propLastLoginInfo) {
      setLastLoginUser(propLastLoginInfo);
      form.setFieldsValue({ email: propLastLoginInfo.user.email });
    } else {
      // 检查上次登录信息（30分钟内）
      console.log('[LoginPage] 检查上次登录信息');
      userApi.getLastLoginInfo().then(lastInfo => {
        console.log('[LoginPage] 上次登录信息:', lastInfo);
        if (lastInfo) {
          console.log('[LoginPage] 设置上次登录用户:', lastInfo.user.name, lastInfo.user.email);
          setLastLoginUser(lastInfo);
          form.setFieldsValue({ email: lastInfo.user.email });
        }
      }).catch(error => {
        console.error('[LoginPage] 获取上次登录信息失败:', error);
      });
    }
  }, [form, propLastLoginInfo]);

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

  // 继续使用上次登录用户（只需输入密码）
  const handleQuickLogin = async (password: string) => {
    if (!lastLoginUser) return;
    clearError();
    try {
      await login(lastLoginUser.user.email, password);
      message.success("登录成功");
      await (window as any).electronAPI?.window?.transitionState?.(
        WindowState.MAIN_ONLY,
      );
      navigate("/home");
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  // 格式化时间戳为分钟前
  const getTimeAgo = (timestamp: number): string => {
    const minutes = Math.floor((Date.now() - timestamp) / (60 * 1000));
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    return "最近活跃";
  };

  return (
    <div className="auth-container-transparent">
      <Card className="auth-card-glass">
        <div className="auth-header">
          <h1 className="auth-title">HRCopilot</h1>
          <p className="auth-subtitle">智能 HR 助手平台</p>
        </div>

        {lastLoginUser && (
          <Alert
            style={{ marginBottom: 16 }}
            message={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClockCircleOutlined />
                {lastLoginUser.user.name} ({lastLoginUser.user.email})
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {getTimeAgo(lastLoginUser.timestamp)}
                </Text>
              </span>
            }
            type="info"
            showIcon={false}
          />
        )}

        <Form
          form={form}
          className="auth-form"
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          {lastLoginUser ? (
            <Form.Item name="email" hidden>
              <Input />
            </Form.Item>
          ) : (
            <Form.Item
              name="email"
              rules={[
                { required: true, message: "请输入邮箱" },
                { type: "email", message: "请输入有效的邮箱地址" },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="邮箱地址" />
            </Form.Item>
          )}

          <Form.Item
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && lastLoginUser) {
                  const formValues = form.getFieldsValue();
                  if (formValues.password) {
                    handleQuickLogin(formValues.password);
                  }
                }
              }}
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
              {lastLoginUser ? '继续登录' : '登录'}
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
