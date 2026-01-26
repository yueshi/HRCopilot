import React, { useEffect, useState } from "react";
import {
  List,
  Button,
  Space,
  Card,
  Popconfirm,
  Tag,
  Empty,
  Spin,
  message,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ApiOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { useSettingStore } from "../../store/settingStore";
import ProviderForm from "./ProviderForm";
import ProviderChatModal from "./ProviderChatModal";
import type { LLMProvider, LLMProviderType } from "@/shared/types/llm";

const PROVIDER_TYPE_COLORS: Record<LLMProviderType, string> = {
  openai: "green",
  glm: "blue",
  ollama: "orange",
  anthropic: "purple",
  azure: "cyan",
  custom: "default",
};

const PROVIDER_TYPE_LABELS: Record<LLMProviderType, string> = {
  openai: "OpenAI",
  glm: "GLM",
  ollama: "Ollama",
  anthropic: "Anthropic",
  azure: "Azure",
  custom: "自定义",
};

const ProviderList: React.FC = () => {
  const {
    providers,
    defaultProvider,
    providersLoading,
    providersError,
    fetchProviders,
    deleteProvider,
    setDefaultProvider,
    testProvider,
    clearError,
  } = useSettingStore();

  console.log("[ProviderList] 渲染:", {
    providers,
    providersLoading,
    providersError,
    providerCount: providers?.length,
  });

  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(
    null,
  );
  const [testingIds, setTestingSet] = useState<Set<string>>(new Set());
  const [chatProvider, setChatProvider] = useState<LLMProvider | null>(null);

  // 使用 once 模式确保 fetchProviders 只在组件挂载时调用一次
  useEffect(() => {
    console.log("[ProviderList] 组件挂载，调用 fetchProviders");
    useSettingStore.getState().fetchProviders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (provider: LLMProvider) => {
    try {
      await deleteProvider(provider.provider_id);
      message.success("供应商已删除");
    } catch (error) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const handleSetDefault = async (provider: LLMProvider) => {
    try {
      await setDefaultProvider(provider.provider_id);
      message.success("已设置为默认供应商");
    } catch (error) {
      message.error(`设置失败: ${(error as Error).message}`);
    }
  };

  const handleTest = async (provider: LLMProvider) => {
    setTestingSet((prev) => {
      const next = new Set(prev);
      next.add(provider.provider_id);
      return next;
    });

    try {
      const result = await testProvider(provider.provider_id);

      if (result.success) {
        message.success(`连接成功 (${result.latency_ms}ms)`);
      } else {
        message.error(`连接失败: ${result.message}`);
      }
    } catch (error) {
      message.error(`测试失败: ${(error as Error).message}`);
    } finally {
      setTestingSet((prev) => {
        const next = new Set(prev);
        next.delete(provider.provider_id);
        return next;
      });
    }
  };

  const handleEdit = (provider: LLMProvider) => {
    setEditingProvider(provider);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingProvider(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProvider(null);
  };

  if (providersError) {
    return (
      <Card>
        <Empty
          description={providersError}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button
            type="primary"
            onClick={() => {
              clearError();
              fetchProviders();
            }}
          >
            重试
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加供应商
        </Button>
      </div>

      <Spin spinning={providersLoading}>
        <List
          dataSource={Array.isArray(providers) ? providers : []}
          renderItem={(provider) => (
            <Card
              key={provider.provider_id}
              size="small"
              style={{ marginBottom: 16 }}
              extra={
                <Space>
                  <Button
                    size="small"
                    icon={<MessageOutlined />}
                    onClick={() => setChatProvider(provider)}
                  >
                    聊天
                  </Button>
                  <Button
                    size="small"
                    icon={<ApiOutlined />}
                    loading={testingIds.has(provider.provider_id)}
                    onClick={() => handleTest(provider)}
                  >
                    测试
                  </Button>
                  {!provider.is_default && (
                    <Button
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleSetDefault(provider)}
                    >
                      设为默认
                    </Button>
                  )}
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(provider)}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除"
                    description="删除后无法恢复，确定要删除此供应商吗？"
                    onConfirm={() => handleDelete(provider)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div>
                  <div
                    style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}
                  >
                    {provider.name}
                  </div>
                  <div style={{ color: "#666", fontSize: 12 }}>
                    {provider.base_url}
                  </div>
                </div>

                <Space size={4}>
                  <Tag color={PROVIDER_TYPE_COLORS[provider.type]}>
                    {PROVIDER_TYPE_LABELS[provider.type]}
                  </Tag>
                  {provider.is_default && (
                    <Tag color="gold" icon={<CheckCircleOutlined />}>
                      默认
                    </Tag>
                  )}
                  {!provider.is_enabled && (
                    <Tag color="red" icon={<CloseCircleOutlined />}>
                      已禁用
                    </Tag>
                  )}
                </Space>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>可用模型：</strong>
                </div>
                <Space wrap>
                  {Array.isArray(provider.models) &&
                  provider.models.length > 0 ? (
                    provider.models.map((model) => (
                      <Tag key={model} style={{ marginBottom: 4 }}>
                        {model}
                      </Tag>
                    ))
                  ) : (
                    <span style={{ color: "#999" }}>暂无模型</span>
                  )}
                </Space>
              </div>
            </Card>
          )}
        />
      </Spin>

      {showModal && (
        <ProviderForm
          provider={editingProvider}
          open={showModal}
          onClose={handleCloseModal}
        />
      )}

      {chatProvider && (
        <ProviderChatModal
          open={!!chatProvider}
          provider={chatProvider}
          onClose={() => setChatProvider(null)}
        />
      )}
    </div>
  );
};

export default ProviderList;
