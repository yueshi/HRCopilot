import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  Row,
  Col,
  Button,
  Space,
  List,
  Empty,
  message,
  Spin,
  Input,
  Avatar,
  Tag,
} from 'antd';
import {
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  ClearOutlined,
  BulbOutlined,
  LoadingOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { resumeApi } from '../services/resumeIpcService';
import { aiHrAssistantApi, type ConversationMessage } from '../services/aiHrAssistantIpcService';
import type { ResumeData } from '../../../shared/types';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const HRAssistantPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [resume, setResume] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadResume = async () => {
    if (!id) {
      message.error('Invalid resume ID');
      navigate('/resumes');
      return;
    }
    const resumeId = parseInt(id);
    if (isNaN(resumeId) || resumeId <= 0) {
      message.error('Invalid resume ID');
      navigate('/resumes');
      return;
    }
    try {
      setLoading(true);
      const resumeData = await resumeApi.getResume(resumeId);
      setResume(resumeData);
    } catch (error) {
      message.error('Failed to load resume');
      navigate('/resumes');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!id) return;
    const resumeId = parseInt(id);
    try {
      setLoadingHistory(true);
      const response = await aiHrAssistantApi.getHistory({ resumeId });
      const chatMessages: ChatMessage[] = response.conversations
        .filter((msg) => msg.message_type === 'chat' && !msg.is_summary)
        .map((msg) => ({
          id: msg.id.toString(),
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));
      setMessages(chatMessages);
    } catch (error) {
      message.error('Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadSuggestions = async () => {
    if (!id) return;
    const resumeId = parseInt(id);
    try {
      setLoadingSuggestions(true);
      const response = await aiHrAssistantApi.generateSuggestion({
        resumeId,
        type: 'evaluation',
      });
      const lines = response.suggestions
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      setSuggestions(lines.slice(0, 6));
    } catch (error) {
      console.warn('Failed to load suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    loadResume();
    loadHistory();
    loadSuggestions();
  }, [id]);

  useEffect(() => {
    const { electronMenu } = window as any;

    const handleStreamChunk = (_event: any, data: any) => {
      if (data.chunk) {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.isStreaming) {
            lastMessage.content += data.chunk;
            return newMessages;
          }
          return prev;
        });
      }
    };

    const handleStreamEnd = (_event: any, data: any) => {
      setSending(false);
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.isStreaming) {
          lastMessage.isStreaming = false;
        }
        return newMessages;
      });
    };

    const handleStreamError = (_event: any, data: any) => {
      message.error(data.error || 'Failed to send message');
      setSending(false);
      setMessages((prev) => prev.filter((msg) => !msg.isStreaming));
    };

    electronMenu.onAiHrAssistantStreamChunk?.(handleStreamChunk);
    electronMenu.onAiHrAssistantStreamEnd?.(handleStreamEnd);
    electronMenu.onAiHrAssistantStreamError?.(handleStreamError);

    return () => {
      electronMenu.removeAiHrAssistantStreamListeners?.();
    };
  }, []);

  const handleSend = async () => {
    if (!id || !inputValue.trim() || sending) return;
    const resumeId = parseInt(id);
    const userMessage = inputValue.trim();

    const userChatMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: userMessage,
    };
    setMessages((prev) => [...prev, userChatMessage]);

    const assistantMessage: ChatMessage = {
      id: 'assistant-' + Date.now(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    setInputValue('');
    setSending(true);

    try {
      await aiHrAssistantApi.streamMessage({
        resumeId,
        message: userMessage,
        context: resume?.job_description || undefined,
      });
    } catch (error) {
      message.error('Failed to send message');
      setSending(false);
      setMessages((prev) => prev.filter((msg) => !msg.isStreaming));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const useSuggestion = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const handleClearHistory = async () => {
    if (!id) return;
    const resumeId = parseInt(id);
    try {
      await aiHrAssistantApi.clearHistory({ resumeId });
      setMessages([]);
      message.success('History cleared');
    } catch (error) {
      message.error('Failed to clear history');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }}>
      <div className="top-bar" style={{ backgroundColor: '#fff', borderBottom: '1px solid #e8e8e8', padding: '12px 24px' }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/resumes/' + id)} />
              <Title level={4} style={{ margin: 0 }}>AI HR Assistant</Title>
              <Tag color="blue">{resume?.original_filename}</Tag>
            </Space>
          </Col>
          <Col>
            <Button type="text" icon={<ClearOutlined />} onClick={handleClearHistory} disabled={messages.length === 0}>
              Clear History
            </Button>
          </Col>
        </Row>
      </div>

      <Row style={{ flex: 1, margin: '16px', overflow: 'hidden' }}>
        <Col span={16} style={{ height: '100%' }}>
          <Card className="chat-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }} bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'hidden' }}>
            <div className="messages-container" style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', padding: '8px' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                  <Spin tip="Loading history..." />
                </div>
              ) : messages.length === 0 ? (
                <Empty description="Start chatting with AI HR Assistant" style={{ marginTop: '48px' }} />
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="message-row" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: '70%' }}>
                      {msg.role === 'assistant' && (
                        <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#52c41a', flexShrink: 0 }} />
                      )}
                      <div className="message-bubble" style={{
                        backgroundColor: msg.role === 'user' ? '#1890ff' : '#f5f5f5',
                        color: msg.role === 'user' ? '#fff' : '#333',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                      }}>
                        <Text style={{ color: 'inherit' }}>{msg.content}</Text>
                        {msg.isStreaming && <LoadingOutlined style={{ marginLeft: '8px' }} />}
                      </div>
                      {msg.role === 'user' && (
                        <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff', flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-area" style={{ borderTop: '1px solid #e8e8e8', paddingTop: '16px' }}>
              <TextArea value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type your question, press Enter to send..." autoSize={{ minRows: 2, maxRows: 6 }} disabled={sending} style={{ marginBottom: '8px' }} />
              <Button type="primary" icon={sending ? <LoadingOutlined /> : <SendOutlined />} onClick={handleSend} disabled={!inputValue.trim() || sending} block size="large">
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </Card>
        </Col>

        <Col span={8} style={{ height: '100%', paddingLeft: '8px' }}>
          <Card title={
            <Space>
              <BulbOutlined />
              <Text>Suggestions</Text>
            </Space>
          } style={{ height: '100%' }} bodyStyle={{ height: 'calc(100% - 57px)', overflowY: 'auto' }}>
            {loadingSuggestions ? (
              <Spin tip="Loading suggestions..." />
            ) : suggestions.length > 0 ? (
              <List dataSource={suggestions} renderItem={(item, index) => (
                <List.Item key={index}>
                  <Button type="text" block style={{ textAlign: 'left', height: 'auto', padding: '8px 12px', whiteSpace: 'normal' }} onClick={() => useSuggestion(item)}>
                    <Text ellipsis={{ rows: 2 }}>{item}</Text>
                  </Button>
                </List.Item>
              )} />
            ) : (
              <Empty description="No suggestions" style={{ marginTop: '24px' }} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default HRAssistantPage;
