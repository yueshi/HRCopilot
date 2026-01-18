import React from 'react';
import { Card, Typography, Button, Space, Row, Col, Statistic } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  FileTextOutlined,
  UploadOutlined,
  StarOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      {/* 欢迎区域 */}
      <Card style={{ marginBottom: 24, textAlign: 'center' }}>
        <Title level={2}>欢迎使用 ResumerHelper 🚀</Title>
        <Paragraph style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>
          基于 AI 的智能简历优化平台，让您的简历在众多求职者中脱颖而出
        </Paragraph>
        <Space size="large">
          <Button
            type="primary"
            size="large"
            icon={<UploadOutlined />}
            onClick={() => navigate('/upload')}
          >
            立即上传简历
          </Button>
          <Button
            size="large"
            icon={<FileTextOutlined />}
            onClick={() => navigate('/resumes')}
          >
            我的简历
          </Button>
        </Space>
      </Card>

      {/* 功能特色 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="智能优化"
              value="AI"
              prefix={<StarOutlined style={{ color: '#1890ff' }} />}
              suffix="驱动"
            />
            <Paragraph style={{ marginTop: 16, textAlign: 'center' }}>
              基于 GLM 4.6 大模型，智能分析职位需求，优化简历内容
            </Paragraph>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="简历评估"
              value={100}
              suffix="%"
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
            <Paragraph style={{ marginTop: 16, textAlign: 'center' }}>
              全面评估简历匹配度，提供详细的优化建议和改进方案
            </Paragraph>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="面试准备"
              value="∞"
              prefix={<FileTextOutlined style={{ color: '#faad14' }} />}
              suffix="问题"
            />
            <Paragraph style={{ marginTop: 16, textAlign: 'center' }}>
              根据简历和职位生成针对性面试问题，助您从容应对面试
            </Paragraph>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="文件支持"
              value={3}
              prefix={<CheckCircleOutlined style={{ color: '#722ed1' }} />}
              suffix="格式"
            />
            <Paragraph style={{ marginTop: 16, textAlign: 'center' }}>
              支持 PDF、Word 等多种文档格式，解析准确度高
            </Paragraph>
          </Card>
        </Col>
      </Row>

      {/* 使用流程 */}
      <Card title="使用流程" style={{ marginBottom: 24 }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={6} style={{ textAlign: 'center' }}>
            <div className="step-card">
              <div className="step-number">1</div>
              <Title level={4}>上传简历</Title>
              <Paragraph>
                支持 PDF 和 Word 文档，快速解析简历内容
              </Paragraph>
            </div>
          </Col>
          <Col xs={24} md={6} style={{ textAlign: 'center' }}>
            <div className="step-card">
              <div className="step-number">2</div>
              <Title level={4}>输入职位</Title>
              <Paragraph>
                输入目标职位描述，AI 将据此优化您的简历
              </Paragraph>
            </div>
          </Col>
          <Col xs={24} md={6} style={{ textAlign: 'center' }}>
            <div className="step-card">
              <div className="step-number">3</div>
              <Title level={4}>AI 优化</Title>
              <Paragraph>
                AI 自动分析并优化简历，提供详细的评估报告
              </Paragraph>
            </div>
          </Col>
          <Col xs={24} md={6} style={{ textAlign: 'center' }}>
            <div className="step-card">
              <div className="step-number">4</div>
              <Title level={4}>下载使用</Title>
              <Paragraph>
                下载优化后的简历，准备面试问题，开始求职
              </Paragraph>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default HomePage;
