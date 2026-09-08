import fs from 'node:fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import chalk from 'chalk';

/**
 * 系统升级器
 * 应用优化决策并管理系统版本
 */
export class Upgrader {
  constructor(baseDir = '.') {
    this.baseDir = baseDir;
    this.versionsDir = path.join(baseDir, '.requirements/_system/versions');
    this.configPath = path.join(baseDir, '.requirements/_system/optimization_config.yaml');
    this.historyPath = path.join(baseDir, '.requirements/_system/upgrade_history.yaml');

    // 危险操作类型
    this.dangerousTypes = ['destructive', 'delete_data', 'drop_table', 'force_push'];
  }

  /**
   * 应用优化升级
   */
  async applyUpgrade(decision) {
    // 1. 验证升级安全性
    const validation = await this.validateUpgrade(decision);
    if (!validation.valid) {
      throw new Error(`升级验证失败: ${validation.errors.join(', ')}`);
    }

    // 2. 创建升级前备份
    const backupName = await this._createBackup();

    // 3. 应用变更
    const appliedActions = [];
    for (const action of decision.actions) {
      try {
        await this._applyAction(action);
        appliedActions.push({
          action_id: action.id,
          status: 'success',
        });
      } catch (error) {
        appliedActions.push({
          action_id: action.id,
          status: 'failed',
          error: error.message,
        });
      }
    }

    // 4. 创建版本快照
    const version = await this.createVersion(`OPT-${decision.id}`, {
      decision_id: decision.id,
      actions: decision.actions,
      backup_name: backupName,
    });

    // 5. 记录升级历史
    await this._recordUpgradeHistory({
      version: version.version_number,
      decision_id: decision.id,
      timestamp: version.timestamp,
      applied_actions: appliedActions,
      backup: backupName,
    });

    return {
      success: appliedActions.filter((a) => a.status === 'success').length > 0,
      version: version.version_number,
      applied_actions: appliedActions,
      backup: backupName,
    };
  }

  /**
   * 回滚到指定版本
   */
  async rollback(version) {
    // 1. 加载版本信息（version 来自 CLI，收敛边界防止越出 versions 目录）
    const versionsRoot = path.resolve(this.versionsDir);
    const versionPath = path.resolve(versionsRoot, path.basename(String(version)) + '.yaml');
    if (!versionPath.startsWith(versionsRoot + path.sep)) {
      throw new Error(`非法版本标识: ${version}`);
    }
    const versionData = yaml.load(await fs.readFile(versionPath, 'utf8'));

    // 2. 恢复备份配置
    if (versionData.backup_name) {
      await this._restoreBackup(versionData.backup_name);
    }

    // 3. 记录回滚历史
    await this._recordUpgradeHistory({
      type: 'rollback',
      rollback_to: version,
      timestamp: new Date().toISOString(),
      original_version: versionData.version_number,
    });

    return {
      success: true,
      rollback_to: version,
      restored_from_backup: versionData.backup_name,
    };
  }

  /**
   * 获取当前版本
   */
  async getVersion() {
    const versions = await this.getVersions();
    return versions.length > 0 ? versions[0].version_number : 'v0.0.0';
  }

