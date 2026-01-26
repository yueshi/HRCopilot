import React, { useEffect, useMemo } from "react";
import {
  Card,
  Select,
  Button,
  Space,
  Form,
  InputNumber,
  Slider,
  message,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type {
  LLMTaskConfig,
  LLMTaskName,
  LLMProvider,
} from "@/shared/types/llm";
import { useSettingStore } from "../../store/settingStore";

interface TaskConfigCardProps {
  taskName: LLMTaskName;
  label: string;
  description: string;
  config: LLMTaskConfig | undefined;
  providers: LLMProvider[];
  onUpdate: (config: LLMTaskConfig) => Promise<void>;
}

const TaskConfigCard: React.FC<TaskConfigCardProps> = ({
  taskName,
  label,
  description,
  config,
  providers,
  onUpdate,
}) => {
  const [form] = Form.useForm<LLMTaskConfig>();

  // 当 config 更新时，同步表单值
  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        task_name: taskName,
        provider_id: config.provider_id,
        model: config.model,
        parameters: config.parameters || {},
      });
    }
  }, [config, taskName, form]);

  const handleReset = () => {
    if (config) {
      form.setFieldsValue({
        task_name: taskName,
        provider_id: config.provider_id,
        model: config.model,
        parameters: config.parameters || {},
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onUpdate({
        task_name: taskName,
        provider_id: values.provider_id,
        model: values.model,
        parameters: values.parameters || {},
      });
      message.success("配置已更新");
    } catch (error) {
      console.error("更新任务配置失败:", error);
    }
  };

  const handleProviderChange = () => {
    form.setFieldsValue({
      model: undefined,
    });
  };

  const providerOptions = useMemo(
    () =>
      (Array.isArray(providers) ? providers : []).map((p) => ({
        label: `${p.name} (${p.type})`,
        value: p.provider_id,
      })),
    [providers],
  );

  const getAvailableModels = (
    providerId: string | undefined,
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

  return (
    <Card
      title={
        <Space>
          {label}
          <Button size="small" icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      }
      size="small"
    >
      <div style={{ color: "#666", marginBottom: 16 }}>{description}</div>
      <Form form={form} layout="vertical">
        <Form.Item name="task_name" initialValue={taskName} hidden>
          <input />
        </Form.Item>
        <Form.Item label="与其他供应商关联" name="provider_id">
          <Select
            placeholder="选择供应商（留空使用默认供应商）"
            options={providerOptions}
            allowClear
            onChange={handleProviderChange}
          />
        </Form.Item>
        <Form.Item label="模型" name="model">
          <Select
            placeholder="选择模型"
            options={getAvailableModels(form.getFieldValue("provider_id"))}
            allowClear
          />
        </Form.Item>
        <Form.Item label="参数配置">
          <Form.Item name={["parameters", "temperature"]} label="Temperature">
            <Slider
              min={0}
              max={2}
              step={0.1}
              marks={{
                0: "0",
                0.5: "0.5",
                1: "1",
                1.5: "1.5",
                2: "2",
              }}
            />
          </Form.Item>
          <Form.Item name={["parameters", "max_tokens"]} label="Max Tokens">
            <InputNumber min={1} max={100000} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name={["parameters", "timeout_ms"]} label="Timeout (ms)">
            <InputNumber
              min={1000}
              max={120000}
              step={1000}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleSubmit} block>
            保存配置
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

const TaskConfigPanel: React.FC = () => {
  const {
    providers,
    fetchProviders,
    fetchTaskConfigs,
    updateTaskConfig,
    taskConfigs,
  } = useSettingStore();

  useEffect(() => {
    useSettingStore.getState().fetchProviders();
    useSettingStore.getState().fetchTaskConfigs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tasks: Array<{ key: LLMTaskName; label: string; description: string }> =
    useMemo(
      () => [
        {
          key: "resume_analysis",
          label: "简历分析",
          description: "分析简历与职位的匹配度",
        },
        {
          key: "resume_optimization",
          label: "简历优化",
          description: "根据职位描述优化简历内容",
        },
        {
          key: "question_generation",
          label: "面试问题生成",
          description: "生成针对性的面试问题",
        },
      ],
      [],
    );

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {tasks.map((task) => (
        <TaskConfigCard
          key={task.key}
          taskName={task.key}
          label={task.label}
          description={task.description}
          config={taskConfigs?.[task.key]}
          providers={providers || []}
          onUpdate={updateTaskConfig}
        />
      ))}
    </Space>
  );
};

export default TaskConfigPanel;
