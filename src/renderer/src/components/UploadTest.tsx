import React, { useState } from 'react';
import { Button, Card, message, Typography, Space, Alert } from 'antd';
import { CloudUploadOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { resumeApi } from '../services/resumeIpcService';

const { Title, Text } = Typography;

const UploadTest: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const testFileUpload = async () => {
    setUploading(true);
    setTestResult(null);

    try {
      // 创建一个测试文件
      const testContent = `
测试简历

姓名：张三
电话：13800138000
邮箱：test@example.com

教育背景：
- 计算机科学与技术 本科
- 2018-2022年

工作经验：
- 软件工程师 | ABC公司 | 2022-至今
  - 参与公司核心产品开发
  - 负责前端技术选型和架构设计
  - 团队协作和项目管理

技能：
- 前端：React, Vue.js, JavaScript, TypeScript
- 后端：Node.js, Python, Java
- 数据库：MySQL, MongoDB, Redis
- 工具：Git, Docker, Jenkins

项目经验：
1. 电商平台前端开发
2. 企业级管理系统
3. 移动端应用开发
      `.trim();

      const blob = new Blob([testContent], { type: 'text/plain' });
      const file = new File([blob], 'test-resume.txt', { type: 'text/plain' });

      // 测试上传
      const result = await resumeApi.uploadResume(file, '软件工程师职位，需要有React、Node.js经验');

      setTestResult({
        success: true,
        message: '文件上传测试成功！',
        details: {
          fileId: result.id,
          fileName: result.originalFilename,
          status: result.status,
          fileSize: 0
        }
      });

      message.success('上传测试成功！');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '测试失败';

      setTestResult({
        success: false,
        message: '文件上传测试失败',
        details: {
          error: errorMessage
        }
      });

      message.error(`测试失败：${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const testAPIConnection = async () => {
    setUploading(true);
    setTestResult(null);

    try {
      // 测试API连接
      const response = await resumeApi.getResumes(1, 5);

      setTestResult({
        success: true,
        message: 'API连接测试成功！',
        details: {
          resumesCount: response.resumes.length,
          currentPage: response.pagination.current,
          totalResumes: response.pagination.total
        }
      });

      message.success('API连接测试成功！');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '连接失败';

      setTestResult({
        success: false,
        message: 'API连接测试失败',
        details: {
          error: errorMessage
        }
      });

      message.error(`连接测试失败：${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const clearResult = () => {
    setTestResult(null);
  };

  return (
    <Card title="🧪 上传功能测试" style={{ maxWidth: 600, margin: '20px auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={4}>测试说明</Title>
          <Text type="secondary">
            这里提供了两个测试功能，用于验证前端与后端的连接和文件上传功能是否正常工作。
          </Text>
        </div>

        <Space size="middle">
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            loading={uploading}
            onClick={testFileUpload}
            size="large"
          >
            测试文件上传
          </Button>

          <Button
            icon={<CheckCircleOutlined />}
            loading={uploading}
            onClick={testAPIConnection}
            size="large"
          >
            测试API连接
          </Button>

          {testResult && (
            <Button
              icon={<ExclamationCircleOutlined />}
              onClick={clearResult}
            >
              清除结果
            </Button>
          )}
        </Space>

        {testResult && (
          <Alert
            type={testResult.success ? 'success' : 'error'}
            message={testResult.message}
            description={
              <div style={{ marginTop: 8 }}>
                <Text strong>详细信息：</Text>
                <pre style={{
                  marginTop: 4,
                  padding: 8,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 4,
                  fontSize: '12px',
                  overflow: 'auto'
                }}>
                  {JSON.stringify(testResult.details, null, 2)}
                </pre>
              </div>
            }
            showIcon
          />
        )}
      </Space>
    </Card>
  );
};

export default UploadTest;