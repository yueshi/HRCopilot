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
  Tabs,
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
  RobotOutlined,
} from '@ant-design/icons';
import { resumeApi } from '../services/resumeIpcService';
import type { ResumeData, ResumeStatusData, ParsedResumeInfo } from '../../../shared/types';

const Title = Typography.Title;
const Paragraph = Typography.Paragraph;
const Text = Typography.Text;
const { TextArea } = Input;

const ResumeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [resume, setResume] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [extracting, setExtracting] = useState(false);
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

      // 只有当状态从 processing 变为 completed 时才重新加载简历
      // 如果 resume.status 已经是 completed，说明已经加载过，不需要再刷新
      if (status.status === 'completed' && resume.status === 'processing') {
        await loadResume();
        // 状态完成后清除轮询定时器
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
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

  const handleAIExtract = async () => {
    if (!id || !resume) return;

    try {
      setExtracting(true);
      const result = await resumeApi.extractResumeInfo(resume.id);
      message.success('AI 信息抽取完成，请查看结果');
      await loadResume(); // 重新加载简历以显示更新的解析信息
    } catch (error) {
      message.error('AI 信息抽取失败，请重试');
    } finally {
      setExtracting(false);
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

  // 确保 parsedInfo 总是有一个完整的 ParsedResumeInfo 对象
  const defaultParsedInfo: ParsedResumeInfo = {
    name: undefined,
    gender: undefined,
    birthYear: undefined,
    phone: undefined,
    email: undefined,
    address: undefined,
    expectedSalary: undefined,
    workYears: undefined,
    skills: [],
    languages: [],
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    honors: [],
    selfAssessment: undefined,
  };

  const parsedInfo: ParsedResumeInfo = {
    ...defaultParsedInfo,
    ...(resume.parsedInfo || {}),
  };

  const hasDetailInfo = parsedInfo.experience.length > 0 ||
    parsedInfo.projects.length > 0;

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
              icon={<RobotOutlined />}
              onClick={handleAIExtract}
              loading={extracting}
              disabled={extracting}
            >
              AI 重新抽取
            </Button>
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
              <Space style={{ marginTop: 8, justifyContent: 'center' }}>
                {parsedInfo.gender && (
                  <Tag color="blue">{parsedInfo.gender}</Tag>
                )}
                {parsedInfo.birthYear && (
                  <Tag color="purple">出生年月: {parsedInfo.birthYear}</Tag>
                )}
              </Space>
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

            {(parsedInfo.expectedSalary || parsedInfo.workYears || parsedInfo.education.length > 0) && (
              <>
                <Divider />
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}>基本信息</Title>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {parsedInfo.workYears && (
                      <div>
                        <Text type="secondary">工作年限：</Text>
                        <Tag color="cyan" style={{ marginLeft: 8 }}>{parsedInfo.workYears}</Tag>
                      </div>
                    )}
                    {parsedInfo.expectedSalary && (
                      <div>
                        <Text type="secondary">期望薪资：</Text>
                        <Tag color="orange" style={{ marginLeft: 8 }}>{parsedInfo.expectedSalary}</Tag>
                      </div>
                    )}
                  </Space>
                  {parsedInfo.education.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <Title level={5}><BookOutlined /> 教育经历</Title>
                      <List
                        dataSource={parsedInfo.education}
                        renderItem={(edu, index) => (
                          <List.Item key={index}>
                            <List.Item.Meta
                              title={
                                <Space direction="vertical" size={0}>
                                  <Text strong>{edu.school || '未知学校'}</Text>
                                  {edu.degree && (
                                    <Text type="secondary">{edu.degree}</Text>
                                  )}
                                </Space>
                              }
                              description={
                                <Space direction="vertical" size={0}>
                                  {edu.major && <Tag color="geekblue">{edu.major}</Tag>}
                                  {edu.period && <Text type="secondary" style={{ marginTop: 4 }}>{edu.period}</Text>}
                                </Space>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

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

            {parsedInfo.languages && parsedInfo.languages.length > 0 && (
              <>
                <Divider />
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}>语言能力</Title>
                  <div style={{ marginTop: 12 }}>
                    {parsedInfo.languages.map((lang, index) => (
                      <Tag key={index} color="purple" style={{ marginBottom: 8, marginRight: 8 }}>
                        {lang}
                      </Tag>
                    ))}
                  </div>
                </div>
              </>
            )}

            {parsedInfo.certifications && parsedInfo.certifications.length > 0 && (
              <>
                <Divider />
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}>证书</Title>
                  <div style={{ marginTop: 12 }}>
                    {parsedInfo.certifications.map((cert, index) => (
                      <Tag key={index} color="gold" style={{ marginBottom: 8, marginRight: 8 }}>
                        {cert}
                      </Tag>
                    ))}
                  </div>
                </div>
              </>
            )}

            {parsedInfo.honors && parsedInfo.honors.length > 0 && (
              <>
                <Divider />
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}>荣誉奖项</Title>
                  <List
                    dataSource={parsedInfo.honors}
                    renderItem={(honor, index) => (
                      <List.Item key={index}>
                        <TrophyOutlined style={{ color: '#faad14', marginRight: 8 }} />
                        <span>{honor}</span>
                      </List.Item>
                    )}
                  />
                </div>
              </>
            )}

            {hasDetailInfo && (
              <>
                <Divider />
                <Tabs
                  defaultActiveKey={parsedInfo.experience.length > 0 ? 'experience' : 'projects'}
                  items={[
                    {
                      key: 'experience',
                      label: (
                        <span>
                          <TeamOutlined />
                          工作经历
                        </span>
                      ),
                      children: parsedInfo.experience.length > 0 ? (
                        <List
                          dataSource={parsedInfo.experience}
                          renderItem={(exp, index) => (
                            <List.Item key={index}>
                              <List.Item.Meta
                                avatar={<TeamOutlined style={{ color: '#1890ff' }} />}
                                title={
                                  <Space direction="vertical" size={0}>
                                    <Text strong>
                                      {exp.company || '未知公司'}
                                      {exp.position && <Tag color="blue" style={{ marginLeft: 8 }}>{exp.position}</Tag>}
                                    </Text>
                                    {exp.period && (
                                      <Text type="secondary" style={{ fontSize: '12px' }}>
                                        {exp.startDate && `开始: ${exp.startDate} `}
                                        {exp.endDate && `结束: ${exp.endDate}`}
                                      </Text>
                                    )}
                                  </Space>
                                }
                                description={
                                  exp.description && (
                                    <Paragraph
                                      ellipsis={{ rows: 3 }}
                                      style={{ marginTop: 8, color: '#666' }}
                                    >
                                      {exp.description}
                                    </Paragraph>
                                  )
                                }
                              />
                            </List.Item>
                          )}
                        />
                      ) : <Empty description="暂无工作经历" />,
                    },
                    {
                      key: 'projects',
                      label: (
                        <span>
                          <RocketOutlined />
                          项目经验
                        </span>
                      ),
                      children: parsedInfo.projects.length > 0 ? (
                        <List
                          dataSource={parsedInfo.projects}
                          renderItem={(proj, index) => (
                            <List.Item key={index}>
                              <List.Item.Meta
                                avatar={<RocketOutlined style={{ color: '#52c41a' }} />}
                                title={
                                  <Space direction="vertical" size={0}>
                                    <Text strong>{proj.name || '未命名项目'}</Text>
                                    {proj.role && <Tag color="green" style={{ marginLeft: 8 }}>{proj.role}</Tag>}
                                    {proj.period && <Text type="secondary">{proj.period}</Text>}
                                  </Space>
                                }
                                description={
                                  <div>
                                    {proj.description && (
                                      <Paragraph
                                        ellipsis={{ rows: 3 }}
                                        style={{ marginTop: 8, color: '#666' }}
                                      >
                                        {proj.description}
                                      </Paragraph>
                                    )}
                                    {proj.technologies && proj.technologies.length > 0 && (
                                      <div style={{ marginTop: 8 }}>
                                        <Text type="secondary">使用技术：</Text>
                                        <Space size={4} wrap>
                                          {proj.technologies.map((tech, i) => (
                                            <Tag key={i} color="geekblue" style={{ fontSize: '12px' }}>
                                              {tech}
                                            </Tag>
                                          ))}
                                        </Space>
                                      </div>
                                    )}
                                  </div>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      ) : <Empty description="暂无项目经验" />,
                    },
                  ]}
                />
              </>
            )}

            {parsedInfo.selfAssessment && (
              <>
                <Divider />
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}>自我评价</Title>
                  <Paragraph
                    style={{
                      background: '#f0f9ff',
                      padding: 16,
                      borderRadius: 6,
                      marginTop: 12,
                      color: '#333',
                    }}
                  >
                    {parsedInfo.selfAssessment}
                  </Paragraph>
                </div>
              </>
            )}

            {(parsedInfo.name === undefined || parsedInfo.name === '') &&
             (!parsedInfo.skills || parsedInfo.skills.length === 0) &&
             resume.processedContent && (
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
