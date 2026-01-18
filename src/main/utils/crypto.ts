import bcrypt from 'bcryptjs';
import { logger } from './logger';

const SALT_ROUNDS = 10;

/**
 * 哈希密码
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error: any) {
    logger.error('密码哈希失败:', error);
    throw new Error('密码哈希失败');
  }
}

/**
 * 比较密码
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error: any) {
    logger.error('密码比较失败:', error);
    return false;
  }
}
