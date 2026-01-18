import crypto from 'crypto';
import type { ParsedResumeInfo } from '../../shared/types';

/**
 * 哈希计算服务
 * 用于计算简历内容哈希和个人标识哈希
 */
export class HashService {
  /**
   * 计算文件内容的 SHA256 哈希
   * 用于检测完全相同的文件
   *
   * @param buffer - 文件内容的 Buffer
   * @returns 64位十六进制哈希字符串
   */
  static calculateContentHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * 计算文本内容的 SHA256 哈希
   * 用于检测相同的文本内容
   *
   * @param text - 文本内容
   * @returns 64位十六进制哈希字符串
   */
  static calculateTextHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * 计算个人标识哈希
   * 基于姓名+手机号+邮箱的组合生成，用于识别同一人
   *
   * @param parsedInfo - 解析后的简历信息
   * @returns 个人标识哈希字符串，如果没有足够的个人信息则返回 null
   */
  static calculatePersonHash(parsedInfo: ParsedResumeInfo | null | undefined): string | null {
    if (!parsedInfo) {
      return null;
    }

    // 收集可用于识别个人的信息
    const identifiers: string[] = [];

    // 姓名（必需）
    if (parsedInfo.name && parsedInfo.name.trim()) {
      identifiers.push(parsedInfo.name.trim().toLowerCase());
    }

    // 手机号（可选，但能提高准确性）
    if (parsedInfo.phone && parsedInfo.phone.trim()) {
    // 规范化手机号：移除所有非数字字符
      const normalizedPhone = parsedInfo.phone.replace(/\D/g, '');
      if (normalizedPhone.length >= 11) {
        identifiers.push(normalizedPhone);
      }
    }

    // 邮箱（可选，但能提高准确性）
    if (parsedInfo.email && parsedInfo.email.trim()) {
      identifiers.push(parsedInfo.email.trim().toLowerCase());
    }

    // 至少要有姓名才能生成个人标识
    if (identifiers.length < 1) {
      return null;
    }

    // 使用稳定的排序后计算哈希
    identifiers.sort();
    const combined = identifiers.join('|');

    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * 生成下一个版本标签
   * 基于现有版本标签生成新的标签
   *
   * @param currentVersions - 现有的版本标签列表
   * @returns 新的版本标签（如 v1.1、v2.0 等）
   */
  static generateVersionLabel(currentVersions: string[]): string {
    // 过滤出符合语义化版本格式的标签（如 v1.0、v2.1）
    const versionPattern = /^v(\d+)\.(\d+)$/;
    const numericVersions = currentVersions
      .filter(v => versionPattern.test(v))
      .map(v => {
        const match = v.match(versionPattern);
        if (match) {
          return {
            major: parseInt(match[1], 10),
            minor: parseInt(match[2], 10),
          };
        }
        return null;
      })
      .filter((v): v is { major: number; minor: number } => v !== null);

    // 如果没有现有版本，返回 v1.0
    if (numericVersions.length === 0) {
      return 'v1.0';
    }

    // 找到最大的版本号
    const maxVersion = numericVersions.reduce((max, current) => {
      if (current.major > max.major) {
        return current;
      }
      if (current.major === max.major && current.minor > max.minor) {
        return current;
      }
      return max;
    }, numericVersions[0]);

    // 递增次版本号（假设是变体）
    return `v${maxVersion.major}.${maxVersion.minor + 1}`;
  }

  /**
   * 比较两个哈希是否相等
   * 用于安全地比较可能为 undefined/null 的哈希值
   *
   * @param hash1 - 第一个哈希
   * @param hash2 - 第二个哈希
   * @returns 是否相等
   */
  static hashEquals(hash1: string | null | undefined, hash2: string | null | undefined): boolean {
    if (!hash1 || !hash2) {
      return false;
    }
    return hash1 === hash2;
  }
}
