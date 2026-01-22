import React, { useState } from "react";
import { Modal, Input, Button, Space, Spin, message } from "antd";
import { SendOutlined, RobotOutlined } from "@ant-design/icons";
import { useSettingStore } from "../../store/settingStore";
import type { LLMProvider } from "@/shared/types/llm";

interface ProviderChatModalProps {
  open: boolean;
  provider: LLMProvider | null;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const ProviderChatModal: React.FC<ProviderChatModalProps> = ({
  open,
  provider,
  onClose,
}) => {
  const { chat } = useSettingStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || !provider) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const result = await chat({
        providerId: provider.provider_id,
        message: userMessage,
        model: provider.models[0],
      });

      // result 是字符串，直接使用
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result },
      ]);
    } catch (error) {
      message.error(`发送消息失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMessages([]);
    setInput("");
    onClose();
  };

  return (
    <Modal
      title={`聊天测试 - ${provider?.name || "未知供应商"}`}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={700}
    >
      <div
        style={{
          height: "500px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 消息列表 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            backgroundColor: "#f5f5f5",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#999",
              }}
            >
              <RobotOutlined
                style={{ fontSize: "48px", marginBottom: "16px" }}
              />
              <p>开始与 {provider?.name} 对话</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "16px",
                  display: "flex",
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    backgroundColor: msg.role === "user" ? "#1677ff" : "#fff",
                    color: msg.role === "user" ? "#fff" : "#333",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  <div
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div style={{ display: "flex", marginBottom: "16px" }}>
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  backgroundColor: "#fff",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                <Spin size="small" />
              </div>
            </div>
          )}
        </div>

        {/* 输入框 */}
        <Space.Compact style={{ width: "100%" }}>
          <Input
            placeholder="输入消息..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={handleSend}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            发送
          </Button>
        </Space.Compact>
      </div>
    </Modal>
  );
};

export default ProviderChatModal;
