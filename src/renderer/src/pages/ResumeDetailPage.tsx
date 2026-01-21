import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Progress,
  List,
  Empty,
  message,
  Spin,
  Divider,
  Breadcrumb,
  Modal,
  Form,
  Input,
  Descriptions,
  Avatar,
  Badge,
  Alert,
} from 'antd';
import {
  HomeOutlined,
  FileTextOutlined,
  EditOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  BulbOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  BookOutlined,
  StarOutlined,
  RocketOutlined,
  TrophyOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { resumeApi } from '../services/resumeIpcService';
import type { ResumeData, ResumeStatusData, ParsedResumeInfo } from '../../../shared/types';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const ResumeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [resume, setResume] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ResumeStatusData | null>(null);
  const [optimizeModalVisible, setOptimizeModalVisible] = useState(false);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadResume = async () => {
    if (!id) {
      message.error('简历ID无效');
      navigate('/resumes');
      return;
    }

    const resumeId = parseInt(id);
    if (isNaN(resumeId) || resumeId <= 0) {
      message.error('简历ID无效');
      navigate('/resumes');
      return;
    }

    try {
      setLoading(true);
      const resumeData = await resumeApi.getResume(resumeId);
      setResume(resumeData);

      if (resumeData.status === 'processing') {
        const status = await resumeApi.getResumeStatus(resumeData.id);
        setProcessingStatus(status);
      }
    } catch (error) {
      message.error('加载简历详情失败');
      navigate('/resumes');
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!id || !resume) return;

    try {
      const status = await resumeApi.getResumeStatus(resume.id);
      setProcessingStatus(status);

      if (status.status === 'completed') {
        await loadResume();
      }
    } catch (error) {
      console.error('获取处理状态失败:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!id || !resume?.jobDescription) {
      message.warning('请先设置目标职位描述');
      setOptimizeModalVisible(true);
      return;
    }

    try {
      await resumeApi.analyzeResume(resume.id, resume.jobDescription);
      message.success('分析已开始');

      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }

      const interval = setInterval(() => {
        refreshStatus();
      }, 3000);
      statusIntervalRef.current = interval;

      const timeoutId = setTimeout(() => {
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
      }, 300000);
    } catch (error) {
      message.error('分析失败，请重试');
    }
  };

  const handleUpdateJob = async (values: { jobDescription: string }) => {
    if (!id) return;

    try {
      await resumeApi.updateResume(resume!.id, {
        jobDescription: values.jobDescription,
      });

      message.success('职位描述已更新');
      setOptimizeModalVisible(false);
      await loadResume();
    } catch (error) {
      message.error('更新失败，请重试');
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    Modal.confirm({
      title: '删除确认',
      content: '确定要删除这份简历吗？此操作不可恢复。',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await resumeApi.deleteResume(resume!.id);
          message.success('简历删除成功');
          navigate('/resumes');
        } catch (error) {
          message.error('删除失败，请重试');
        }
      },
    });
  };

  useEffect(() => {
    loadResume();

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>加载中...</p>
      </div>
    );
  }

  if (!resume) {
    return <Empty description={loading ? '加载中...' : '简历不存在'} />;
  }

  const getStatusTag = (status: string) => {
    const statusMap = {
      pending: { color: 'blue', text: '已上传', icon: <FileTextOutlined /> },
      processing: { color: 'orange', text: '处理中', icon: <SyncOutlined /> },
      completed: { color: 'green', text: '已完成', icon: <CheckCircleOutlined /> },
      failed: { color: 'red', text: '处理失败', icon: <ExclamationCircleOutlined /> },
    };
    const config = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status, icon: null };
    return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  const getScoreLevel = (score: number) => {
    if (score >= 80) return '优秀';
    if (score >= 60) return '良好';
    return '需改进';
  };

  const parsedInfo: ParsedResumeInfo = resume.parsedInfo || (typeof resume.processedContent === 'string' ? {
    skills: [],
    education: [],
    experience: [],
    name: undefined,
  } : { name: undefined });

  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb
        style={{ marginBottom: 24 }}
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
          { title: resume.originalFilename },
        ]}
      />

      <Row gutter={[24, 16]} style={{ marginBottom: 24 }}>
        <Col span={16}>
          <Space size="large">
            <Title level={2} style={{ margin: 0 }}>
              {resume.originalFilename}
            </Title>
            {getStatusTag(resume.status)}
          </Space>
        </Col>
        <Col span={8} style={{ textAlign: 'right' }}>
          <Space>
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => setOptimizeModalVisible(true)}
              disabled={resume.status === 'processing'}
            >
              设置职位
            </Button>
            {resume.evaluation && resume.jobDescription && (
              <Button
                icon={<EditOutlined />}
                onClick={handleAnalyze}
                disabled={resume.status === 'processing'}
              >
                重新分析
              </Button>
            )}
            <Button icon={<CloudDownloadOutlined />} disabled={resume.status !== 'completed'}>
              下载
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              删除
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card title={
            <Space>
              <UserOutlined />
              <span>个人简历信息</span>
            </Space>
          }>
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <Avatar size={80} icon={<UserOutlined />} style={{ marginBottom: 16 }} />
              <Title level={3}>{parsedInfo.name || '未填写'}</Title>
              {parsedInfo.gender && (
                <Tag color="blue" style={{ marginLeft: 8 }}>{parsedInfo.gender}</Tag>
              )}
            </div>

            <Divider />

            <div style={{ marginBottom: 24 }}>
              <Title level={4}><MailOutlined /> 联系方式</Title>
              <Descriptions column={1} bordered size="small">
                {parsedInfo.phone && (
                  <Descriptions.Item label={<PhoneOutlined />}>{parsedInfo.phone}</Descriptions.Item>
                )}
                {parsedInfo.email && (
                  <Descriptions.Item label={<MailOutlined />}>{parsedInfo.email}</Descriptions.Item>
                )}
                {parsedInfo.address && (
                  <Descriptions.Item label={<EnvironmentOutlined />}>{parsedInfo.address}</Descriptions.Item>
                )}
              </Descriptions>
            </div>

            {parsedInfo.skills && parsedInfo.skills.length > 0 && (
              <>
                <Divider />
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}><StarOutlined /> 能力关键字</Title>
                  <div style={{ marginTop: 12 }}>
                    {parsedInfo.skills.map((skill, index) => (
                      <Tag key={index} color="geekblue" style={{ marginBottom: 8, marginRight: 8 }}>
                        {skill}
                      </Tag>
                    ))}
                  </div>
                </div>
              </>
            )}

            {parsedInfo.education && parsedInfo.education.length > 0 && (
              <>
                <Divider />
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}><BookOutlined /> 教育经历</Title>
                  <List
                    dataSource={parsedInfo.education}
                    renderItem={(edu, index) => (
                      <List.Item key={index}>
                        <List.Item.Meta
                          title={edu.school ? (edu.school + ' ' + (edu.degree || '')) : (edu.degree || '')}
                          description={
                            <Space direction="vertical" size={0}>
                              {edu.major && <Text>{edu.major}</Text>}
                              {edu.period && <Text type="secondary">{edu.period}</Text>}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </div>
              </>
            )}

            {parsedInfo.experience && parsedInfo.experience.length > 0 && (
              <>
                <Divider />
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}><TeamOutlined /> 主要经历</Title>
                  <List
                    dataSource={parsedInfo.experience}
                    renderItem={(exp, index) => (
                      <List.Item key={index}>
                        <List.Item.Meta
                          avatar={<TeamOutlined />}
                          title={exp.company ? (exp.company + ' - ' + (exp.position || '')) : (exp.position || '')}
                          description={
                            <Space direction="vertical" size={0}>
                              {exp.period && <Text type="secondary">{exp.period}</Text>}
                              {exp.description && <Paragraph ellipsis={{ rows: 2 }}>{exp.description}</Paragraph>}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </div>
              </>
            )}

            {!parsedInfo.name && !parsedInfo.skills && resume.processedContent && (
              <>
                <Divider />
                <div>
                  <Title level={4}>简历原始内容</Title>
                  <Paragraph
                    style={{
                      background: '#f6f8fa',
                      padding: 16,
                      borderRadius: 6,
                      whiteSpace: 'pre-wrap',
                      maxHeight: 400,
                      overflow: 'auto',
                      marginTop: 12,
                    }}
                  >
                    {resume.processedContent}
                  </Paragraph>
                </div>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <StarOutlined />
                <span>应聘岗位</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            {resume.jobDescription ? (
              <div>
                <Paragraph
                  ellipsis={{ rows: 10, expandable: true }}
                  style={{ marginBottom: 0 }}
                >
                  {resume.jobDescription}
                </Paragraph>
              </div>
            ) : (
              <Empty
                description="暂无职位描述"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={() => setOptimizeModalVisible(true)}>
                  设置职位描述
                </Button>
              </Empty>
            )}
          </Card>

          {resume.evaluation ? (
            <Card
              title={
                <Space>
                  <TrophyOutlined />
                  <span>匹配度评估</span>
                </Space>
              }
            >
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Progress
                  type="circle"
                  percent={resume.evaluation.overallScore || 0}
                  strokeColor={getScoreColor(resume.evaluation.overallScore || 0)}
                  size={140}
                  format={(percent) => (
                    <div>
                      <div style={{ fontSize: 36, fontWeight: 'bold' }}>{percent}%</div>
                      <div style={{ fontSize: 14, color: getScoreColor(percent || 0) }}>
                        {getScoreLevel(percent || 0)}
                      </div>
                    </div>
                  )}
                />
                <Title level={4} style={{ marginTop: 16 }}>综合匹配度</Title>
              </div>

              <Divider />

              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="dashboard"
                      percent={resume.evaluation.keywordMatch || 0}
                      strokeColor="#1890ff"
                      size={100}
                      gapDegree={120}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text strong>关键词</Text>
                      <br />
                      <Text type="secondary">{resume.evaluation.keywordMatch || 0}%</Text>
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="dashboard"
                      percent={resume.evaluation.skillMatch || 0}
                      strokeColor="#52c41a"
                      size={100}
                      gapDegree={120}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text strong>技能</Text>
                      <br />
                      <Text type="secondary">{resume.evaluation.skillMatch || 0}%</Text>
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="dashboard"
                      percent={resume.evaluation.experienceMatch || 0}
                      strokeColor="#faad14"
                      size={100}
                      gapDegree={120}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text strong>经历</Text>
                      <br />
                      <Text type="secondary">{resume.evaluation.experienceMatch || 0}%</Text>
                    </div>
                  </div>
                </Col>
              </Row>

              {resume.evaluation.missingKeywords && resume.evaluation.missingKeywords.length > 0 && (
                <>
                  <Divider />
                  <div style={{ marginBottom: 16 }}>
                    <Title level={5}><CloseCircleOutlined /> 缺失关键词</Title>
                    <div style={{ marginTop: 8 }}>
                      {resume.evaluation.missingKeywords.map((keyword, index) => (
                        <Tag key={index} color="red" style={{ marginBottom: 8, marginRight: 8 }}>
                          {keyword}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {resume.evaluation.suggestions && resume.evaluation.suggestions.length > 0 && (
                <>
                  <Divider />
                  <div>
                    <Title level={5}><BulbOutlined /> 改进建议</Title>
                    <List
                      dataSource={resume.evaluation.suggestions}
                      renderItem={(item, index) => (
                        <List.Item key={index}>
                          <List.Item.Meta
                            avatar={<BulbOutlined style={{ color: '#faad14' }} />}
                            description={item}
                          />
                        </List.Item>
                      )}
                    />
                  </div>
                </>
              )}
            </Card>
          ) : (
            <Card
              title={
                <Space>
                  <TrophyOutlined />
                  <span>匹配度评估</span>
                </Space>
              }
            >
              {resume.jobDescription ? (
                <Empty
                  description="请开始分析以获取匹配度评估"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" icon={<RocketOutlined />} onClick={handleAnalyze}>
                    开始分析
                  </Button>
                </Empty>
              ) : (
                <Empty
                  description="请先设置目标职位描述"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" onClick={() => setOptimizeModalVisible(true)}>
                    设置职位描述
                  </Button>
                </Empty>
              )}
            </Card>
          )}

          {resume.interviewQuestions && resume.interviewQuestions.length > 0 && (
            <Card
              title={
                <Space>
                  <QuestionCircleOutlined />
                  <span>面试问题</span>
                  <Badge count={resume.interviewQuestions.length} />
                </Space>
              }
              style={{ marginTop: 24 }}
            >
              <List
                dataSource={resume.interviewQuestions.slice(0, 5)}
                renderItem={(item, index) => (
                  <List.Item key={index}>
                    <List.Item.Meta
                      avatar={<QuestionCircleOutlined style={{ color: '#1890ff' }} />}
                      title={
                        <Space>
                          {item.question}
                          <Tag color={
                            item.difficulty === 'easy' ? 'green' :
                              item.difficulty === 'medium' ? 'orange' : 'red'
                          }>
                            {item.difficulty}
                          </Tag>
                        </Space>
                      }
                      description={<Tag color="blue">{item.category}</Tag>}
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="设置目标职位描述"
        open={optimizeModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setOptimizeModalVisible(false)}
        confirmLoading={optimizing}
        width={600}
      >
        <Form form={form} onFinish={handleUpdateJob} layout="vertical" initialValues={{
          jobDescription: resume.jobDescription || '',
        }}>
          <Form.Item
            name="jobDescription"
            label="职位描述 (JD)"
            rules={[{ required: true, message: '请输入目标职位描述' }]}
          >
            <TextArea
              rows={8}
              placeholder="请详细描述目标职位的要求、职责、技能需求等..."
            />
          </Form.Item>
          <Alert
            message="提示"
            description="设置职位描述后，系统将分析简历与该职位的匹配度，并生成针对性的面试问题。"
            type="info"
            showIcon
          />
        </Form>
      </Modal>
    </div>
  );
};

export default ResumeDetailPage;
