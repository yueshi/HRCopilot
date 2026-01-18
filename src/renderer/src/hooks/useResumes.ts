import { useEffect, useCallback } from 'react';
import { resumeApi } from '../services/resumeIpcService';
import { useResumeStore } from '../store';

export const useResumes = () => {
  const {
    resumes,
    loading,
    pagination,
    error,
    setResumes,
    setLoading,
    setPagination,
    setError,
    clearError,
  } = useResumeStore();

  // 获取简历列表
  const fetchResumes = useCallback(
    async (page: number = pagination.current, limit: number = pagination.pageSize) => {
      try {
        setLoading(true);
        clearError();

        const response = await resumeApi.getResumes(page, limit);

        // response is already ResumeListData (unwrapped by resumeApi.getResumes)
        setResumes(response.resumes || []);
        setPagination({
          current: page,
          pageSize: limit,
          total: response.pagination?.total || 0,
          pages: Math.ceil((response.pagination?.total || 0) / limit),
        });
      } catch (error) {
        setError(error instanceof Error ? error.message : '获取简历列表失败');
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, setResumes, setLoading, setPagination, setError, clearError]
  );

  // 初始加载
  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  // 刷新
  const refresh = useCallback(() => {
    return fetchResumes();
  }, [fetchResumes]);

  return {
    resumes,
    loading,
    pagination,
    error,
    fetchResumes,
    refresh,
  };
};
