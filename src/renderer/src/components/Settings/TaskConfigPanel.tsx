import React, { useEffect, useMemo, useState } from "react";
import {
  Tabs,
  Select,
  Button,
  Form,
  InputNumber,
  Slider,
  message,
  Card,
} from "antd";
import { ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import type {
  LLMTaskConfig,
  LLMTaskName,
  LLMProvider,
} from "@/shared/types/llm";
import { useSettingStore } from "../../store/settingStore";

interface TaskConfigPanelProps {}

const TaskConfigPanel: React.FC<TaskConfigPanelProps> = () => {
  const {
    providers,
    fetchProviders,
    fetchTaskConfigs,
    updateTaskConfig,
    taskConfigs,
  } = useSettingStore();

  const [activeTab, setActiveTab] = useState<string>("resume_analysis");
  const [forms, setForms] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchProviders();
    fetchTaskConfigs();
  }, [fetchProviders, fetchTaskConfigs]);

  const tasks = useMemo(
    () => [
      {
        key: "resume_analysis" as LLMTaskName,
        label: "简历分析",
        description: "分析简历与职位的匹配度，提供详细的评估报告",
      },
      {
        key: "resume_optimization" as LLMTaskName,
        label: "简历优化",
        description: "根据职位描述优化简历内容，提升匹配度",
      },
      {
        key: "question_generation" as LLMTaskName,
        label: "面试问题生成",
        description: "基于简历和职位生成针对性的面试问题",
      },
    ],
    []
  );

  const providerOptions = useMemo(
    () =>
      (Array.isArray(providers) ? providers : []).map((p) => ({
        label: `${p.name} (${p.type})`,
        value: p.provider_id,
      })),
    [providers]
  );

  const getAvailableModels = (
    providerId: string | undefined
  ): Array<{ label: string; value: string }> => {
    if (!providerId) return [];
    const safeProviders = Array.isArray(providers) ? providers : [];
    const provider = safeProviders.find((p) => p.provider_id === providerId);
    const safeModels = Array.isArray(provider?.models) ? provider.models : [];
    return safeModels.map((model) => ({
      label: model,
      value: model,
    }));
  };

  const handleProviderChange = (taskKey: LLMTaskName) => {
    setForms((prev) => ({
      ...prev,
      [taskKey]: {
        ...prev[taskKey],
        model: undefined,
      },
    }));
  };

  const handleReset = (taskKey: LLMTaskName) => {
    const config = taskConfigs?.[taskKey];
    if (config) {
      setForms((prev) => ({
        ...prev,
        [taskKey]: {
          task_name: taskKey,
          provider_id: config.provider_id,
          model: config.model,
          parameters: config.parameters || {},
        },
      }));
    }
  };

  const handleSubmit = async (taskKey: LLMTaskName) => {
    try {
      const values = forms[taskKey];
      if (!values) {
        message.warning("请先修改配置");
        return;
      }
      await updateTaskConfig({
        task_name: taskKey,
        provider_id: values.provider_id,
        model: values.model,
        parameters: values.parameters || {},
      });
      message.success("配置已保存");
    } catch (error) {
      console.error("更新任务配置失败:", error);
      message.error("保存失败");
    }
  };

  const handleFormChange = (taskKey: LLMTaskName, field: string, value: any) => {
    setForms((prev) => {
      const currentConfig = taskConfigs?.[taskKey];
      const newForm = {
        ...prev[taskKey],
        task_name: taskKey,
        [field]: value,
      };

      // 如果是第一次修改，初始化其他字段
      if (!prev[taskKey] && currentConfig) {
        newForm.provider_id = currentConfig.provider_id;
        newForm.model = currentConfig.model;
        newForm.parameters = currentConfig.parameters || {};
      }

      // 如果修改的是 provider_id，清空 model
      if (field === "provider_id") {
        newForm.model = undefined;
      }

      // 如果修改的是参数字段，更新 parameters 对象
      if (field.startsWith("parameters.")) {
        const paramKey = field.replace("parameters.", "");
        newForm.parameters = {
          ...(prev[taskKey]?.parameters || currentConfig?.parameters || {}),
          [paramKey]: value,
        };
      }

      return {
        ...prev,
        [taskKey]: newForm,
      };
    });
  };

  const getFieldValue = (taskKey: LLMTaskName, field: string) => {
    const formData = forms[taskKey];
    const config = taskConfigs?.[taskKey];

    if (formData && field in formData) {
      return formData[field];
    }
    if (formData?.parameters && field.startsWith("parameters.")) {
      const paramKey = field.replace("parameters.", "");
      return formData.parameters[paramKey];
    }
    if (config) {
      if (field === "provider_id") return config.provider_id;
      if (field === "model") return config.model;
      if (field.startsWith("parameters.")) {
        const paramKey = field.replace("parameters.", "");
        return config.parameters?.[paramKey];
      }
    }
    return undefined;
  };

  const renderTaskContent = (task: (typeof tasks)[0]) => {
    const providerId = getFieldValue(task.key, "provider_id");
    const hasChanges = !!forms[task.key];

    return (
      <div style={{ padding: "16px 0" }}>
        <Card
          size="small"
          style={{ marginBottom: 16, backgroundColor: "#f6ffed" }}
        >
          {task.description}
        </Card>

        <Form layout="vertical">
          <Form.Item label="供应商">
            <Select
              placeholder="选择供应商（留空使用默认供应商）"
              options={providerOptions}
              allowClear
              value={providerId}
              onChange={(value) =>
                handleFormChange(task.key, "provider_id", value)
              }
            />
          </Form.Item>

          <Form.Item label="模型">
            <Select
              placeholder="选择模型"
              options={getAvailableModels(providerId)}
              allowClear
              value={getFieldValue(task.key, "model")}
              onChange={(value) => handleFormChange(task.key, "model", value)}
            />
          </Form.Item>

          <Form.Item label="Temperature">
            <Slider
              min={0}
              max={2}
              step={0.1}
              marks={{
                0: "精确",
                1: "平衡",
                2: "创意",
              }}
              value={getFieldValue(task.key, "parameters.temperature") ?? 0.7}
              onChange={(value) =>
                handleFormChange(task.key, "parameters.temperature", value)
              }
            />
          </Form.Item>

          <Form.Item label="Max Tokens">
            <InputNumber
              min={1}
              max={100000}
              style={{ width: "100%" }}
              value={getFieldValue(task.key, "parameters.max_tokens") ?? 2000}
              onChange={(value) =>
                handleFormChange(task.key, "parameters.max_tokens", value)
              }
            />
          </Form.Item>

          <Form.Item label="Timeout (ms)">
            <InputNumber
              min={1000}
              max={120000}
              step={1000}
              style={{ width: "100%" }}
              value={getFieldValue(task.key, "parameters.timeout_ms") ?? 30000}
              onChange={(value) =>
                handleFormChange(task.key, "parameters.timeout_ms", value)
              }
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 24 }}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => handleSubmit(task.key)}
              disabled={!hasChanges}
              style={{ marginRight: 8 }}
            >
              保存配置
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => handleReset(task.key)}
            >
              重置
            </Button>
          </Form.Item>
        </Form>
      </div>
    );
  };

  const tabItems = tasks.map((task) => ({
    key: task.key,
    label: task.label,
    children: renderTaskContent(task),
  }));

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        type="card"
      />
    </div>
  );
};

export default TaskConfigPanel;
