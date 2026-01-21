import React, { useState, useEffect } from 'react';
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
  Modal,
  Input,
  Tag,
  Divider,
  Popconfirm,
  Tooltip,
  Select,
  Alert,
} from 'antd';
import {
  StarOutlined,
  StarFilled,
  PlusOutlined,
  DeleteOutlined,
  MergeCellsOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  EyeOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { versionApi, resumeApi } from '../services';
import type { ResumeVariant, ResumeGroup } from '../services/versionIpcService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface VersionListData {
  group: ResumeGroup;
  resumes: ResumeVariant[];
}

const VersionManagePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VersionListData | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [addVariantModalVisible, setAddVariantModalVisible] = useState(false);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);

  // 表单状态
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<number | undefined>(undefined);
  const [versionLabel, setVersionLabel] = useState('');
  const [versionNotes, setVersionNotes] = useState('');
  const [availableResumes, setAvailableResumes] = useState<any[]>([]);
  const [targetGroupId, setTargetGroupId] = useState<number | undefined>(undefined);
  const [allGroups, setAllGroups] = useState<ResumeGroup[]>([]);

  // 加载版本数据
  const loadData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const resumeId = parseInt(id);
      const response = await versionApi.getVersions({ resumeId });

      if (response.success) {
        setData(response.data);
      } else {
        message.error(response.error || '加载版本数据失败');
      }
    } catch (error) {
      message.error('加载版本数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载所有可用简历（用于添加变体）
  const loadAvailableResumes = async () => {
    try {
      const response = await resumeApi.getResumes(1, 100);
      if (response.success && response.data) {
        // 过滤掉已经在组中的简历
        const groupResumeIds = data?.resumes.map(r => r.id) || [];
        const filtered = response.data.resumes.filter((r: any) => !groupResumeIds.includes(r.id));
        setAvailableResumes(filtered);
      }
    } catch (error) {
      message.error('加载简历列表失败');
    }
  };

  // 加载所有简历组（用于合并）
  const loadAllGroups = async () => {
    if (!data?.group) return;

    try {
      // 获取用户的所有简历组
      // 这里需要添加获取所有组的 API，暂时使用空数组
      setAllGroups([]);
    } catch (error) {
      message.error('加载简历组列表失败');
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // 创建新组
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      message.error('请输入组名称');
      return;
    }

    try {
      const response = await versionApi.createGroup({
        groupName: newGroupName,
        primaryResumeId: parseInt(id!),
        description: newGroupDescription,
      });

      if (response.success) {
        message.success('创建简历组成功');
        setCreateModalVisible(false);
        setNewGroupName('');
        setNewGroupDescription('');
        loadData();
      } else {
        message.error(response.error || '创建简历组失败');
      }
    } catch (error) {
      message.error('创建简历组失败');
    }
  };

  // 添加变体
  const handleAddVariant = async () => {
    if (!selectedResumeId || !data?.group) {
      message.error('请选择简历');
      return;
    }

    try {
      const response = await versionApi.addVariant({
        groupId: data.group.id,
        resumeId: selectedResumeId,
        versionLabel: versionLabel || undefined,
        versionNotes: versionNotes || undefined,
      });

      if (response.success) {
        message.success('添加变体成功');
        setAddVariantModalVisible(false);
        setSelectedResumeId(undefined);
        setVersionLabel('');
        setVersionNotes('');
        loadData();
      } else {
        message.error(response.error || '添加变体失败');
      }
    } catch (error) {
      message.error('添加变体失败');
    }
  };

  // 设置主版本
  const handleSetPrimary = async (resumeId: number) => {
    if (!data?.group) return;

    try {
      const response = await versionApi.setPrimary({
        groupId: data.group.id,
        resumeId,
      });

      if (response.success) {
        message.success('设置主版本成功');
        loadData();
      } else {
        message.error(response.error || '设置主版本失败');
      }
    } catch (error) {
      message.error('设置主版本失败');
    }
  };

  // 合并分组
  const handleMergeGroups = async () => {
    if (!targetGroupId || !data?.group) return;

    try {
      const response = await versionApi.mergeGroups({
        sourceGroupId: data.group.id,
        targetGroupId,
      });

      if (response.success) {
        message.success('合并分组成功');
        setMergeModalVisible(false);
        navigate('/resumes');
      } else {
        message.error(response.error || '合并分组失败');
      }
    } catch (error) {
      message.error('合并分组失败');
    }
  };

  // 删除分组
  const handleDeleteGroup = async (deleteResumes: boolean = false) => {
    if (!data?.group) return;

    try {
      const response = await versionApi.deleteGroup({
        groupId: data.group.id,
        deleteResumes,
      });

      if (response.success) {
        message.success('删除分组成功');
        navigate('/resumes');
      } else {
        message.error(response.error || '删除分组失败');
      }
    } catch (error) {
      message.error('删除分组失败');
    }
  };

  // 打开添加变体弹窗
  const openAddVariantModal = () => {
    loadAvailableResumes();
    setAddVariantModalVisible(true);
  };

  // 打开合并分组弹窗
  const openMergeModal = () => {
    loadAllGroups();
    setMergeModalVisible(true);
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div>加载中...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Empty description="未找到简历组信息" />
        <Button type="primary" onClick={() => navigate('/resumes')} style={{ marginTop: '16px' }}>
          返回简历列表
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 页头 */}
      <Card style={{ marginBottom: '24px' }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/resumes/${id}`)}>
                返回
              </Button>
              <Title level={3} style={{ margin: 0 }}>
                {data.group.groupName}
              </Title>
              {data.group.description && (
                <Text type="secondary"> - {data.group.description}</Text>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openAddVariantModal}
              >
                添加变体
              </Button>
              <Button
                icon={<MergeCellsOutlined />}
                onClick={openMergeModal}
              >
                合并分组
              </Button>
              <Popconfirm
                title="确定要删除此分组吗？"
                description="删除分组后，简历将变为独立状态"
                onConfirm={() => handleDeleteGroup(false)}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除分组
                </Button>
              </Popconfirm>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 变体列表 */}
      <Card title="简历变体">
        {data.resumes.length === 0 ? (
          <Empty description="暂无简历变体" />
        ) : (
          <List
            dataSource={data.resumes}
            renderItem={(resume) => (
              <List.Item
                actions={[
                  resume.isPrimary ? (
                    <Tag color="gold" icon={<StarFilled />}>
                      主版本
                    </Tag>
                  ) : (
                    <Tooltip title="设为主版本">
                      <Button
                        type="text"
                        icon={<StarOutlined />}
                        onClick={() => handleSetPrimary(resume.id)}
                      />
                    </Tooltip>
                  ),
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => navigate(`/resumes/${resume.id}`)}
                  >
                    查看
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<FileTextOutlined style={{ fontSize: '24px', color: '#1890ff' }} />}
                  title={
                    <Space>
                      <Text strong>{resume.originalFilename}</Text>
                      {resume.versionLabel && (
                        <Tag>{resume.versionLabel}</Tag>
                      )}
                      {resume.status === 'completed' && (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                          已完成
                        </Tag>
                      )}
                      {resume.status === 'processing' && (
                        <Tag color="processing" icon={<SyncOutlined />}>
                          处理中
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      {resume.versionNotes && (
                        <Paragraph ellipsis={{ rows: 1 }} style={{ margin: 0 }}>
                          {resume.versionNotes}
                        </Paragraph>
                      )}
                      <Space split={<Divider type="vertical" />}>
                        <Text type="secondary">
                          <ClockCircleOutlined /> {formatDate(resume.createdAt)}
                        </Text>
                        <Text type="secondary">
                          大小: {formatFileSize(resume.originalSize)}
                        </Text>
                      </Space>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 添加变体弹窗 */}
      <Modal
        title="添加简历变体"
        open={addVariantModalVisible}
        onOk={handleAddVariant}
        onCancel={() => {
          setAddVariantModalVisible(false);
          setSelectedResumeId(undefined);
          setVersionLabel('');
          setVersionNotes('');
        }}
        okText="添加"
        cancelText="取消"
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>选择简历 *</Text>
            <Select
              placeholder="请选择要添加的简历"
              value={selectedResumeId}
              onChange={setSelectedResumeId}
              style={{ width: '100%', marginTop: '8px' }}
              options={availableResumes.map((r) => ({
                label: r.original_filename,
                value: r.id,
              }))}
            />
          </div>
          <div>
            <Text strong>版本标签</Text>
            <Input
              placeholder="例如：v1.0, 2024更新版（可选）"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              style={{ marginTop: '8px' }}
            />
          </div>
          <div>
            <Text strong>版本说明</Text>
            <TextArea
              placeholder="请输入版本说明（可选）"
              value={versionNotes}
              onChange={(e) => setVersionNotes(e.target.value)}
              style={{ marginTop: '8px' }}
              rows={3}
            />
          </div>
        </Space>
      </Modal>

      {/* 合并分组弹窗 */}
      <Modal
        title="合并简历组"
        open={mergeModalVisible}
        onOk={handleMergeGroups}
        onCancel={() => {
          setMergeModalVisible(false);
          setTargetGroupId(undefined);
        }}
        okText="合并"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="合并分组"
            description={`将组 "${data.group.groupName}" 的所有简历合并到目标组。合并后，原组将被删除。`}
            type="info"
          />
          <div>
            <Text strong>选择目标分组 *</Text>
            <Select
              placeholder="请选择目标分组"
              value={targetGroupId}
              onChange={setTargetGroupId}
              style={{ width: '100%', marginTop: '8px' }}
              options={allGroups
                .filter((g) => g.id !== data.group.id)
                .map((g) => ({
                  label: g.groupName,
                  value: g.id,
                }))}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default VersionManagePage;
