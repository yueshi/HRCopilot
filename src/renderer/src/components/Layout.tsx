import React, { useState } from "react";
import {
  Layout as AntLayout,
  Menu,
  Typography,
  Button,
  Space,
  message,
  Avatar,
  Dropdown,
} from "antd";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  HomeOutlined,
  FileTextOutlined,
  UploadOutlined,
  UserOutlined,
  SettingOutlined,
  MinusOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { WindowState as WindowStateEnum } from "@/shared/types/ipc";
import { useAuthStore } from "../store/authStore";

const { Header, Content, Sider } = AntLayout;
const { Title, Text } = Typography;

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
  const { isLoggedIn, user, logout } = useAuthStore();

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
      console.error("隐藏窗口失败:", error);
      message.error("隐藏窗口失败");
    }
  };

  const handleLogout = async () => {
    try {
      const electronAPI = (window as any).electronAPI;
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

  // 用户下拉菜单项
  const userMenuItems = [
    {
      key: 'profile',
      label: '详情',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'divider',
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: handleLogout,
      danger: true as const,
    },
  ];

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
        <Space>
          {collapsed ? (
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setCollapsed(false)}
              title="展开菜单"
            />
          ) : (
            <Button
              type="text"
              icon={<MenuFoldOutlined />}
              onClick={() => setCollapsed(true)}
              title="收起菜单"
            />
          )}
          <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
            HRCopilot
          </Title>
        </Space>
        <Space>
          <Button
            type="text"
            icon={<MinusOutlined />}
            onClick={handleHideWindow}
          >
            隐藏
          </Button>
          {isLoggedIn && user && (
            <Dropdown
              menu={{
                items: userMenuItems,
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Space
                style={{
                  cursor: 'pointer',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Avatar
                  size={32}
                  icon={<UserOutlined />}
                  style={{
                    backgroundColor: '#1890ff',
                    border: '2px solid #fff',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                    {user.name ? user.name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                  </Text>
                </Avatar>
                <Text style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
                  {user.name}
                </Text>
              </Space>
            </Dropdown>
          )}
        </Space>
      </Header>
      <AntLayout>
        <Sider
          collapsible
          collapsed={collapsed}
          collapsedWidth={60}
          width={200}
          style={{ background: "#fff", borderRight: "1px solid #f0f0f0" }}
          trigger={null}
        >
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
