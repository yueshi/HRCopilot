import React, { useEffect, useState, useRef } from "react";
import { Card, Alert, Spin, Button, Space } from "antd";
import { ReloadOutlined, WarningOutlined } from "@ant-design/icons";
import { useAuthStore } from "../store/authStore";
import { cloudAuthApi } from "../services/cloudAuthIpcService";
import type { CloudAuthConfig } from "../../../shared/types/api";
import "../styles/EmbeddedWebPage.css";

const console = window.console;

const EmbeddedWebPage: React.FC = () => {
  const { user, isLoggedIn } = useAuthStore();
  const [cloudToken, setCloudToken] = useState<string | null>(null);
  const [cloudConfig, setCloudConfig] = useState<CloudAuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const webviewRef = useRef<any>(null);

  useEffect(() => {
    const initPage = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check login status
        if (!isLoggedIn || !user) {
          setError("未登录，请先登录");
          setLoading(false);
          return;
        }

        // Get CloudAuth config
        const configResponse = await cloudAuthApi.getConfig();
        setCloudConfig(configResponse.data);

        // Try to get CloudAuth Token
        try {
          const tokenResponse = await cloudAuthApi.getToken();
          setCloudToken(tokenResponse.data);
        } catch (err) {
          console.warn("获取云端 Token 失败:", err);
          // Allow page to load even if token fetch fails
        }

        setLoading(false);
      } catch (err) {
        console.error("初始化内嵌页面失败:", err);
        setError("初始化失败: " + (err as Error).message);
        setLoading(false);
      }
    };

    initPage();
  }, [isLoggedIn, user]);

  // Build webview URL
  const webviewUrl = cloudConfig?.apiUrl || "http://localhost:5173";
  const urlWithToken = cloudToken
    ? `${webviewUrl}?token=${encodeURIComponent(cloudToken)}&userId=${user?.id}&email=${encodeURIComponent(user?.email || "")}`
    : webviewUrl;

  // Reload webview
  const handleReload = () => {
    if (webviewRef.current) {
      webviewRef.current.src = urlWithToken;
    }
  };

  // Listen for webview messages
  const handleWebviewMessage = (event: MessageEvent) => {
    console.log("收到 webview 消息:", event.data);
    // TODO: 处理来自 webview 的消息
  };

  useEffect(() => {
    window.addEventListener("message", handleWebviewMessage);
    return () => {
      window.removeEventListener("message", handleWebviewMessage);
    };
  }, []);

  // Send token update to webview
  useEffect(() => {
    if (webviewRef.current && cloudToken) {
      webviewRef.current.send("auth:update", {
        token: cloudToken,
        userId: user?.id,
        email: user?.email,
      });
    }
  }, [cloudToken, user]);

  if (loading) {
    return (
      <div className="embedded-page-container">
        <Card className="embedded-page-card">
          <div className="embedded-loading">
            <Spin size="large" />
            <p>加载内嵌页面...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="embedded-page-container">
        <Card className="embedded-page-card">
          <Alert
            message="加载失败"
            description={error}
            type="error"
            showIcon
            icon={<WarningOutlined />}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="embedded-page-container">
      <div className="embedded-toolbar">
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReload}>
            刷新
          </Button>
          {!cloudToken && (
            <Alert
              message="未获取到云端 Token"
              type="warning"
              showIcon
              style={{ margin: 0 }}
            />
          )}
        </Space>
      </div>

      <div className="embedded-webview-container">
        <webview
          ref={webviewRef}
          src={urlWithToken}
          style={{ width: "100%", height: "100%" }}
          // 这些属性需要在 electron 中正确配置
          preload={`file://${(window as any).electronAPI?.getAppPath?.()}/preload/webviewPreload.js`}
          partition="persist:webview-session"
          allowpopups="true"
          webpreferences="contextIsolation=true"
          onDidStartLoading={() => {
            console.log("webview 开始加载");
          }}
          onDidStopLoading={() => {
            console.log("webview 停止加载");
          }}
          onDidFailLoad={(event: any) => {
            console.error("webview 加载失败:", event);
            setError(`加载失败: ${event.errorDescription}`);
          }}
        />
      </div>
    </div>
  );
};

export default EmbeddedWebPage;
