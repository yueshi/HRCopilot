import React, { useState, useCallback } from 'react';
import { Typography, Breadcrumb, Card, Row, Col, Alert, Space, Divider, message, Result, Button, Tooltip } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import {
  HomeOutlined,
  FileTextOutlined,
  UploadOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import FileUpload from '../components/FileUpload';
import type { ResumeUploadRequest } from '../hooks/useResumeUpload';
import { getResumeDisplayName, getResumeFilename } from '../utils/displayHelper';
import type { ResumeData } from '../../../shared/types';

const { Title, Text, Paragraph } = Typography;

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

const ResumeUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string>('');
  const [successData, setSuccessData] = useState<ResumeData | null>(null);

  const handleUploadSuccess = (resume: ResumeData) => {
    setSuccessData(resume);
    setUploadStatus('success');
    message.success('简历上传成功！');
  };

  const handleUploadError = (error: Error) => {
    console.error('简历上传失败:', error);
    setError(error.message || '上传失败，请重试');
    setUploadStatus('error');
    message.error(error.message || '上传失败');
  };

  const handleReset = () => {
    setUploadStatus('idle');
    setError('');
    setSuccessData(null);
  };

  const handleViewList = () => {
    navigate('/resumes');
  };

  const handleTryAgain = () => {
    handleReset();
  };

  if (uploadStatus === 'success' && successData) {
    return (
      <div style={{ padding: 24 }}>
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            {
              title: (
                <Link to="/">
                  <HomeOutlined />
                  首页
                </Link>
              ),
            },
            {
              title: (
                <Link to="/resumes">
                  <FileTextOutlined />
                  我的简历
                </Link>
              ),
            },
            {
              title: (
                <>
                  <UploadOutlined />
                  上传结果
                </>
              ),
            },
          ]}
        />

        <Result
          icon={<CheckCircleOutlined style={{ fontSize: 72, color: '#52c41a' }} />}
          title="简历上传成功！"
          subTitle={
            successData.jobDescription
              ?`简历已保存: ${getResumeDisplayName(successData)} - AI 正在分析您的简历，分析完成后您可以在详情页查看完整报告`
              : `简历已保存: ${getResumeDisplayName(successData)} - 简历已成功上传，您可以在简历列表中查看并进行AI分析`
          }
          extra={[
            <Button key="list" type="primary" onClick={handleViewList}>
              我的简历
            </Button>,
            <Button key="retry" onClick={handleTryAgain} icon={<ReloadOutlined />}>
              再传一份
            </Button>,
          ]}
        />

        <Card style={{ marginTop: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>简历信息</Title>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Text type="secondary">姓名</Text>
              <div style={{ marginTop: 4 }}>{getResumeDisplayName(successData)}</div>
            </Col>
            <Col span={8}>
              <Text type="secondary">文件名</Text>
              <div style={{ marginTop: 4 }}>
                <Tooltip title={successData.originalFilename}>
                  <Text ellipsis style={{ maxWidth: 150 }}>
                    {successData.originalFilename}
                  </Text>
                </Tooltip>
              </div>
            </Col>
            <Col span={8}>
              <Text type="secondary">文件大小</Text>
              <div style={{ marginTop: 4 }}>
                {(successData.originalSize / 1024 / 1024).toFixed(2)} MB
              </div>
            </Col>
            <Col span={8}>
              <Text type="secondary">状态</Text>
              <div style={{ marginTop: 4 }}>
                <span style={{ color: '#1890ff' }}>处理中...</span>
              </div>
            </Col>
          </Row>

          {successData.jobDescription && (
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">目标职位描述</Text>
              <Paragraph
                ellipsis={{ rows: 2 }}
                style={{ marginTop: 4, marginBottom: 0 }}
              >
                {successData.jobDescription}
              </Paragraph>
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (uploadStatus === 'error') {
    return (
      <div style={{ padding: 24 }}>
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            {
              title: (
                <Link to="/">
                  <HomeOutlined />
                  首页
                </Link>
              ),
            },
            {
              title: (
                <Link to="/resumes">
                  <FileTextOutlined />
                  我的简历
                </Link>
              ),
            },
            {
              title: (
                <>
                  <UploadOutlined />
                  上传结果
                </>
              ),
            },
          ]}
        />

        <Result
          icon={<CloseCircleOutlined style={{ fontSize: 72, color: '#f5222d' }} />}
          title="简历处理失败"
          subTitle={error || '上传过程中出现错误，请检查文件格式或稍后重试'}
          extra={[
            <Button key="retry" type="primary" onClick={handleTryAgain}>
              重新上传
            </Button>,
            <Button key="list" onClick={handleViewList}>
              我的简历
            </Button>,
          ]}
        />

        <Card style={{ marginTop: 24 }}>
          <Title level={5}>可能的原因：</Title>
          <ul style={{ marginTop: 8, color: '#666' }}>
            <li>文件格式不正确或已损坏</li>
            <li>文件内容无法解析（可能是图片简历）</li>
            <li>AI 分析服务暂时不可用</li>
            <li>网络连接问题</li>
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="resume-upload-page" style={{ padding: 24 }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          {
            title: (
              <Link to="/">
                <HomeOutlined />
                首页
              </Link>
            ),
          },
          {
            title: (
              <Link to="/resumes">
                <FileTextOutlined />
                我的简历
              </Link>
            ),
          },
          {
            title: (
              <>
                <UploadOutlined />
                上传简历
              </>
            ),
          },
        ]}
      />

      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          上传简历
        </Title>
        <Paragraph type="secondary">
          AI 智能分析您的简历与职位描述的匹配度，提供优化建议和面试问题
        </Paragraph>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <FileUpload
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
            disabled={uploadStatus !== 'idle'}
          />
        </Col>

        <Col xs={24} lg={8}>
          <div className="guide-sidebar">
            <Card
              title={
                <Space>
                  <ThunderboltOutlined />
                  <span>快速开始</span>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <Text strong>1. 选择文件</Text>
                  <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 12 }}>
                    上传 PDF 或 Word 格式的简历
                  </Paragraph>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <Text strong>2. 填写职位</Text>
                  <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 12 }}>
                    可选：提供目标职位描述以获得更好的分析结果
                  </Paragraph>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <Text strong>3. 开始上传</Text>
                  <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 12 }}>
                    AI 将自动分析并生成优化建议
                  </Paragraph>
                </div>
              </Space>
            </Card>

            <Card title="支持格式" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space>
                  <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                  <div>
                    <Text>PDF 文档</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      .pdf 格式，最大 10MB
                    </Text>
                  </div>
                </Space>
                <Space>
                  <FileWordOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                  <div>
                    <Text>Word 文档</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      .doc / .docx 格式，最大 10MB
                    </Text>
                  </div>
                </Space>
              </Space>
            </Card>

            <Alert
              message="温馨提示"
              description={
                <Space direction="vertical" size="small">
                  <Text type="secondary">
                    <CheckCircleOutlined /> 提供职位描述可显著提升分析准确性
                  </Text>
                  <Text type="secondary">
                    <CheckCircleOutlined /> 上传后会自动解析简历内容
                  </Text>
                  <Text type="secondary">
                    <CheckCircleOutlined /> 分析结果包含匹配度评分和优化建议
                  </Text>
                </Space>
              }
              type="info"
              icon={<InfoCircleOutlined />}
              style={{ fontSize: 12 }}
            />
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default ResumeUploadPage;
