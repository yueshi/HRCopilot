import React from "react";
import { Form, Input, Button, Card, message } from "antd";
import { useNavigate } from "react-router-dom";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuthStore } from "../store/authStore";

const CloudLoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { cloudAuthLogin } = useAuthStore();

  const handleLogin = async (values: { username: string; password: string }) => {
    try {
      await cloudAuthLogin(values.username, values.password);
      message.success("云端登录成功");
      navigate("/home");
    } catch (error) {
      message.error("登录失败");
      console.error(error);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, marginBottom: 8 }}>云端登录</h2>
          <p style={{ margin: 0, color: "#666" }}>使用云端账号登录 HRCopilot</p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleLogin}
          autoComplete="off"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
            >
              登录
            </Button>
          </Form.Item>

          <div style={{ textAlign: "center" }}>
            <Button
              type="link"
              onClick={() => navigate("/login")}
              style={{ padding: 0 }}
            >
              返回本地登录
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default CloudLoginPage;
