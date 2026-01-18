#!/usr/bin/env node

/**
 * Electron Rebuild Script
 *
 * 此脚本用于在 Electron 环境中重建 native 模块
 * 解决 better-sqlite3 在不同 Node.js 版本下的兼容性问题
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 开始 Electron Native 模块重建...');

// 检查是否在正确的目录
if (!fs.existsSync('package.json')) {
  console.error('❌ 请在项目根目录运行此脚本');
  process.exit(1);
}

try {
  // 清理可能存在的 node_modules 中的 native 模块
  console.log('🧹 清理 native 模块缓存...');

  const modulesToRebuild = [
    'better-sqlite3',
    'sqlite3'
  ];

  modulesToRebuild.forEach(module => {
    const modulePath = path.join('node_modules', module);
    if (fs.existsSync(modulePath)) {
      console.log(`  - 清理 ${module}`);
      execSync(`rm -rf "${modulePath}"`, { stdio: 'inherit' });
    }
  });

  // 设置环境变量，使用 Electron 的 Node.js 头文件
  console.log('⚙️  配置 Electron 构建环境...');

  const electronVersion = require('electron/package.json').version;
  console.log(`  - 目标 Electron 版本: ${electronVersion}`);

  // 设置构建环境变量
  process.env.npm_config_target = electronVersion;
  process.env.npm_config_arch = process.arch;
  process.env.npm_config_target_arch = process.arch;
  process.env.npm_config_disturl = 'https://electronjs.org/headers';
  process.env.npm_config_runtime = 'electron';
  process.env.npm_config_build_from_source = 'true';

  // 重建 better-sqlite3
  console.log('📦 重建 better-sqlite3...');
  execSync('npm install better-sqlite3 --build-from-source', {
    stdio: 'inherit',
    env: process.env
  });

  console.log('✅ Native 模块重建完成！');
  console.log('');
  console.log('💡 现在可以运行以下命令启动应用：');
  console.log('   npm run build:main');
  console.log('   npm run dev:main');

} catch (error) {
  console.error('❌ 重建过程中出现错误:');
  console.error(error.message);

  console.log('');
  console.log('🔍 故障排除建议：');
  console.log('1. 确保安装了 Xcode Command Line Tools:');
  console.log('   xcode-select --install');
  console.log('2. 确保 Python 版本兼容:');
  console.log('   python --version');
  console.log('3. 尝试清理并重新安装:');
  console.log('   rm -rf node_modules package-lock.json');
  console.log('   npm install');
  console.log('   npm run electron-rebuild');

  process.exit(1);
}