import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { logger } from '../utils/logger';

export interface ParsedContent {
  text: string;
  metadata?: {
    pageCount?: number;
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

export class FileParserService {
  /**
   * 解析文件内容
   */
  static async parseFile(filePath: string, mimetype: string): Promise<ParsedContent> {
    try {
      switch (mimetype) {
        case 'application/pdf':
          return await this.parsePDF(filePath);
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.parseWord(filePath);
        default:
          throw new Error(`不支持的文件类型: ${mimetype}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error('文件解析失败:', error);
      throw new Error(`文件解析失败: ${errorMessage}`);
    }
  }

  /**
   * 解析PDF文件
   */
  private static async parsePDF(filePath: string): Promise<ParsedContent> {
    try {
      // 使用异步读取文件
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);

      return {
        text: data.text,
        metadata: {
          pageCount: data.numpages,
          title: data.info?.Title,
          author: data.info?.Author,
          subject: data.info?.Subject,
          creator: data.info?.Creator,
          producer: data.info?.Producer,
          creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
          modificationDate: data.info?.ModDate ? new Date(data.info.ModDate) : undefined
        }
      };
    } catch (error) {
      logger.error('PDF解析失败:', error);
      throw new Error(`PDF解析失败: ${(error as Error).message}`);
    }
  }

  /**
   * 解析Word文件
   */
  private static async parseWord(filePath: string): Promise<ParsedContent> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });

      if (result.messages.length > 0) {
        logger.warn('Word文件解析警告:', result.messages);
      }

      return {
        text: result.value
      };
    } catch (error) {
      logger.error('Word文件解析失败:', error);
      throw new Error(`Word文件解析失败: ${(error as Error).message}`);
    }
  }

  /**
   * 清理解析后的文本
   */
  static cleanText(text: string): string {
    if (!text) return '';

    return text
      // 移除多余的空白字符
      .replace(/\s+/g, ' ')
      // 移除特殊字符
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // 移除多余的换行
      .replace(/\n\s*\n/g, '\n')
      // 去除首尾空白
      .trim();
  }

  /**
   * 验证文件是否存在
   */
  static async validateFile(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * 获取文件大小
   */
  static async getFileSize(filePath: string): Promise<number> {
    try {
      const stat = await fs.stat(filePath);
      return stat.size;
    } catch {
      return 0;
    }
  }

  /**
   * 删除文件
   */
  static async deleteFile(filePath: string): Promise<boolean> {
    try {
      if (await this.validateFile(filePath)) {
        await fs.unlink(filePath);
        logger.info(`文件已删除: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('文件删除失败:', error);
      return false;
    }
  }
}
