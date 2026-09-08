/**
 * RequirementManager 演示脚本
 *
 * 展示主入口功能的使用方法
 */

import RequirementManager from './index.js';
import { formatOutput } from './index.js';

async function demo() {
  const manager = new RequirementManager(process.cwd());

  console.log('=== 演示 1: 创建新功能需求 ===\n');
  const result1 = await manager.handle('添加用户登录功能', {});
  formatOutput(result1);

  console.log('\n\n=== 演示 2: 创建 Bug 修复需求 ===\n');
  const result2 = await manager.handle('--bug 登录页面在移动端显示异常', {});
  formatOutput(result2);

  console.log('\n\n=== 演示 3: 安全检查演示 ===\n');
  const result3 = await manager.handle('添加用户登录功能，密码是 secret123', {});
  formatOutput(result3);

  console.log('\n\n=== 演示 4: 查询命令 ===\n');
  const result4 = await manager.handle('--dashboard', {});
  formatOutput(result4);
}

demo().catch(console.error);
