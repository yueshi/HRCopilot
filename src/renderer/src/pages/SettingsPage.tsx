import React from "react";
import { Tabs } from "antd";
import ProviderList from "../components/Settings/ProviderList";
import TaskConfigPanel from "../components/Settings/TaskConfigPanel";

const SettingsPage: React.FC = () => {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Tabs
        defaultActiveKey="providers"
        items={[
          {
            key: "providers",
            label: "LLM 供应商",
            children: <ProviderList />,
          },
          {
            key: "tasks",
            label: "任务配置",
            children: <TaskConfigPanel />,
          },
        ]}
      />
    </div>
  );
};

export default SettingsPage;
