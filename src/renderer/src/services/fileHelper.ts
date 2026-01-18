/**
 * 文件辅助函数
 * 处理 Electron 环境下的文件上传
 */

/**
 * 获取文件路径
 * 在 Electron 中，可能需要通过主进程获取文件路径
 */
export async function getFilePath(file: File): Promise<string> {
  const { electronAPI } = window as any;

  // 如果 File 对象有 path 属性，直接使用
  if ((file as any).path) {
    return (file as any).path;
  }

  // 尝试通过 electronAPI 选择文件获取路径
  try {
    const result = await electronAPI?.selectFile?.({
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'Word Files', extensions: ['doc', 'docx'] },
      ],
    });

    if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
  } catch (error) {
    console.error('获取文件路径失败:', error);
  }

  // 回退到文件名
  return file.name;
}

/**
 * 读取文件内容
 */
export async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

/**
 * 读取文件为 ArrayBuffer
 */
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 获取文件 MIME 类型
 */
export function getFileMimeType(file: File): string {
  const type = file.type;
  if (type) return type;

  // 根据文件名推断类型
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    return 'application/pdf';
  } else if (name.endsWith('.doc') || name.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (name.endsWith('.txt')) {
    return 'text/plain';
  }

  return 'application/octet-stream';
}

/**
 * 验证文件类型是否支持
 */
export function isSupportedFileType(file: File): boolean {
  const supportedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];

  const mimeType = getFileMimeType(file);
  return supportedTypes.includes(mimeType);
}
