import React from "react";
import {
  Layout as AntLayout,
  Menu,
  Typography,
  Button,
  Space,
  message,
} from "antd";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  HomeOutlined,
  FileTextOutlined,
  UploadOutlined,
  UserOutlined,
  SettingOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { WindowState as WindowStateEnum } from "@/shared/types/ipc";
import { useAuthStore } from "../store/authStore";

const { Header, Content, Sider } = AntLayout;
const { Title } = Typography;

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: "/home", icon: <HomeOutlined />, label: "首页" },
    { key: "/resumes", icon: <FileTextOutlined />, label: "我的简历" },
    { key: "/upload", icon: <UploadOutlined />, label: "上传简历" },
    { key: "/settings", icon: <SettingOutlined />, label: "设置" },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleHideWindow = async () => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.window) {
        const currentPath = location.pathname + location.search;
        console.log("保存隐藏前的路径:", currentPath);
        // 保存当前路径
        await electronAPI.window?.saveHiddenPath?.(currentPath);
        // 使用状态机切换到仅Minibar状态（隐藏主窗口，显示Minibar）
        await electronAPI.window?.transitionState?.(
          WindowStateEnum.MINIBAR_ONLY,
        );
      } else {
        message.warning("窗口隐藏功能不可用");
      }
    } catch (error) {
      console.error("隐藏窗口部败:", error);
      message.error("隐藏窗口部败");
    }
  };

  const handleLogout = async () => {
    try {
      const electronAPI = (window as any).electronAPI;
      const { logout } = useAuthStore.getState();

      await logout();

      if (electronAPI?.window) {
        await electronAPI.window?.transitionState?.(WindowStateEnum.MAIN_ONLY);
        navigate("/login");
        message.success("已退出登录");
      } else {
        message.warning("退出登录功能不可用");
      }
    } catch (error) {
      console.error("退出登录失败:", error);
      message.error("退出登录失败");
    }
  };

  const getSelectedKeys = () => {
    const path = location.pathname;
    return path === "/" ? ["/home"] : [path];
  };

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          padding: "0 24px",
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
          HRCopilot
        </Title>
        <Space>
          <Button type="text" icon={<UserOutlined />} onClick={handleLogout}>
            退出
          </Button>
          <Button
            type="text"
            icon={<MinusOutlined />}
            onClick={handleHideWindow}
          >
            隐藏
          </Button>
        </Space>
      </Header>
      <AntLayout>
        <Sider width={200} style={{ background: "#fff" }}>
          <Menu
            mode="inline"
            selectedKeys={getSelectedKeys()}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ height: "100%", borderRight: 0 }}
          />
        </Sider>
        <Content
          style={{
            background: "#fff",
            padding: 24,
            borderRadius: 8,
            overflowY: "auto",
            maxHeight: "calc(100vh - 64px)",
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
