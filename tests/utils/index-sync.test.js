import { describe, it, beforeEach, afterEach } from 'mocha';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { expect } from 'chai';
import {
  isDocumentFilled,
  scanSubDocuments,
  scanSubDirectoryStatus,
} from '../../scripts/requirement-manager/utils/document-tracker.js';
import { syncIndexTables } from '../../scripts/requirement-manager/utils/plan-sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.join(__dirname, '../temp-test-index-sync');

describe('index-sync', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('isDocumentFilled(filePath)', () => {
    it('should return false for skeleton files with TODO comments', async () => {
      const filePath = path.join(TEST_DIR, 'skeleton.md');
      await fs.writeFile(
        filePath,
        `# 背景与目标

## 背景

<!-- TODO: 描述业务背景和要解决的问题 -->

## 目标

<!-- TODO: 列出要达成的具体目标 -->

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| 2026-05-26 | 创建 |
`,
        'utf-8'
      );
      expect(await isDocumentFilled(filePath)).to.be.false;
    });

    it('should return true for files with real content', async () => {
      const filePath = path.join(TEST_DIR, 'filled.md');
      await fs.writeFile(
        filePath,
        `# 背景与目标

## 背景

开发者在本地开发时经常需要修改 hosts 文件来将域名指向本地或测试服务器。手动编辑 hosts 文件存在以下痛点：
- 路径深、记不住
- 需要管理员权限，容易忘记
- 手动编辑容易出错
- 无法快速切换多组配置

## 目标

提供一个命令行工具，安全、便捷地管理 hosts 文件条目。

## 范围

### 包含

- 单个脚本文件
- 支持：添加、删除、查询、备份、恢复

### 不包含

- GUI 界面
- 远程 hosts 管理

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| 2026-05-26 | 创建 |
`,
        'utf-8'
      );
      expect(await isDocumentFilled(filePath)).to.be.true;
    });

    it('should return false for small files (<500 bytes)', async () => {
      const filePath = path.join(TEST_DIR, 'tiny.md');
      await fs.writeFile(filePath, `# Title\n\nSome content here.`, 'utf-8');
      expect(await isDocumentFilled(filePath)).to.be.false;
    });

    it('should return false for non-existent files', async () => {
      expect(await isDocumentFilled(path.join(TEST_DIR, 'nonexistent.md'))).to.be.false;
    });
  });

  describe('scanSubDocuments(dirPath)', () => {
    it('should scan .md files in a directory', async () => {
      const dirPath = path.join(TEST_DIR, 'spec');
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(path.join(dirPath, 'background.md'), '# bg', 'utf-8');
      await fs.writeFile(path.join(dirPath, 'design.md'), '# design', 'utf-8');
      await fs.writeFile(path.join(dirPath, 'notes.txt'), 'notes', 'utf-8');

      const files = await scanSubDocuments(dirPath);
      expect(files).to.deep.equal(['background.md', 'design.md']);
    });

    it('should return empty array for non-existent directory', async () => {
      const files = await scanSubDocuments(path.join(TEST_DIR, 'nonexistent'));
      expect(files).to.deep.equal([]);
    });
  });

  describe('scanSubDirectoryStatus(reqPath)', () => {
    it('should return filled/unfilled status for all sub-directories', async () => {
      const reqPath = path.join(TEST_DIR, 'FEAT-001');
      const specDir = path.join(reqPath, 'spec');
      const planDir = path.join(reqPath, 'plan');
      const tcDir = path.join(reqPath, 'test-cases');

      await fs.mkdir(specDir, { recursive: true });
      await fs.mkdir(planDir, { recursive: true });
      await fs.mkdir(tcDir, { recursive: true });

      await fs.writeFile(path.join(specDir, 'background.md'), longContent(), 'utf-8');
      await fs.writeFile(
        path.join(specDir, 'design.md'),
        `# 设计\n\n<!-- TODO: 描述设计方案 -->\n\n## 变更记录\n| 日期 | 内容 |\n| ---- | ---- |\n| 2026-05-26 | 创建 |\n`,
        'utf-8'
      );
      await fs.writeFile(
        path.join(planDir, 'tasks.md'),
        `# 任务\n\n<!-- TODO: 填充任务 -->\n`,
        'utf-8'
      );
      await fs.writeFile(
        path.join(planDir, 'milestones.md'),
        `# 里程碑\n\n<!-- TODO: 填充 -->\n`,
        'utf-8'
      );
      await fs.writeFile(path.join(tcDir, 'positive.md'), longContent(), 'utf-8');
      await fs.writeFile(path.join(tcDir, 'negative.md'), `# 异常\n\n<!-- TODO -->\n`, 'utf-8');
      await fs.writeFile(path.join(tcDir, 'boundary.md'), `# 边界\n\n<!-- TODO -->\n`, 'utf-8');

      const status = await scanSubDirectoryStatus(reqPath);

      expect(status.spec['background.md']).to.be.true;
      expect(status.spec['design.md']).to.be.false;
      expect(status.plan['tasks.md']).to.be.false;
      expect(status.plan['milestones.md']).to.be.false;
      expect(status['test-cases']['positive.md']).to.be.true;
      expect(status['test-cases']['negative.md']).to.be.false;
      expect(status['test-cases']['boundary.md']).to.be.false;
    });
  });

  describe('syncIndexTables(reqPath)', () => {
    it('should update index table from 待填充 to 已填充 when sub-file is filled', async () => {
      const reqPath = path.join(TEST_DIR, 'FEAT-002');

      const specDir = path.join(reqPath, 'spec');
      await fs.mkdir(specDir, { recursive: true });
      await fs.writeFile(path.join(specDir, 'background.md'), longContent(), 'utf-8');

      const specPath = path.join(reqPath, 'spec.md');
      await fs.writeFile(
        specPath,
        `# FEAT-002 — 测试

## 元数据

- **ID**: FEAT-002
- **状态**: planning

## 详细文档

| 章节 | 文件 | 状态 |
| ---- | ---- | ---- |
| 背景与目标 | [spec/background.md](spec/background.md) | 待填充 |
| 用户故事 | [spec/user-stories.md](spec/user-stories.md) | 待填充 |
| 设计方案 | [spec/design.md](spec/design.md) | 待填充 |
| 接口定义 | [spec/api.md](spec/api.md) | 待填充 |
| 决策记录 | [spec/decisions.md](spec/decisions.md) | 待填充 |

## 变更历史

| 日期 | 变更内容 | 影响分析 |
| ---- | -------- | -------- |
| 2026-05-26 | 创建需求 | - |
`,
        'utf-8'
      );

      await fs.mkdir(path.join(reqPath, 'plan'), { recursive: true });
      await fs.mkdir(path.join(reqPath, 'test-cases'), { recursive: true });

      const result = await syncIndexTables(reqPath);

      expect(result.updated).to.include('spec.md');

      const updatedSpec = await fs.readFile(specPath, 'utf-8');
      expect(updatedSpec).to.include(
        '| 背景与目标 | [spec/background.md](spec/background.md) | 已填充 |'
      );
      expect(updatedSpec).to.include(
        '| 用户故事 | [spec/user-stories.md](spec/user-stories.md) | 待填充 |'
      );
    });

    it('should skip when all files are already skeleton', async () => {
      const reqPath = path.join(TEST_DIR, 'FEAT-003');

      const specDir = path.join(reqPath, 'spec');
      const planDir = path.join(reqPath, 'plan');
      const tcDir = path.join(reqPath, 'test-cases');
      await fs.mkdir(specDir, { recursive: true });
      await fs.mkdir(planDir, { recursive: true });
      await fs.mkdir(tcDir, { recursive: true });

      await fs.writeFile(path.join(specDir, 'background.md'), skeletonContent(), 'utf-8');
      await fs.writeFile(path.join(planDir, 'tasks.md'), skeletonContent(), 'utf-8');
      await fs.writeFile(path.join(tcDir, 'positive.md'), skeletonContent(), 'utf-8');

      const specPath = path.join(reqPath, 'spec.md');
      const planPath = path.join(reqPath, 'plan.md');
      const tcPath = path.join(reqPath, 'test-cases.md');

      await fs.writeFile(
        specPath,
        `# FEAT-003\n\n| 背景与目标 | [spec/background.md](spec/background.md) | 待填充 |\n`,
        'utf-8'
      );
      await fs.writeFile(
        planPath,
        `# FEAT-003\n\n| 任务分解 | [plan/tasks.md](plan/tasks.md) | 待填充 |\n`,
        'utf-8'
      );
      await fs.writeFile(
        tcPath,
        `# FEAT-003\n\n| 正向用例 | [test-cases/positive.md](test-cases/positive.md) | 待填充 |\n`,
        'utf-8'
      );

      const result = await syncIndexTables(reqPath);

      expect(result.updated).to.deep.equal([]);
      expect(result.skipped.length).to.equal(3);
    });

    it('should handle missing sub-directories gracefully', async () => {
      const reqPath = path.join(TEST_DIR, 'FEAT-004');
      await fs.mkdir(reqPath, { recursive: true });

      const specPath = path.join(reqPath, 'spec.md');
      await fs.writeFile(
        specPath,
        `# FEAT-004\n\n| 背景与目标 | [spec/background.md](spec/background.md) | 待填充 |\n`,
        'utf-8'
      );

      const result = await syncIndexTables(reqPath);
      expect(result.updated).to.deep.equal([]);
    });

    it('should update all three index files', async () => {
      const reqPath = path.join(TEST_DIR, 'FEAT-005');
      const specDir = path.join(reqPath, 'spec');
      const planDir = path.join(reqPath, 'plan');
      const tcDir = path.join(reqPath, 'test-cases');

      await fs.mkdir(specDir, { recursive: true });
      await fs.mkdir(planDir, { recursive: true });
      await fs.mkdir(tcDir, { recursive: true });

      await fs.writeFile(path.join(specDir, 'background.md'), longContent(), 'utf-8');
      await fs.writeFile(path.join(specDir, 'design.md'), longContent(), 'utf-8');
      await fs.writeFile(path.join(planDir, 'tasks.md'), longContent(), 'utf-8');
      await fs.writeFile(path.join(tcDir, 'positive.md'), longContent(), 'utf-8');
      await fs.writeFile(path.join(tcDir, 'negative.md'), longContent(), 'utf-8');

      await fs.writeFile(
        path.join(reqPath, 'spec.md'),
        `# FEAT-005\n\n| 背景与目标 | [spec/background.md](spec/background.md) | 待填充 |\n| 设计方案 | [spec/design.md](spec/design.md) | 待填充 |\n`,
        'utf-8'
      );
      await fs.writeFile(
        path.join(reqPath, 'plan.md'),
        `# FEAT-005\n\n| 任务分解 | [plan/tasks.md](plan/tasks.md) | 待填充 |\n`,
        'utf-8'
      );
      await fs.writeFile(
        path.join(reqPath, 'test-cases.md'),
        `# FEAT-005\n\n| 正向用例 | [test-cases/positive.md](test-cases/positive.md) | 待填充 |\n| 异常用例 | [test-cases/negative.md](test-cases/negative.md) | 待填充 |\n`,
        'utf-8'
      );

      const result = await syncIndexTables(reqPath);

      expect(result.updated).to.include('spec.md');
      expect(result.updated).to.include('plan.md');
      expect(result.updated).to.include('test-cases.md');

      const spec = await fs.readFile(path.join(reqPath, 'spec.md'), 'utf-8');
      expect(spec).to.include('| 背景与目标 | [spec/background.md](spec/background.md) | 已填充 |');
      expect(spec).to.include('| 设计方案 | [spec/design.md](spec/design.md) | 已填充 |');

      const plan = await fs.readFile(path.join(reqPath, 'plan.md'), 'utf-8');
      expect(plan).to.include('| 任务分解 | [plan/tasks.md](plan/tasks.md) | 已填充 |');

      const tc = await fs.readFile(path.join(reqPath, 'test-cases.md'), 'utf-8');
      expect(tc).to.include(
        '| 正向用例 | [test-cases/positive.md](test-cases/positive.md) | 已填充 |'
      );
      expect(tc).to.include(
        '| 异常用例 | [test-cases/negative.md](test-cases/negative.md) | 已填充 |'
      );
    });
  });
});

function longContent() {
  return `# 标题

## 第一节

这是第一段实质内容，用于测试文档是否已被填充。需要足够的文字来超过500字节阈值，确保检测逻辑正确。

## 第二节

这是第二段实质内容，继续增加文件大小。实际项目中这里会包含具体的业务逻辑描述、技术方案说明等。

## 第三节

这是第三段实质内容。骨架文件只有 TODO 注释，而真实内容会包含详细的设计决策和实现细节。

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| 2026-05-26 | 创建 |
`;
}

function skeletonContent() {
  return `# 标题

<!-- TODO: 填充内容 -->

## 变更记录

| 日期 | 内容 |
| ---- | ---- |
| 2026-05-26 | 创建 |
`;
}
