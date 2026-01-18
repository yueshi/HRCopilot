#!/usr/bin/env node

/**
 * SQLite 配置检查脚本
 *
 * 检查 better-sqlite3 的安装状态和配置
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 检查 SQLite 配置状态...\n');

// 1. 检查 .npmrc 配置
console.log('📝 检查 .npmrc 配置:');
const npmrcPath = path.join(__dirname, '../.npmrc');
if (fs.existsSync(npmrcPath)) {
  const npmrcContent = fs.readFileSync(npmrcPath, 'utf8');
  console.log('✅ .npmrc 文件存在');
  console.log('📄 配置内容:');
  console.log(npmrcContent);
} else {
  console.log('❌ .npmrc 文件不存在');
}

console.log('\n📦 检查 package.json 配置:');
// 2. 检查 package.json 中的依赖
const packageJsonPath = path.join(__dirname, '../package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log('✅ package.json 文件存在');

  // 检查 better-sqlite3 依赖
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};

  console.log(`📋 better-sqlite3 在 dependencies 中: ${dependencies['better-sqlite3'] ? '✅' : '❌'}`);
  console.log(`📋 @types/better-sqlite3 在 devDependencies 中: ${devDependencies['@types/better-sqlite3'] ? '✅' : '❌'}`);

  if (dependencies['better-sqlite3']) {
    console.log(`📦 better-sqlite3 版本: ${dependencies['better-sqlite3']}`);
  }
} else {
  console.log('❌ package.json 文件不存在');
}

console.log('\n📂 检查 node_modules 状态:');
// 3. 检查 node_modules 中的 better-sqlite3
const betterSqlite3Path = path.join(__dirname, '../node_modules/better-sqlite3');
if (fs.existsSync(betterSqlite3Path)) {
  console.log('✅ better-sqlite3 模块已安装');

  // 检查是否有编译产物
  const bindingPath = path.join(betterSqlite3Path, 'lib/binding.js');
  const nativePath = path.join(betterSqlite3Path, 'build/Release/better_sqlite3.node');

  if (fs.existsSync(bindingPath)) {
    console.log('✅ JS 绑定文件存在');
  } else {
    console.log('❌ JS 绑定文件不存在');
  }

  if (fs.existsSync(nativePath)) {
    console.log('✅ Native 编译产物存在');
  } else {
    console.log('❌ Native 编译产物不存在 - 可能需要重新编译');
  }
} else {
  console.log('❌ better-sqlite3 模块未安装');
}

console.log('\n🔧 检查 Electron 重建脚本:');
// 4. 检查重建脚本
const rebuildScriptPath = path.join(__dirname, 'electron-rebuild.js');
if (fs.existsSync(rebuildScriptPath)) {
  console.log('✅ electron-rebuild.js 脚本存在');
} else {
  console.log('❌ electron-rebuild.js 脚本不存在');
}

// 5. 检查 package.json 中的脚本配置
console.log('\n📜 检查 package.json 脚本配置:');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};

  console.log(`🔄 electron-rebuild 脚本: ${scripts['electron-rebuild'] ? '✅' : '❌'}`);
  console.log(`🔄 postinstall 脚本: ${scripts['postinstall'] ? '✅' : '❌'}`);

  if (scripts['postinstall']) {
    console.log(`📄 postinstall 内容: ${scripts['postinstall']}`);
  }
}

console.log('\n🎯 建议的下一步操作:');
console.log('1. 如果 better-sqlite3 未安装，运行: npm install better-sqlite3');
console.log('2. 如果缺少 Native 编译产物，运行: npm run electron-rebuild');
console.log('3. 如果仍然有问题，尝试: npm run clean-rebuild');

console.log('\n✅ SQLite 配置检查完成');