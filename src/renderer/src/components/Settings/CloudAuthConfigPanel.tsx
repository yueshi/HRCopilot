import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  Switch,
  Button,
  Card,
  message,
  Space,
  Divider,
  Typography,
} from "antd";
import { CloudAuthApi } from "../services/cloudAuthIpcService";

const { Title, Text } = Typography;

interface CloudAuthConfig {
  apiUrl: string;
  enabled: boolean;
}

export const CloudAuthConfigPanel: React.FC = () => {
  const [form] = Form.useForm<CloudAuthConfig>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const config = await window.electron.cloudAuth.getConfig();
      form.setFieldsValue({
        apiUrl: config.data?.apiUrl || "https://api.example.com",
        enabled: config.data?.enabled || false,
      });
    } catch (error) {
      message.error("加载云端认证配置失败");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // 保存配置到数据库
      await window.electron.cloudAuth.saveConfig(values);

      // 重新加载云服务配置
      await window.electron.cloudAuth.reloadConfig();

      message.success("云端认证配置保存成功");
    } catch (error) {
      message.error("保存云端认证配置失败");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setLoading(true);
      const result = await window.electron.cloudAuth.isAvailable();
      if (result.data) {
        message.success("云端认证服务连接正常");
      } else {
        message.warning("云端认证服务未配置或未启用");
      }
    } catch (error) {
      message.error("测试云端认证连接失败");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px" }}>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Title level={4}>云端认证配置</Title>
            <Text type="secondary">
              配置云端 API 服务，实现云端账号登录功能
            </Text>
          </div>

          <Divider />

          <Form
            form={form}
            layout="vertical"
            initialValues={{
              apiUrl: "https://api.example.com",
              enabled: false,
            }}
          >
            <Form.Item
              label="启用云端登录"
              name="enabled"
              valuePropName="checked"
              tooltip="启用后，用户可以使用云端账号登录"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              label="API 地址"
              name="apiUrl"
              rules={[
                { required: true, message: "请输入 API 地址" },
                {
                  type: "url",
                  message: "请输入有效的 URL 地址",
                },
              ]}
              tooltip="云端 API 服务的基础地址"
            >
              <Input placeholder="https://api.example.com" />
            </Form.Item>
          </Form>

          <Divider />

          <Space>
            <Button type="primary" onClick={handleSave} loading={loading}>
              保存配置
            </Button>
            <Button onClick={handleTestConnection} loading={loading}>
              测试连接
            </Button>
          </Space>
        </Space>
      </Card>

      <Card style={{ marginTop: "16px" }}>
        <Title level={5}>配置说明</Title>
        <ul style={{ lineHeight: "1.8" }}>
          <li>
            <Text>
              <strong>API 地址</strong>: 云端 API 服务的基础地址，例如 {" "}
              https://api.example.com
            </Text>
          </li>
          <li>
            <Text>
              <strong>启用云端登录</strong>: 开启后用户可以使用云端账号登录应用
            </Text>
          </li>
        </ul>

        <Title level={5} style={{ marginTop: "16px" }}>
          API 接口要求
        </Title>
        <ul style={{ lineHeight: "1.8" }}>
          <li>
            <Text>
              <code>POST /api/auth/login</code>: 登录接口，接收 username 和{" "}
              password
            </Text>
          </li>
          <li>
            <Text>
              <code>GET /api/user/info</code>: 获取用户信息接口，需要携带{" "}
              Authorization: Bearer {"{token}"}
            </Text>
          </li>
        </ul>
      </Card>
    </div>
  );
};
