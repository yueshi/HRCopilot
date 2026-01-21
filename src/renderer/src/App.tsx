import React, { useEffect, useState, useMemo } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Layout as AntLayout } from "antd";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import ResumeUploadPage from "./pages/ResumeUploadPage";
import ResumeListPage from "./pages/ResumeListPage";
import ResumeDetailPage from "./pages/ResumeDetailPage";
import HRAssistantPage from "./pages/HRAssistantPage";
import VersionManagePage from "./pages/VersionManagePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SettingsPage from "./pages/SettingsPage";
import MinibarPage from "./pages/MinibarPage";
import { useAuthStore } from "./store/authStore";
import { userApi } from "./services/userIpcService";
import { WindowType } from "@/shared/types/ipc";
import "./styles/Minibar.css";

const { Content } = AntLayout;

const getWindowType = (): WindowType => {
  const hash = window.location.hash;
  console.log("getWindowType - 当前 hash:", hash);

  if (hash.includes("window=minibar")) {
    console.log("getWindowType - 检测到 MINIBAR 窗口");
    return WindowType.MINIBAR;
  }

  console.log("getWindowType - 检测到 MAIN 窗口");
  return WindowType.MAIN;
};

const MinibarWindowApp: React.FC = () => {
  return <MinibarPage />;
};

const MainWindowApp: React.FC = () => {
  const { isLoggedIn, isLoading, user, fetchUser } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      console.log("[MainWindowApp] 开始初始化");

      try {
        const currentUser = userApi.getCurrentUser();
        console.log("[MainWindowApp] localStorage 中的用户:", currentUser);
        console.log("[MainWindowApp] Store 中的用户:", user);

        if (currentUser && !user) {
          try {
            console.log("[MainWindowApp] 开始从服务器获取用户信息");
            await fetchUser();
            console.log("[MainWindowMainWindowApp] fetchUser 完成");
          } catch (error) {
            // Session 失效，静默清理
            if (import.meta.env.DEV) {
              console.info("[MainWindowApp] Session 已失效");
            }
          }
        }
      } catch (error) {
        console.error("[MainWindowApp] 初始化失败:", error);
      } finally {
        console.log(
          "[MainWindowApp] 初始化完成，设置 isInitializing=false, authChecked=true",
        );
        setIsInitializing(false);
        setAuthChecked(true);
      }
    };

    initApp();
  }, []);

  console.log("[MainWindowApp] 渲染状态:", {
    isLoggedIn,
    isLoading,
    isInitializing,
    authChecked,
    user,
  });

  // 初始化中显示加载界面
  if (isLoading || isInitializing) {
    console.log("[MainWindowApp] 显示加载屏幕");
    return <LoadingScreen />;
  }

  // 渲染主路由
  return (
    <Routes>
      {/* 首页重定向 */}
      <Route path="/" element={<Navigate to="/home" replace />} />

      {/* 登录/注册路由 */}
      <Route
        path="/login"
        element={
          isLoggedIn ? <Navigate to="/home" replace /> : <LoginPage />
        }
      />
      <Route
        path="/register"
        element={
          isLoggedIn ? <Navigate to="/home" replace /> : <RegisterPage />
        }
      />

      {/* 需要认证的路由 */}
      <Route path="/home" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<HomePage />} />
      </Route>

      <Route path="/resumes" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<ResumeListPage />} />
        <Route path=":id" element={<ResumeDetailPage />} />
        <Route path=":id/hr-assistant" element={<HRAssistantPage />} />
        <Route path=":id/versions" element={<VersionManagePage />} />
      </Route>

      <Route path="/upload" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<ResumeUploadPage />} />
      </Route>

      <Route path="/settings" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<SettingsPage />} />
      </Route>

      {/* 未登录且不是登录/注册页面，重定向到登录页 */}
      <Route
        path="*"
        element={
          isLoggedIn ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
};

const LoadingScreen: React.FC = () => {
  return (
    <AntLayout style={{ height: "100vh" }}>
      <Content
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          backgroundColor: "#f0f2f5",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "4px solid #f0f0f0",
            borderTop: "4px solid #1890ff",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            marginBottom: "16px",
          }}
        />
        <div style={{ fontSize: "16px", color: "#666" }}>加载中...</div>
      </Content>
    </AntLayout>
  );
};

const App: React.FC = () => {
  const windowType = useMemo(() => getWindowType(), []);

  if (windowType === WindowType.MINIBAR) {
    return <MinibarWindowApp />;
  }
  return <MainWindowApp />;
};

export default App;
