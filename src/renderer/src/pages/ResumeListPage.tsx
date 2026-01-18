import React, { useCallback, useState, useMemo } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Empty,
  message,
  Modal,
  Pagination,
  Avatar,
  Progress,
  Statistic,
  Tooltip,
  Input,
  Select,
  Table,
  Popconfirm,
  Alert,
  Dropdown,
} from 'antd';
import {
  FileTextOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  AppstoreOutlined,
  TableOutlined,
  EditOutlined,
  DownloadOutlined,
  StarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  UserOutlined,
  ManOutlined,
  WomanOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useResumes } from '../hooks';
import { resumeApi } from '../services/resumeIpcService';
import type { ResumeData } from '../../../shared/types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

const ResumeListPage: React.FC = () => {
  const navigate = useNavigate();
  const { resumes, loading, error, fetchResumes, refresh } = useResumes();

  // 状态管理
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingResume, setDeletingResume] = useState<ResumeData | null>(null);
  const [selectedResumes, setSelectedResumes] = useState<string[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 12,
    total: 0,
    pages: 0,
  });

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 处理筛选
  const handleFilter = (value: string) => {
    setFilterStatus(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 处理排序
  const handleSort = (value: string) => {
    setSortBy(value);
  };

  // 处理选择
  const handleSelect = (resumeId: string, checked: boolean) => {
    if (checked) {
      setSelectedResumes(prev => [...prev, resumeId]);
    } else {
      setSelectedResumes(prev => prev.filter(id => id !== resumeId));
    }
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedResumes(filteredResumes.map(r => String(r.id)));
    } else {
      setSelectedResumes([]);
    }
  };

  // 处理删除
  const handleDelete = async (resume: ResumeData) => {
    try {
      await resumeApi.deleteResume(resume.id);
      message.success('简历删除成功');
      refresh();
    } catch (error) {
      message.error('删除失败，请重试');
    }
    setDeleteModalVisible(false);
    setDeletingResume(null);
  };

  // 批量删除
  const handleBatchDelete = async () => {
    try {
      await Promise.all(selectedResumes.map(id => resumeApi.deleteResume(parseInt(id))));
      message.success(`成功删除 ${selectedResumes.length} 份简历`);
      setSelectedResumes([]);
      refresh();
    } catch (error) {
      message.error('批量删除失败，请重试');
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'processing';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'processing':
        return '处理中';
      case 'failed':
        return '处理失败';
      case 'uploaded':
        return '已上传';
      default:
        return '未知状态';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined />;
      case 'processing':
        return <SyncOutlined spin />;
      case 'failed':
        return <ExclamationCircleOutlined />;
      case 'uploaded':
        return <ClockCircleOutlined />;
      default:
        return <ClockCircleOutlined />;
    }
  };

  // 根据性别获取头像图标
  const getGenderAvatarIcon = (gender?: string) => {
    const genderLower = gender?.toLowerCase();
    if (genderLower === '男' || genderLower === 'male' || genderLower === 'm') {
      return <ManOutlined />;
    }
    if (genderLower === '女' || genderLower === 'female' || genderLower === 'f') {
      return <WomanOutlined />;
    }
    return <UserOutlined />;
  };

  // 根据性别获取头像颜色
  const getGenderAvatarColor = (gender?: string) => {
    const genderLower = gender?.toLowerCase();
    if (genderLower === '男' || genderLower === 'male' || genderLower === 'm') {
      return '#1890ff';
    }
    if (genderLower === '女' || genderLower === 'female' || genderLower === 'f') {
      return '#eb2f96';
    }
    return '#8c8c8c';
  };

  // 过滤和排序简历（使用 useMemo 避免无限循环）
  const filteredResumes = useMemo(() => {
    return resumes
      .filter(resume => {
        // 搜索过滤
        if (searchText) {
          const searchLower = searchText.toLowerCase();
          return resume.originalFilename.toLowerCase().includes(searchLower);
        }
        return true;
      })
      .filter(resume => {
        // 状态过滤
        if (filterStatus === 'all') return true;
        return resume.status === filterStatus;
      })
      .sort((a, b) => {
        // 排序
        switch (sortBy) {
          case 'createdAt':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'filename':
            return a.originalFilename.localeCompare(b.originalFilename);
          case 'status':
            return a.status.localeCompare(b.status);
          case 'score':
            return (b.evaluation?.overallScore || 0) - (a.evaluation?.overallScore || 0);
          default:
            return 0;
        }
      });
  }, [resumes, searchText, filterStatus, sortBy]);

  // 分页数据
  const paginatedResumes = useMemo(() => {
    return filteredResumes.slice(
      (pagination.current - 1) * pagination.pageSize,
      pagination.current * pagination.pageSize
    );
  }, [filteredResumes, pagination.current, pagination.pageSize]);

  // 更新分页统计
  React.useEffect(() => {
    const total = filteredResumes.length;
    const pages = Math.ceil(total / pagination.pageSize);

    if (pagination.total !== total || pagination.pages !== pages) {
      setPagination(prev => ({
        ...prev,
        total,
        pages,
      }));
    }
  }, [filteredResumes.length, pagination.pageSize, pagination.total, pagination.pages]);

  // 统计卡片组件
  const StatsCards = () => {
    const stats = {
      total: resumes.length,
      completed: resumes.filter(r => r.status === 'completed').length,
      processing: resumes.filter(r => r.status === 'processing').length,
      failed: resumes.filter(r => r.status === 'failed').length,
    };

    return (
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="总简历数"
              value={stats.total}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={stats.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="处理中"
              value={stats.processing}
              prefix={<SyncOutlined spin />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="失败"
              value={stats.failed}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>
    );
  };

  // 卡片视图组件
  const CardView = () => (
    <Row gutter={[16, 16]}>
      {paginatedResumes.map((resume) => (
        <Col xs={24} sm={12} md={8} lg={6} key={resume.id}>
          <Card
            hoverable
            size="small"
            actions={[
              <Tooltip title="查看详情">
                <EyeOutlined onClick={() => navigate(`/resumes/${resume.id}`)} />
              </Tooltip>,
              <Tooltip title="编辑">
                <EditOutlined onClick={() => navigate(`/resumes/${resume.id}/edit`)} />
              </Tooltip>,
              <Tooltip title="下载">
                <DownloadOutlined onClick={() => {/* TODO: 下载功能 */}} />
              </Tooltip>,
              <Popconfirm
                title="确定要删除这份简历吗？"
                onConfirm={() => handleDelete(resume)}
                okText="确定"
                cancelText="取消"
              >
                <DeleteOutlined />
              </Popconfirm>,
            ]}
          >
            <Card.Meta
              avatar={
                <Avatar
                  icon={getGenderAvatarIcon(resume.parsedInfo?.gender)}
                  style={{ backgroundColor: getGenderAvatarColor(resume.parsedInfo?.gender) }}
                />
              }
              title={
                <Tooltip title={resume.originalFilename}>
                  <Text ellipsis style={{ maxWidth: 120 }}>
                    {resume.originalFilename}
                  </Text>
                </Tooltip>
              }
              description={
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {/* 主简历/变体标识 */}
                  <Space size="small" wrap>
                    {resume.isPrimary && (
                      <Tag color="blue" icon={<StarOutlined />}>主简历</Tag>
                    )}
                    {!resume.isPrimary && (
                      <Tag color="default" icon={<FileTextOutlined />}>
                        {resume.versionLabel || `变体`}
                      </Tag>
                    )}
                  </Space>

                  {(resume.parsedInfo?.name || resume.parsedInfo?.gender) && (
                    <div>
                      {resume.parsedInfo.name && (
                        <>
                          <Text type="secondary">姓名: </Text>
                          <Text strong>{resume.parsedInfo.name}</Text>
                        </>
                      )}
                      {resume.parsedInfo.gender && (
                        <>
                          {resume.parsedInfo.name && <Text type="secondary"> | </Text>}
                          <Text style={{ color: getGenderAvatarColor(resume.parsedInfo.gender) }}>
                            {resume.parsedInfo.gender}
                          </Text>
                        </>
                      )}
                    </div>
                  )}
                  {resume.evaluation?.overallScore && (
                    <div>
                      <Text type="secondary">匹配度: </Text>
                      <Text strong>{resume.evaluation.overallScore}%</Text>
                    </div>
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(resume.createdAt).format('YYYY-MM-DD HH:mm')}
                  </Text>
                </Space>
              }
            />
          </Card>
        </Col>
      ))}
    </Row>
  );

  // 表格视图组件
  const TableView = () => {
    const columns = [
      {
        title: '简历名称',
        dataIndex: 'originalFilename' as const,
        key: 'filename',
        ellipsis: true,
        render: (filename: string, record: ResumeData) => (
          <Space>
            <Avatar
              icon={getGenderAvatarIcon(record.parsedInfo?.gender)}
              size="small"
              style={{ backgroundColor: getGenderAvatarColor(record.parsedInfo?.gender) }}
            />
            <Tooltip title={filename}>
              <Text ellipsis style={{ maxWidth: 150 }}>{filename}</Text>
            </Tooltip>
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status' as const,
        key: 'status',
        render: (status: string) => (
          <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
            {getStatusText(status)}
          </Tag>
        ),
      },
      {
        title: '版本',
        key: 'version',
        render: (_, record: ResumeData) => (
          <Space size="small">
            {record.isPrimary && (
              <Tag color="blue" icon={<StarOutlined />}>主简历</Tag>
            )}
            {!record.isPrimary && (
              <Tag color="default">{record.versionLabel || '变体'}</Tag>
            )}
          </Space>
        ),
      },
      {
        title: '匹配度',
        key: 'score',
        render: (_, record: ResumeData) =>
          record.evaluation?.overallScore ? (
            <Progress
              percent={record.evaluation.overallScore}
              size="small"
              status={
                record.evaluation.overallScore >= 80
                  ? 'success'
                  : record.evaluation.overallScore >= 60
                    ? 'normal'
                    : 'exception'
              }
            />
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt' as const,
        key: 'createdAt',
        render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        key: 'actions',
        render: (_, record: ResumeData) => (
          <Space>
            <Tooltip title="查看详情">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/resumes/${record.id}`)}
              />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/resumes/${record.id}/edit`)}
              />
            </Tooltip>
            <Popconfirm
              title="确定要删除这份简历吗？"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <Table
        dataSource={paginatedResumes}
        columns={columns}
        rowKey="id"
        pagination={false}
        loading={loading}
        size="small"
      />
    );
  };

  return (
    <div style={{ padding: 24 }}>
      {error && (
        <Alert message={error} type="error" closable style={{ marginBottom: 16 }} />
      )}

      <Title level={2} style={{ marginBottom: 24 }}>
        <FileTextOutlined /> 我的简历
      </Title>

      {/* 统计卡片 */}
      <StatsCards />

      {/* 搜索筛选栏 */}
      <Card size="small" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Search
              placeholder="搜索简历名称"
              onSearch={handleSearch}
              style={{ width: '100%' }}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="状态筛选"
              value={filterStatus}
              onChange={handleFilter}
              style={{ width: '100%' }}
            >
              <Select.Option value="all">全部状态</Select.Option>
              <Select.Option value="uploaded">已上传</Select.Option>
              <Select.Option value="processing">处理中</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="failed">失败</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="排序方式"
              value={sortBy}
              onChange={handleSort}
              style={{ width: '100%' }}
            >
              <Select.Option value="createdAt">创建时间</Select.Option>
              <Select.Option value="filename">文件名</Select.Option>
              <Select.Option value="status">状态</Select.Option>
              <Select.Option value="score">评分</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={6}>
            <Space>
              <Button
                type={viewMode === 'card' ? 'primary' : 'default'}
                icon={<AppstoreOutlined />}
                onClick={() => setViewMode('card')}
              >
                卡片
              </Button>
              <Button
                type={viewMode === 'table' ? 'primary' : 'default'}
                icon={<TableOutlined />}
                onClick={() => setViewMode('table')}
              >
                表格
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 简历列表 */}
      {paginatedResumes.length === 0 && !loading ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Paragraph style={{ fontSize: '16px', marginBottom: 16 }}>
                  暂无简历
                </Paragraph>
                <Text type="secondary">
                  {searchText || filterStatus !== 'all'
                    ? '没有找到符合条件的简历，请调整筛选条件'
                    : '开始上传您的第一份简历吧！'}
                </Text>
              </div>
            }
          />
        </Card>
      ) : (
        <div>{viewMode === 'card' ? <CardView /> : <TableView />}</div>
      )}

      {/* 分页 */}
      {pagination.pages > 1 && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            showSizeChanger
            showQuickJumper
            showTotal={(total, range) =>
              `显示 ${range[0]}-${range[1]} 条，共 ${total} 条简历`
            }
            onChange={(page, pageSize) => {
              setPagination(prev => ({
                ...prev,
                current: page,
                pageSize: pageSize || 12,
              }));
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ResumeListPage;