  /**
   * 获取版本历史
   */
  async getVersions() {
    try {
      const files = await fs.readdir(this.versionsDir);
      const versionFiles = files.filter((f) => f.endsWith('.yaml') && !f.startsWith('backup_'));

      const versions = [];
      for (const file of versionFiles) {
        // 文件名来自目录枚举，收敛为 basename 并校验边界
        const versionsRoot = path.resolve(this.versionsDir);
        const versionPath = path.resolve(versionsRoot, path.basename(file));
        if (!versionPath.startsWith(versionsRoot + path.sep)) {
          continue;
        }
        const versionData = yaml.load(await fs.readFile(versionPath, 'utf8'));
        versions.push({
          version_number: file.replace('.yaml', ''),
          name: versionData.name,
          timestamp: versionData.timestamp,
          decision_id: versionData.decision_id,
        });
      }

      // 按时间倒序排序
      versions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return versions;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * 验证升级安全性
   */
  async validateUpgrade(decision) {
    const errors = [];

    // 检查危险操作
    for (const action of decision.actions) {
      if (this.dangerousTypes.includes(action.type)) {
        errors.push(`危险操作类型: ${action.type}`);
      }
    }

    // 检查前置条件
    for (const action of decision.actions) {
      if (action.requires && action.requires.length > 0) {
        const config = await this._loadConfig();
        for (const req of action.requires) {
          if (!(req in config)) {
            errors.push(`缺少前置条件: ${req}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 创建版本快照
   */
  async createVersion(name, metadata) {
    const versionNumber = await this._generateVersionNumber();
    const timestamp = new Date().toISOString();

    const versionData = {
      version_number: versionNumber,
      name,
      timestamp,
      config: await this._loadConfig(),
      changes: metadata.changes || [],
      decision_id: metadata.decision_id,
      actions: metadata.actions || [],
      backup_name: metadata.backup_name,
      metadata: {
        created_by: 'system',
        environment: process.env.NODE_ENV || 'development',
      },
    };

    // 保存版本文件
    const versionPath = path.join(this.versionsDir, `${versionNumber}.yaml`);
    await fs.mkdir(this.versionsDir, { recursive: true });
    await fs.writeFile(versionPath, yaml.dump(versionData));

    return versionData;
  }

  /**
   * 获取升级历史
   */
  async getUpgradeHistory() {
    try {
      const content = await fs.readFile(this.historyPath, 'utf8');
      const data = yaml.load(content);
      return data.history || [];
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * 应用单个动作
   */
  async _applyAction(action) {
    switch (action.type) {
      case 'config_change':
        await this._applyConfigChange(action);
        break;
      default:
        // 其他类型的动作只需要记录，不需要实际应用
        break;
    }
  }

  /**
   * 应用配置变更
   */
  async _applyConfigChange(action) {
    const config = await this._loadConfig();
    Object.assign(config, action.changes);
    await this._saveConfig(config);
  }

  /**
   * 创建升级前备份
   */
  async _createBackup() {
    const config = await this._loadConfig();
    const backupName = `backup_${Date.now()}.yaml`;
    const backupPath = path.join(this.versionsDir, backupName);

    await fs.mkdir(this.versionsDir, { recursive: true });
    await fs.writeFile(backupPath, yaml.dump(config));

    return backupName;
  }

  /**
   * 恢复备份配置
   */
  async _restoreBackup(backupName) {
    // backupName 来自版本元数据，收敛边界防止越出 versions 目录
    const versionsRoot = path.resolve(this.versionsDir);
    const backupPath = path.resolve(versionsRoot, path.basename(String(backupName)));
    if (!backupPath.startsWith(versionsRoot + path.sep)) {
      throw new Error(`非法备份名: ${backupName}`);
    }
    const backupData = yaml.load(await fs.readFile(backupPath, 'utf8'));
    await this._saveConfig(backupData);
  }

  /**
   * 加载配置
   */
  async _loadConfig() {
    try {
      const content = await fs.readFile(this.configPath, 'utf8');
      return yaml.load(content) || {};
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  /**
   * 保存配置
   */
  async _saveConfig(config) {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, yaml.dump(config));
  }

  /**
   * 生成版本号
   */
  async _generateVersionNumber() {
    const versions = await this.getVersions();
    const count = versions.length + 1;
    return `v0.${count}.0`;
  }

  /**
   * 记录升级历史
   */
  async _recordUpgradeHistory(entry) {
    const history = await this.getUpgradeHistory();
    history.unshift(entry);

    const data = { history };
    await fs.mkdir(path.dirname(this.historyPath), { recursive: true });
    await fs.writeFile(this.historyPath, yaml.dump(data));
  }

  /**
   * 打印升级报告
   */
  async printUpgradeReport(result) {
    console.log(chalk.bold('\n🚀 系统升级报告\n'));

    if (result.success) {
      console.log(chalk.green(`✓ 升级成功`));
      console.log(chalk.gray(`版本: ${result.version}`));
      console.log(chalk.gray(`备份: ${result.backup}`));
      console.log(chalk.gray(`应用动作: ${result.applied_actions.filter((a) => a.status === 'success').length}/${result.applied_actions.length}\n`));
    } else {
      console.log(chalk.red(`✗ 升级失败\n`));
    }

    if (result.applied_actions.some((a) => a.status === 'failed')) {
      console.log(chalk.yellow('失败的动作:'));
      result.applied_actions.filter((a) => a.status === 'failed').forEach((a) => console.log(chalk.red(`  - ${a.action_id}: ${a.error}`)));
    }
  }
}
