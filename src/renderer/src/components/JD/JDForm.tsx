/**
 * JD (职位描述) 表单组件
 * 用于创建和编辑 JD
 */

import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Space,
  Card,
  Tag,
  Divider,
  message,
} from "antd";
import { PlusOutlined, SaveOutlined } from "@ant-design/icons";
import type {
  JDData,
  JDCreateRequest,
  JDUpdateRequest,
  JDStatus,
  JDDepartment,
  JDSeniority,
} from "@/shared/types/jd";
import { jdService } from "../../services/jdIpcService";

interface JDFormProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: JDData;
}

const DEPARTMENTS: JDDepartment[] = [
  "技术",
  "产品",
  "运营",
  "设计",
  "市场",
  "销售",
  "人事",
  "财务",
  "其他",
];

const SENIORITIES: JDSeniority[] = [
  "应届生",
  "初级",
  "中级",
  "高级",
  "专家",
  "总监",
];

const STATUS_OPTIONS = [
  { label: "进行中", value: "active" },
  { label: "已停用", value: "inactive" },
  { label: "已关闭", value: "closed" },
];

const JDForm: React.FC<JDFormProps> = ({
  visible,
  onClose,
  onSuccess,
  editData,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [requirementInput, setRequirementInput] = useState("");
  const [responsibilityInput, setResponsibilityInput] = useState("");

  const isEdit = !!editData;

  useEffect(() => {
    if (editData && visible) {
      form.setFieldsValue({
        title: editData.title,
        department: editData.department,
        seniority: editData.seniority,
        location: editData.location,
        salary_min: editData.salary_min,
        salary_max: editData.salary_max,
        description: editData.description,
        status: editData.status,
      });
      setSkills(editData.skills || []);
      setRequirements(editData.requirements || []);
      setResponsibilities(editData.responsibilities || []);
    } else if (!editData && visible) {
      form.resetFields();
      setSkills([]);
      setRequirements([]);
      setResponsibilities([]);
    }
  }, [editData, visible, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (isEdit) {
        const updateData: JDUpdateRequest = {
          ...values,
          jd_id: editData!.jd_id,
          requirements,
          responsibilities,
          skills,
        };
        await jdService.updateJD(updateData);
        message.success("JD 更新成功");
      } else {
        const createData: JDCreateRequest = {
          ...values,
          requirements,
          responsibilities,
          skills,
        };
        await jdService.createJD(createData);
        message.success("JD 创建成功");
      }

      setLoading(false);
      onSuccess();
    } catch (error: any) {
      console.error("保存 JD 失败:", error);
      message.error("保存失败，请重试");
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (skillInput.trim()) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const addRequirement = () => {
    if (requirementInput.trim()) {
      setRequirements([...requirements, requirementInput.trim()]);
      setRequirementInput("");
    }
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const addResponsibility = () => {
    if (responsibilityInput.trim()) {
      setResponsibilities([...responsibilities, responsibilityInput.trim()]);
      setResponsibilityInput("");
    }
  };

  const removeResponsibility = (index: number) => {
    setResponsibilities(responsibilities.filter((_, i) => i !== index));
  };

  return (
    <Modal
      title={isEdit ? "编辑职位" : "创建职位"}
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={handleSubmit}
        >
          {isEdit ? "更新" : "创建"}
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          title: "",
          department: undefined,
          seniority: undefined,
          location: "",
          salary_min: undefined,
          salary_max: undefined,
          description: "",
          status: "active",
        }}
      >
        <Form.Item
          label="职位标题"
          name="title"
          rules={[{ required: true, message: "请输入职位标题" }]}
        >
          <Input placeholder="例如：高级前端开发工程师" />
        </Form.Item>

        <Form.Item label="所属部门" name="department">
          <Select
            placeholder="选择部门"
            options={DEPARTMENTS.map((d) => ({ label: d, value: d }))}
          />
        </Form.Item>

        <Form.Item label="职级要求" name="seniority">
          <Select
            placeholder="选择职级"
            options={SENIORITIES.map((s) => ({ label: s, value: s }))}
          />
        </Form.Item>

        <Form.Item label="工作地点" name="location">
          <Input placeholder="例如：北京/上海/深圳" />
        </Form.Item>

        <Form.Item label="薪资范围">
          <Space>
            <Form.Item name="salary_min" noStyle>
              <InputNumber
                placeholder="最低"
                min={0}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <span>-</span>
            <Form.Item name="salary_max" noStyle>
              <InputNumber
                placeholder="最高"
                min={0}
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Space>
        </Form.Item>

        <Form.Item
          label="职位描述"
          name="description"
          rules={[{ required: true, message: "请输入职位描述" }]}
        >
          <Input.TextArea
            placeholder="请详细描述该职位的工作内容、职责要求等"
            rows={4}
          />
        </Form.Item>

        <Divider orientation="left">技能要求</Divider>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="输入技能后按回车添加"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onPressEnter={addSkill}
            style={{ width: "70%" }}
          />
          <Button size="small" onClick={addSkill} disabled={!skillInput.trim()}>
            添加
          </Button>
        </Space>
        {skills.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {skills.map((skill, index) => (
              <Tag
                key={index}
                closable
                onClose={() => removeSkill(index)}
                style={{ marginBottom: 4 }}
              >
                {skill}
              </Tag>
            ))}
          </div>
        )}

        <Divider orientation="left">任职要求</Divider>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="输入要求后按回车添加"
            value={requirementInput}
            onChange={(e) => setRequirementInput(e.target.value)}
            onPressEnter={addRequirement}
            style={{ width: "70%" }}
          />
          <Button
            size="small"
            onClick={addRequirement}
            disabled={!requirementInput.trim()}
          >
            添加
          </Button>
        </Space>
        {requirements.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {requirements.map((req, index) => (
              <Tag
                key={index}
                closable
                onClose={() => removeRequirement(index)}
                style={{ marginBottom: 4 }}
              >
                {req}
              </Tag>
            ))}
          </div>
        )}

        <Divider orientation="left">岗位职责</Divider>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="输入职责后按回车添加"
            value={responsibilityInput}
            onChange={(e) => setResponsibilityInput(e.target.value)}
            onPressEnter={addResponsibility}
            style={{ width: "70%" }}
          />
          <Button
            size="small"
            onClick={addResponsibility}
            disabled={!responsibilityInput.trim()}
          >
            添加
          </Button>
        </Space>
        {responsibilities.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {responsibilities.map((resp, index) => (
              <Tag
                key={index}
                closable
                onClose={() => removeResponsibility(index)}
                style={{ marginBottom: 4 }}
              >
                {resp}
              </Tag>
            ))}
          </div>
        )}

        {!isEdit && (
          <Form.Item label="状态" name="status" initialValue="active">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default JDForm;
