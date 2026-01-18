import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ConfigProvider, App as AntdApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

import App from "./App";
import "./styles/index.css";

dayjs.locale("zh-cn");

// 检测是否为 Minibar 窗口，设置透明背景
const isMinibarWindow = window.location.hash.includes("window=minibar");
if (isMinibarWindow) {
  document.body.style.backgroundColor = "transparent";
  document.body.style.overflow = "hidden";
}

// Ant Design 主题配置
const theme = {
  token: {
    colorPrimary: "#1890ff",
    borderRadius: 6,
    fontSize: 14,
  },
  components: {
    Layout: {
      headerBg: "#ffffff",
      siderBg: "#ffffff",
    },
    Menu: {
      itemBg: "transparent",
    },
  },
};

// 错误处理
window.addEventListener("error", function (event) {
  console.error("Global error:", event.error);
});

window.addEventListener("unhandledrejection", function (event) {
  console.error("Unhandled promise rejection:", event.reason);
});

// 隐藏加载动画
function hideLoading() {
  const loading = document.getElementById("loading");
  if (loading) {
    loading.style.display = "none";
  }
}

// 显示错误
function showError(message) {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const errorMessage = document.getElementById("errorMessage");

  if (loading) loading.style.display = "none";
  if (error) {
    error.style.display = "flex";
    if (errorMessage) errorMessage.textContent = message;
  }
}

// 检查Electron API可用性
function checkElectronAPI() {
  if (!window.electronAPI) {
    console.error("Electron API not available");
    showError("应用初始化失败：Electron API不可用");
    return false;
  }
  return true;
}

// 应用初始化
async function initApp() {
  console.log("DOM loaded, initializing application...");

  // 检查API可用性
  if (!checkElectronAPI()) {
    return;
  }

  // 获取应用版本
  try {
    const version = await window.electronAPI.getAppVersion();
    console.log("App version:", version);
    document.title = `ResumerHelper v${version} - 智能JD简历匹配分析工具`;
  } catch (error) {
    console.error("Failed to get app version:", error);
  }

  // 监听菜单事件
  if (window.electronMenu) {
    window.electronMenu.onOpenResume(() => {
      console.log("Open resume menu clicked");
      window.dispatchEvent(new CustomEvent("menu-open-resume"));
    });

    window.electronMenu.onExportResults(() => {
      console.log("Export results menu clicked");
      window.dispatchEvent(new CustomEvent("menu-export-results"));
    });

    window.electronMenu.onExportDatabase(() => {
      console.log("Export database menu clicked");
      window.dispatchEvent(new CustomEvent("menu-export-database"));
    });

    window.electronMenu.onImportDatabase(() => {
      console.log("Import database menu clicked");
      window.dispatchEvent(new CustomEvent("menu-import-database"));
    });
  }
}

// 错误边界组件
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);

    // 显示通知
    if (window.electronAPI) {
      window.electronAPI.showNotification({
        title: "应用错误",
        body: "应用遇到了一个错误，请重新加载页面",
        type: "error",
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            padding: "20px",
            textAlign: "center",
            backgroundColor: "#fff5f5",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>⚠️</div>
          <h1 style={{ color: "#e53e3e", marginBottom: "10px" }}>
            应用出现错误
          </h1>
          <p
            style={{
              color: "#718096",
              marginBottom: "20px",
              maxWidth: "500px",
            }}
          >
            {this.state.error?.message ||
              "应用遇到了一个意外错误，请尝试重新加载页面。"}
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 20px",
                backgroundColor: "#e53e3e",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              重新加载
            </button>
            <button
              onClick={() => window.electronAPI?.quitApp?.()}
              style={{
                padding: "10px 20px",
                backgroundColor: "#e2e8f0",
                color: "#2d3748",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              退出应用
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 渲染应用
const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfigProvider locale={zhCN} theme={theme}>
        <AntdApp>
          <HashRouter>
            <App />
          </HashRouter>
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

// 初始化应用并隐藏加载动画
initApp()
  .then(() => {
    hideLoading();
  })
  .catch((error) => {
    console.error("Failed to initialize app:", error);
    showError(
      "应用初始化失败: " +
        (error instanceof Error ? error.message : String(error)),
    );
  });

// 开发环境调试
if (process.env.NODE_ENV === "development") {
  console.log("React app loaded successfully");

  // 暴露到全局用于调试
  (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.onCommitFiberRoot;
}
