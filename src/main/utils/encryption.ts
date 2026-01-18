/**
 * 加密工具
 * 用于加密/解密 API Key 等敏感信息
 */

import crypto from 'crypto';
import { app } from 'electron';
import { logger } from './logger';

const ENCRYPTION_KEY = 'resumer-helper-encryption-key-2024'; // 生产环境应该从安全存储获取
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * 生成密钥
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * 加密文本
 */
export function encrypt(text: string): string {
  try {
    // 生成随机盐和 IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // 派生密钥
    const key = deriveKey(ENCRYPTION_KEY, salt);

    // 加密
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 获取认证标签
    const tag = cipher.getAuthTag();

    // 组合结果: salt + iv + tag + encrypted
    const result = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);

    return result.toString('base64');
  } catch (error) {
    logger.error('加密失败:', error);
    throw new Error(`加密失败: ${(error as Error).message}`);
  }
}

/**
 * 解密文本
 */
export function decrypt(encryptedData: string): string {
  try {
    // 解析 Base64
    const data = Buffer.from(encryptedData, 'base64');

    // 提取各部分
    const salt = data.slice(0, SALT_LENGTH);
    const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = data.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = data.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // 派生密钥
    const key = deriveKey(ENCRYPTION_KEY, salt);

    // 解密
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('解密失败:', error);
    throw new Error(`解密失败: ${(error as Error).message}`);
  }
}

/**
 * 脱敏 API Key (只显示前后各 4 位)
 */
export function maskApiKey(apiKey?: string): string | undefined {
  if (!apiKey || apiKey.length <= 8) {
    return apiKey;
  }
  const prefix = apiKey.slice(0, 4);
  const suffix = apiKey.slice(-4);
  const middle = '*'.repeat(Math.min(apiKey.length - 8, 8));
  return `${prefix}${middle}${suffix}`;
}

/**
 * 验证是否为有效的加密数据
 */
export function isValidEncryptedData(data: string): boolean {
  try {
    const buffer = Buffer.from(data, 'base64');
    const minLength = SALT_LENGTH + IV_LENGTH + TAG_LENGTH;
    return buffer.length >= minLength;
  } catch {
    return false;
  }
}
