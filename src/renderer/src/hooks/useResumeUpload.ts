import { useState, useCallback } from "react";
import { resumeApi } from "../services/resumeIpcService";
import { useResumeStore } from "../store";
import type { ResumeData, ResumeUploadResponse } from "../../../shared/types";

export interface ResumeUploadRequest {
  file: File;
  jobDescription?: string;
}

export const useResumeUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { addResume } = useResumeStore();

  // 上传简历
  const uploadResume = useCallback(
    async (data: ResumeUploadRequest): Promise<ResumeUploadResponse> => {
      try {
        setUploading(true);
        setUploadProgress(10);
        setError(null);

        // 文件传输到主进程
        setUploadProgress(30);
        const response = await resumeApi.uploadResume(
          data.file,
          data.jobDescription,
        );

        // 上传完成
        setUploadProgress(100);

        // 添加到 store
        addResume(response as ResumeData);

        return response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "简历上传失败";
        setError(errorMessage);
        throw err;
      } finally {
        setUploading(false);
        // 延迟重置进度条
        setTimeout(() => setUploadProgress(0), 1000);
      }
    },
    [addResume],
  );

  // 重置状态
  const reset = useCallback(() => {
    setUploading(false);
    setUploadProgress(0);
    setError(null);
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    uploading,
    uploadProgress,
    error,
    uploadResume,
    reset,
    clearError,
  };
};
