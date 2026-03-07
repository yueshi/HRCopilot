/**
 * JD (职位描述) 列表页面
 * 展示所有 JD，支持筛选、搜索、创建、编辑、删除
 */

import React, { useState, useEffect } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  Card,
  Select,
  Input,
  message,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { JDData, JDStatus } from "@/shared/types/jd";
import { jdService } from "../services/jdIpcService";
import JDForm from "../components/JD/JDForm";

export const JDListPage: React.FC = () => {
  const [jds, setJDs] = useState<JDData[]>([]);
  const [filteredJDs, setFilteredJDs] = useState<JDData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<JDStatus | undefined>(
    undefined,
  );
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>(
    undefined,
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<JDData | undefined>(undefined);

  useEffect(() => {
    loadJDs();
  }, []);

  useEffect(() => {
    let result = jds;

    if (statusFilter) {
      result = result.filter((jd) => jd.status === statusFilter);
    }

    if (departmentFilter) {
      result = result.filter((jd) => jd.department === departmentFilter);
    }

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      result = result.filter(
        (jd) =>
          jd.title.toLowerCase().includes(searchLower) ||
          jd.description.toLowerCase().includes(searchLower),
      );
    }

    setFilteredJDs(result);
  }, [jds, statusFilter, departmentFilter, searchText]);

  const loadJDs = async () => {
    setLoading(true);
    try {
      const result = await jdService.listJDs();
      setJDs(result);
      setFilteredJDs(result);
    } catch (error: any) {
      console.error("加载 JD 列表失败:", error);
      message.error("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setModalVisible(true);
    setEditData(undefined);
  };

  const handleEdit = (jd: JDData) => {
    setModalVisible(true);
    setEditData(jd);
  };

  const handleDelete = async (jd: JDData) => {
    try {
      await jdService.deleteJD(jd.jd_id);
      message.success("删除成功");
      await loadJDs();
    } catch (error: any) {
      console.error("删除 JD 失败:", error);
      message.error("删除失败，请重试");
    }
  };

  const handleSuccess = async () => {
    setModalVisible(false);
    setEditData(undefined);
    await loadJDs();
  };

  const getStatusColor = (status: JDStatus) => {
    switch (status) {
      case "active":
        return "green";
      case "inactive":
        return "orange";
      case "closed":
        return "default";
      default:
        return "default";
    }
  };

  const columns = [
    {
      title: "职位标题",
      dataIndex: "title",
      key: "title",
      render: (text: string) => <b>{text}</b>,
    },
    {
      title: "部门",
      dataIndex: "department",
      key: "department",
      filters: [
        {
          text: "技术",
          value: "技术",
        },
        {
          text: "产品",
          value: "产品",
        },
        {
          text: "运营",
          value: "运营",
        },
        {
          text: "设计",
          value: "设计",
        },
      ],
      render: (text: string) => (text ? <Tag>{text}</Tag> : "-"),
    },
    {
      title: "职级",
      dataIndex: "seniority",
      key: "seniority",
      render: (text: string) => (text ? <Tag>{text}</Tag> : "-"),
    },
    {
      title: "地点",
      dataIndex: "location",
      key: "location",
      render: (text: string) => text || "-",
    },
    {
      title: "薪资",
      dataIndex: "salary",
      key: "salary",
      render: (_: any, record: JDData) => {
        if (record.salary_min && record.salary_max) {
          return `${record.salary_min} - ${record.salary_max}`;
        }
        if (record.salary_min) {
          return `${record.salary_min}+`;
        }
        if (record.salary_max) {
          return `≤${record.salary_max}`;
        }
        return "-";
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      filters: [
        {
          text: "进行中",
          value: "active",
        },
        {
          text: "已停用",
          value: "inactive",
        },
        {
          text: "已关闭",
          value: "closed",
        },
      ],
      render: (status: JDStatus) => (
        <Tag color={getStatusColor(status)}>
          {status === "active" && "进行中"}
          {status === "inactive" && "已停用"}
          {status === "closed" && "已关闭"}
        </Tag>
      ),
    },
    {
      title: "技能",
      dataIndex: "skills",
      key: "skills",
      render: (skills: string[]) => (
        <Space size={0} wrap>
          {skills.slice(0, 3).map((skill, index) => (
            <Tag key={index}>{skill}</Tag>
          ))}
          {skills.length > 3 && <Tag>更多...</Tag>}
        </Space>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, record: JDData) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除职位 "${record.title}" 吗？`}
            onConfirm={() => handleDelete(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="职位管理"
        extra={
          <Space>
            <Input
              placeholder="搜索职位"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              placeholder="筛选状态"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              style={{ width: 120 }}
              options={[
                { label: "进行中", value: "active" },
                { label: "已停用", value: "inactive" },
                { label: "已关闭", value: "closed" },
              ]}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              创建职位
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredJDs}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </Card>

      <JDForm
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={handleSuccess}
        editData={editData}
      />
    </div>
  );
};

export default JDListPage;
