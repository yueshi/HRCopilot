/**
 * 折叠窗口页面组件
 * 显示 HR 头像和功能菜单，支持恢复主窗口
 * 使用状态机进行窗口状态管理
 */

import React, { useState } from "react";
import { WindowState as WindowStateEnum } from "@/shared/types/ipc";

// 菜单按钮配置
interface MenuButton {
  icon: string;
  label: string;
  path: string;
  tooltip: string;
  color?: string;
}

const MENU_BUTTONS: MenuButton[] = [
  { icon: "🏠", label: "首页", path: "/home", tooltip: "返回首页", color: "#1890ff" },
  { icon: "📄", label: "候选人", path: "/resumes", tooltip: "候选人管理", color: "#52c41a" },
  { icon: "⬆️", label: "上传", path: "/upload", tooltip: "上传简历", color: "#722ed1" },
  { icon: "⚙️", label: "设置", path: "/settings", tooltip: "系统设置", color: "#fa8c16" },
  { icon: "🚪", label: "退出", path: "logout", tooltip: "退出登录", color: "#f5222d" },
];

interface LocalWindowState {
  mainWindowVisible: boolean;
  hiddenMainPath: string | null;
}

const MinibarPage: React.FC.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [windowState, setWindowState] = useState<LocalWindowState>({
    mainWindowVisible: false,
    hiddenMainPath: null,
  });

  // 初始化：获取窗口状态
  React.useEffect(() => {
    const fetchWindowState = async () => {
      try {
        // 检查 electronAPI 是否可用
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.window?.getState) {
          const response = await electronAPI.window.getState();
          console.log('MinibarPage: 获取窗口状态响应:', response);
          if (response) {
            setWindowState({
              mainWindowVisible: response.mainWindowVisible,
              hiddenMainPath: response.hiddenMainPath,
            });
          }
        } else {
          console.warn('electronAPI.window.getState 不可用');
        }
      } catch (error) {
        console.error('获取窗口状态失败:', error);
      }
    };

    fetchWindowState();

    // 监听窗口状态变化
    const electronMenu = (window as any).electronMenu;
    if (electronMenu) {
      const handleStateChange = (_event: any, state: any) => {
        console.log('MinibarPage: 窗口状态变化:', state);
        if (state) {
          setWindowState({
            mainWindowVisible: state.mainWindowVisible,
            hiddenMainPath: state.hiddenMainPath,
          });
        }
      };

      electronMenu.onWindowStateChanged(handleStateChange);
    }

    return () => {
      if (electronMenu) {
        electronMenu.removeAllListeners('window-state-changed');
      }
    };
  }, []);

  // 当 Minibar 窗口从隐藏状态恢复显示时，默认折叠菜单
  React.useEffect(() => {
    const electronMenu = (window as any).electronMenu;

    const handleMinibarShown = () => {
      console.log('MinibarPage: 窗口已显示，默认折叠菜单');
      setIsExpanded(false);
    };

    if (electronMenu) {
      electronMenu.onMinibarWindowShown(handleMinibarShown);
    }

    return () => {
      if (electronMenu) {
        electronMenu.removeAllListeners('minibar-window-shown');
      }
    };
  }, []);

  // 切换展开/折叠状态
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // 显示功能窗口
  const showMainWindow = async (path: string) => {
    const electronAPI = (window as any).electronAPI;
    if (path === "logout") {
      // 退出登录 - 切换到主窗口状态（隐藏Minibar）
      try {
        await electronAPI?.window?.transitionState?.(WindowStateEnum.MAIN_ONLY);
        console.log('退出登录成功');
      } catch (error) {
        console.error('退出登录失败:', error);
        if (electronAPI?.showNotification) {
          electronAPI.showNotification({
            title: "退出失败",
            body: error instanceof Error ? error.message : String(error),
            type: "error",
          });
        }
      }
    } else {
      // 先保存路径，然后切换到 MAIN_ONLY 状态（显示主窗口并隐藏Minibar）
      // 状态机将自动处理窗口显示，不需要单独调用 showMain
      await electronAPI?.window?.saveHiddenPath?.(path);
      await electronAPI?.window?.transitionState?.(WindowStateEnum.MAIN_ONLY);
      console.log(`显示主窗口，路径: ${path}`);
    }
  };

  // 恢复窗口到隐藏前的路径
  const handleRestore = async () => {
    const electronAPI = (window as any).electronAPI;
    try {
      // 切换到主窗口+Minibar状态（如果主窗口已经显示，会跳转）
      await electronAPI?.window?.transitionState?.(WindowStateEnum.MAIN_WITH_MINIBAR);
      console.log('恢复主窗口');
    } catch (error) {
      console.error('恢复主窗口失败:', error);
      if (electronAPI?.showNotification) {
        electronAPI.showNotification({
          title: "恢复失败",
          body: error instanceof Error ? error.message : String(error),
          type: "error",
        });
      }
    }
  };

  // 点击头像（如果主窗口隐藏则恢复，否则切换菜单）
  const handleAvatarClick = () => {
    if (!windowState.mainWindowVisible && windowState.hiddenMainPath) {
      // 主窗口隐藏且有保存的路径，直接恢复
      handleRestore();
    } else {
      // 否则切换菜单
      toggleExpand();
    }
  };

  // 点击菜单按钮
  const handleMenuClick = (button: MenuButton) => {
    showMainWindow(button.path);
  };

  const hasRestoreAvailable = !windowState.mainWindowVisible && !!windowState.hiddenMainPath;

  return (
    <div className="minibar-container">
      {/* 恢复按钮 - 当主窗口隐藏且保存了路径时显示 */}
      {hasRestoreAvailable && (
        <div
          className="restore-button"
          onClick={handleRestore}
          title="恢复到隐藏前的页面"
        >
          <span className="restore-icon">↩</span>
        </div>
      )}

      {/* HR 头像 */}
      <div
        className={`hr-avatar ${hasRestoreAvailable ? "has-restore" : ""}`}
        onClick={handleAvatarClick}
        title={
          hasRestoreAvailable
            ? "点击恢复"
            : isExpanded
            ? "折叠菜单"
            : "展开菜单"
        }
      >
        <div className="hr-avatar-inner">
          <span className="hr-avatar-icon">👤</span>
          <span className="hr-avatar-label">HR</span>
          {/* 显示小圆点指示有恢复可用 */}
          {hasRestoreAvailable && <span className="restore-indicator" />}
        </div>
      </div>

      {/* 菜单按钮 */}
      {isExpanded && (
        <div className="menu-buttons">
          {MENU_BUTTONS.map((button, index) => (
            <div
              key={index}
              className={`menu-button ${
                hoveredButton === button.label ? "menu-button-hover" : ""
              }`}
              style={{ "--button-color": button.color } as React.CSSProperties}
              onClick={() => handleMenuClick(button)}
              onMouseEnter={() => setHoveredButton(button.label)}
              onMouseLeave={() => setHoveredButton(null)}
              title={button.tooltip}
            >
              <span className="menu-button-icon">{button.icon}</span>
              <span className="menu-button-label">{button.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MinibarPage;
