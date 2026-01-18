import React, { useEffect, useState } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Slider,
  Space,
  Button,
  message,
  InputNumber,
  Collapse,
} from "antd";
import { useSettingStore } from "../../store/settingStore";
import { LLM_PROVIDER_PRESETS } from "@/shared/types/llm";
import type { LLMProvider, LLMProviderCreateRequest, LLMProviderType } from "@/shared/types/llm";

interface ProviderFormProps {
  provider: LLMProvider | null;
  open: boolean;
  onClose: () => void;
}

const ProviderForm: React.FC<ProviderFormProps> = ({ provider, open, onClose }) => {
  const [form] = Form.useForm<LLMProviderCreateRequest>();
  const { createProvider, updateProvider } = useSettingStore();
  const [providerType, setProviderType] = useState<LLMProviderType | null>(null);

  const isEdit = !!provider;

  useEffect(() => {
    if (open) {
      if (provider) {
        // 编辑模式，填充表单
        setProviderType(provider.type);
        form.setFieldsValue({
          name: provider.name,
          type: provider.type,
          base_url: provider.base_url,
          api_key: "",
          models: provider.models,
          is_enabled: provider.is_enabled,
          is_default: provider.is_default,
          parameters: provider.parameters,
        });
      } else {
        // 新增模式，清空表单
        setProviderType(null);
        form.resetFields();
      }
    }
  }, [open, provider, form]);

  const handleTypeChange = (type: LLMProviderType) => {
    setProviderType(type);
    const preset = LLM_PROVIDER_PRESETS.find((p) => p.type === type);
    if (preset) {
      form.setFieldsValue({
        base_url: preset.base_url,
        models: preset.default_models,
        parameters: {
          temperature: 0.7,
          max_tokens: 2000,
          timeout_ms: 30000,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        },
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 验证模型列表
      if (!values.models || values.models.length === 0) {
        message.error("请至少添加一个模型");
        return;
      }

      if (isEdit && provider) {
        await updateProvider(provider.provider_id, { ...values, provider_id: provider.provider_id });
        message.success("供应商更新成功");
      } else {
        await createProvider(values);
        message.success("供应商创建成功");
      }

      onClose();
    } catch (error) {
      console.error("提交失败:", error);
    }
  };

  const typeOptions = LLM_PROVIDER_PRESETS.map((preset) => ({
    label: preset.name,
    value: preset.type,
  }));

  // Azure 供应商需要额外的 api_version 参数
  const isAzure = providerType === 'azure';

  return (
    <Modal
      title={isEdit ? "编辑供应商" : "添加供应商"}
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item
          label="供应商名称"
          name="name"
          rules={[{ required: true, message: "请输入供应商名称" }]}
        >
          <Input placeholder="如：我的 OpenAI" />
        </Form.Item>

        <Form.Item
          label="供应商类型"
          name="type"
          rules={[{ required: true, message: "请选择供应商类型" }]}
        >
          <Select
            placeholder="选择供应商类型"
            options={typeOptions}
            onChange={handleTypeChange}
          />
        </Form.Item>

        <Form.Item
          label="API 地址"
          name="base_url"
          rules={[
            { required: true, message: "请输入 API 地址" },
            {
              type: "url",
            message: "请输入有效的 URL",
            },
          ]}
        >
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>

        <Form.Item
          label="API Key"
          name="api_key"
          extra="编辑时如不修改请留空，创建时必填"
        >
          <Input.Password placeholder="sk-..." />
        </Form.Item>

        <Form.Item label="模型列表" name="models">
          <Select
            mode="tags"
            placeholder="输入模型名称后按回车添加"
            options={[
              { label: "gpt-4", value: "gpt-4" },
              { label: "gpt-4-turbo", value: "gpt-4-turbo" },
              { label: "gpt-3.5-turbo", value: "gpt-3.5-turbo" },
              { label: "glm-4", value: "glm-4" },
              { label: "glm-4-flash", value: "glm-4-flash" },
              { label: "claude-3-opus-20240229", value: "claude-3-opus-20240229" },
            ]}
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item label="启用供应商" name="is_enabled" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>

        <Form.Item label="设为默认" name="is_default" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Collapse
          items={[
            {
              key: 'basic',
              label: '基础参数',
              children: (
                <>
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
                      tooltip={{ formatter: (value: number) => `${value}` }}
                    />
                  </Form.Item>

                  <Form.Item name={["parameters", "max_tokens"]} label="Max Tokens">
                    <InputNumber
                      min={1}
                      max={100000}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>

                  <Form.Item name={["parameters", "timeout_ms"]} label="Timeout (ms)">
                    <InputNumber
                      min={1000}
                      max={120000}
                      step={1000}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'advanced',
              label: '高级参数',
              children: (
                <>
                  <Form.Item
                    name={["parameters", "top_p"]}
                    label="Top P"
                    tooltip="控制采样概率的质量，0-1 之间的值"
                    initialValue={1}
                  >
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      marks={{
                        0: "0",
                        0.5: "0.5",
                        1: "1",
                      }}
                      tooltip={{ formatter: (value: number) => `${value}` }}
                    />
                  </Form.Item>

                  <Form.Item
                    name={["parameters", "frequency_penalty"]}
                    label="Frequency Penalty"
                    tooltip="基于频率惩罚重复的 token，值越大重复惩罚越重"
                    initialValue={0}
                  >
                    <Slider
                      min={-2}
                      max={2}
                      step={0.1}
                      marks={{
                        "-2": "-2",
                        "-1": "-1",
                        0: "0",
                        1: "1",
                        2: "2",
                      }}
                      tooltip={{ formatter: (value: number) => `${value}` }}
                    />
                  </Form.Item>

                  <Form.Item
                    name={["parameters", "presence_penalty"]}
                    label="Presence Penalty"
                    tooltip="基于存在惩罚重复的 token，值越大重复惩罚越重"
                    initialValue={0}
                  >
                    <Slider
                      min={-2}
                      max={2}
                      step={0.1}
                      marks={{
                        "-2": "-2",
                        "-1": "-1",
                        0: "0",
                        1: "1",
                        2: "2",
                      }}
                      tooltip={{ formatter: (value: number) => `${value}` }}
                    />
                  </Form.Item>

                  {isAzure && (
                    <Form.Item
                      name={["parameters", "api_version"]}
                      label="API Version"
                      tooltip="Azure OpenAI API 版本"
                      initialValue="2024-02-15-preview"
                    >
                      <Select
                        options={[
                          { label: "2024-02-15-preview", value: "2024-02-15-preview" },
                          { label: "2024-02-01", value: "2024-02-01" },
                          { label: "2023-05-15", value: "2023-05-15" },
                        ]}
                      />
                    </Form.Item>
                  )}
                </>
              ),
            },
          ]}
          defaultActiveKey={['basic']}
        />
      </Form>
    </Modal>
  );
};

export default ProviderForm;
