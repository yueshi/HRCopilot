/**
 * 获取简历显示名称
 * 优先级：解析出的姓名 > 文件名（去除扩展名） > '未知简历'
 */
export const getResumeDisplayName = (
  resume: {
    originalFilename: string;
    parsedInfo?: { name?: string } | null;
  }
): string => {
  // 1. 优先使用解析出的姓名
  if (resume.parsedInfo?.name && resume.parsedInfo.name.trim()) {
    return resume.parsedInfo.name.trim();
  }

  // 2. 使用文件名（去除扩展名）
  const filename = resume.originalFilename || '未知简历';
  const lastDotIndex = filename.lastIndexOf('.');
  
  if (lastDotIndex > 0) {
    return filename.substring(0, lastDotIndex);
  }
  
  return filename;
};

/**
 * 获取简历文件名（用于展示）
 */
export const getResumeFilename = (
  resume: {
    originalFilename: string;
  }
): string => {
  return resume.originalFilename || '';
};

/**
 * 检查简历是否有解析出的姓名
 */
export const hasParsedName = (
  resume: {
    parsedInfo?: { name?: string } | null;
  }
): boolean => {
  return !!(resume.parsedInfo?.name && resume.parsedInfo.name.trim());
};
