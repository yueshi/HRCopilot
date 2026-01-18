import React, { useState, useCallback } from 'react';
import {
  Upload,
  message,
  Button,
  Progress,
  Card,
  Form,
  Input,
  Space,
} from 'antd';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd/es/upload/interface';
import { useResumeUpload } from '../hooks';
import type { ResumeUploadRequest } from '../hooks/useResumeUpload';
import type { ResumeData } from '../../../shared/types';

const { Dragger } = Upload;
const { TextArea } = Input;

interface FileUploadProps {
  onSuccess?: (resume: ResumeData) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onSuccess, onError, disabled }) => {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [jobDescription, setJobDescription] = useState<string>('');
  const { uploading, uploadProgress, uploadResume } = useResumeUpload();

  // 文件上传前的检查
  const beforeUpload = useCallback((file: File) => {
    const isAllowedType = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(file.type);
    if (!isAllowedType) {
      message.error('只支持 PDF 和 Word 文档格式！');
      return false;
    }

    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超过 10MB！');
      return false;
    }

    // 替换文件列表
    setFileList([{ uid: Date.now().toString(), name: file.name, originFileObj: file, status: 'done' } as any]);
    return false; // 阻止自动上传
  }, []);

  // 移除文件
  const onRemove = useCallback(() => {
    setFileList([]);
    return true;
  }, []);

  // 处理上传
  const handleUpload = useCallback(async () => {
    if (fileList.length === 0) {
      message.warning('请先选择要上传的文件');
      return;
    }

    try {
      const file = fileList[0];
      const uploadData: ResumeUploadRequest = {
        file: (file as any).originFileObj || file,
        jobDescription: jobDescription?.trim() || undefined,
      };

      const resume = await uploadResume(uploadData);

      message.success('简历上传成功！');
      setFileList([]);
      setJobDescription('');
      form.resetFields();
      onSuccess?.(resume);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '上传失败';
      message.error(errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [fileList, uploadResume, jobDescription, form, onSuccess, onError]);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    fileList,
    beforeUpload,
    onRemove,
    showUploadList: {
      showRemoveIcon: true,
      showPreviewIcon: false,
    },
  };

  return (
    <Card title="简历上传" className="file-upload-card">
      <Dragger {...uploadProps} style={{ padding: '40px 24px' }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
        </p>
        <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500 }}>
          点击或拖拽文件到此区域上传
        </p>
        <p className="ant-upload-hint">
          支持单个文件上传，格式为 PDF 或 Word 文档，文件大小不超过 10MB
        </p>
      </Dragger>

      {fileList.length > 0 && (
        <div style={{ marginTop: 16, padding: 16, background: '#f6f8fa', borderRadius: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <strong>已选择文件：</strong>
              <span style={{ marginLeft: 8 }}>{fileList[0].name}</span>
              <span style={{ marginLeft: 8, color: '#999' }}>
                ({(fileList[0].size! / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          </Space>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Form form={form} layout="vertical">
          <Form.Item name="jobDescription" label="目标职位描述（可选）">
            <TextArea
              rows={4}
              placeholder="请输入目标职位的描述，AI 将根据此信息优化您的简历..."
              maxLength={2000}
              showCount
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </Form.Item>

          {uploading && (
            <div style={{ marginTop: 16 }}>
              <Progress percent={uploadProgress} status="active" />
              <div style={{ marginTop: 8, textAlign: 'center', color: '#666' }}>
                {uploadProgress < 50 ? '正在上传文件...' : '正在解析简历内容...'}
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button
                type="primary"
                onClick={handleUpload}
                loading={uploading}
                disabled={fileList.length === 0}
                icon={<UploadOutlined />}
              >
                {uploading ? '上传中...' : '开始上传'}
              </Button>
              <Button onClick={() => {
                setFileList([]);
                setJobDescription('');
                form.resetFields();
              }}>
                重置
              </Button>
            </Space>
          </div>
        </Form>
      </div>

    </Card>
  );
};

export default FileUpload;
