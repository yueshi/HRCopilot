import React, { useEffect } from "react";
import { Card, Select, Button, Space, Form, InputNumber, Slider, message } from "antd";
import { useSettingStore, useTaskConfig } from "../../store/settingStore";
import { ReloadOutlined } from "@ant-design/icons";
import type { LLMTaskConfig, LLMTaskName, LLMProvider } from "@/shared/types/llm";

const TASK_NAMES: Array<{ key: LLMTaskName; label: string; description: string }> = [
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
];

const TaskConfigPanel: React.FC = () => {
  const { providers, fetchProviders, fetchTaskConfigs, updateTaskConfig } = useSettingStore();
  const [form] = Form.useForm<LLMTaskConfig>();

  useEffect(() => {
    fetchProviders();
    fetchTaskConfigs();
  }, [fetchProviders, fetchTaskConfigs]);

  const handleTaskChange = (taskName: LLMTaskName) => {
    const config = useTaskConfig(taskName);
    if (config) {
      form.setFieldsValue({
        task_name: taskName,
        provider_id: config.provider_id,
        model: config.model,
        parameters: config.parameters,
      });
    }
  };

  const handleSubmit = async (taskName: LLMTaskName) => {
    try {
      const values = await form.validateFields();
      await updateTaskConfig({
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

  const providerOptions = providers.map((p) => ({
    label: `${p.name} (${p.type})`,
    value: p.provider_id,
  }));

  const getAvailableModels = (providerId: string | undefined): Array<{ label: string; value: string }> => {
    if (!providerId) return [];
    const provider = providers.find((p) => p.provider_id === providerId);
    return (provider?.models || []).map((model) => ({ label: model, value: model }));
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {TASK_NAMES.map((task) => {
        const config = useTaskConfig(task.key);
        const [localForm] = Form.useForm<LLMTaskConfig>();

        useEffect(() => {
          if (config) {
            localForm.setFieldsValue({
              task_name: task.key,
              provider_id: config.provider_id,
              model: config.model,
              parameters: config.parameters,
            });
          }
        }, [config]);

        return (
          <Card
            key={task.key}
            title={
              <Space>
                {task.label}
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    localForm.setFieldsValue({
                      task_name: task.key,
                      provider_id: config?.provider_id,
                      model: config?.model,
                      parameters: config?.parameters,
                    });
                  }}
                />
              </Space>
            }
            size="small"
          >
            <div style={{ color: "#666", marginBottom: 16 }}>{task.description}</div>

            <Form form={localForm} layout="vertical">
              <Form.Item name="task_name" initialValue={task.key} hidden>
                <input />
              </Form.Item>

              <Form.Item label="与其他供应商关联" name="provider_id">
                <Select
                  placeholder="选择供应商（留空使用默认供应商）"
                  options={providerOptions}
                  allowClear
                  onChange={() => {
                    localForm.setFieldValue("model", undefined);
                  }}
                />
              </Form.Item>

              <Form.Item label="模型" name="model">
                <Select
                  placeholder="选择模型"
                  options={getAvailableModels(localForm.getFieldValue("provider_id"))}
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
                <Button
                  type="primary"
                  onClick={() => handleSubmit(task.key)}
                  block
                >
                  保存配置
                </Button>
              </Form.Item>
            </Form>
          </Card>
        );
      })}
    </Space>
  );
};

export default TaskConfigPanel;
