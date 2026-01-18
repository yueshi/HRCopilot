import { Context, Middleware } from 'koa';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * 文件上传配置
 */
export interface UploadOptions {
  maxSize?: number; // 最大文件大小（字节），默认 10MB
  allowedMimeTypes?: string[]; // 允许的 MIME 类型
  uploadDir?: string; // 上传目录
  allowedExtensions?: string[]; // 允许的文件扩展名
}

/**
 * 上传的文件信息
 */
export interface UploadedFile {
  name: string;
  originalname: string;
  path: string;
  size: number;
  mimetype: string;
}

/**
 * 解析 multipart/form-data 并保存文件
 * 这是一个简单的实现，不依赖 multer（因为 multer 是为 Express 设计的）
 */
export const upload = (options: UploadOptions = {}): Middleware => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB
    allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ],
    uploadDir = path.join(process.cwd(), 'uploads'),
    allowedExtensions = ['.pdf', '.doc', '.docx', '.txt']
  } = options;

  return async (ctx: Context, next: () => Promise<any>) => {
    // 只处理 multipart/form-data
    const contentType = ctx.headers['content-type'];
    if (!contentType?.includes('multipart/form-data')) {
      await next();
      return;
    }

    try {
      // 确保上传目录存在
      await fs.mkdir(uploadDir, { recursive: true });

      // 解析 multipart 数据
      const boundary = contentType.match(/boundary=([^;]+)/)?.[1];
      if (!boundary) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '无效的请求格式'
        };
        return;
      }

      // 读取请求体
      const chunks: Buffer[] = [];
      for await (const chunk of ctx.req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);

      // 解析 multipart 数据
      const parts = parseMultipartBody(body, boundary);

      // 处理每个部分
      const formData: Record<string, any> = {};
      const files: Record<string, UploadedFile> = {};

      for (const part of parts) {
        if (part.filename) {
          // 文件部分
          const fileExtension = path.extname(part.filename).toLowerCase();

          // 验证文件扩展名
          if (allowedExtensions.length > 0 && !allowedExtensions.includes(fileExtension)) {
            ctx.status = 400;
            ctx.body = {
              success: false,
              error: `不支持的文件类型。允许的类型: ${allowedExtensions.join(', ')}`
            };
            return;
          }

          // 验证文件大小
          if (part.data.length > maxSize) {
            ctx.status = 400;
            ctx.body = {
              success: false,
              error: `文件大小超过限制 (${Math.round(maxSize / 1024 / 1024)}MB)`
            };
            return;
          }

          // 验证 MIME 类型（如果提供了 content-type）
          if (part.contentType && allowedMimeTypes.length > 0) {
            if (!allowedMimeTypes.includes(part.contentType)) {
              ctx.status = 400;
              ctx.body = {
                success: false,
                error: `不支持的文件类型: ${part.contentType}`
              };
              return;
            }
          }

          // 生成唯一文件名
          const uniqueName = `${randomUUID()}${fileExtension}`;
          const filePath = path.join(uploadDir, uniqueName);

          // 保存文件
          await fs.writeFile(filePath, part.data);

          // 记录文件信息
          const fieldName = part.name || 'file';
          files[fieldName] = {
            name: uniqueName,
            originalname: part.filename,
            path: filePath,
            size: part.data.length,
            mimetype: part.contentType || 'application/octet-stream'
          };
        } else {
          // 普通表单字段
          if (part.name) {
            formData[part.name] = part.data.toString('utf-8');
          }
        }
      }

      // 将解析结果挂载到 ctx.request
      (ctx.request as any).body = formData;
      (ctx.request as any).files = files;
      (ctx.request as any).file = Object.values(files)[0]; // 单文件上传

      await next();
    } catch (error) {
      logger.error('文件上传处理失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '文件上传处理失败'
      };
    }
  };
};

/**
 * 解析 multipart body
 */
interface MultipartPart {
  name?: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseMultipartBody(body: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

  let offset = 0;

  while (offset < body.length) {
    // 查找 boundary
    const boundaryIndex = body.indexOf(boundaryBuffer, offset);
    if (boundaryIndex === -1) break;

    // 检查是否是结束 boundary
    const endBoundaryIndex = body.indexOf(endBoundaryBuffer, offset);
    if (endBoundaryIndex !== -1 && endBoundaryIndex < boundaryIndex) {
      break;
    }

    // 查找 part 的结束位置（下一个 boundary 或结束 boundary）
    const nextBoundaryIndex = body.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
    if (nextBoundaryIndex === -1) break;

    // 提取 part 内容（去掉前后的 CRLF）
    const partStart = boundaryIndex + boundaryBuffer.length;
    const partEnd = nextBoundaryIndex - 2; // -2 去掉 CRLF
    const partBuffer = body.slice(partStart, partEnd);

    // 解析 part headers
    const headerEnd = partBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headers = partBuffer.slice(0, headerEnd).toString('utf-8');
    const data = partBuffer.slice(headerEnd + 4);

    // 解析 Content-Disposition
    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/);

    parts.push({
      name: nameMatch?.[1],
      filename: filenameMatch?.[1],
      contentType: contentTypeMatch?.[1]?.trim(),
      data
    });

    offset = nextBoundaryIndex;
  }

  return parts;
}

/**
 * 清理上传的文件
 */
export async function cleanupUpload(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    logger.warn('清理上传文件失败:', error);
  }
}

/**
 * 默认的简历上传配置
 */
export const uploadResume = upload({
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedExtensions: ['.pdf', '.doc', '.docx', '.txt'],
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
});
