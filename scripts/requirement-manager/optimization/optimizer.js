import fs from 'node:fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import chalk from 'chalk';

/**
 * 优化决策引擎
 * 基于评价结果生成和应用优化决策
 */
export class Optimizer {
  constructor(baseDir = '.') {
    this.baseDir = baseDir;
    this.historyPath = path.join(baseDir, '.requirements/_system/optimization_history.yaml');
    this.configPath = path.join(baseDir, '.requirements/_system/optimization_config.yaml');

    // 优先级映射
    this.priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    // 类别顺序（同优先级时使用）
    this.categoryOrder = { cost: 0, completion: 1, skill: 2, trend: 3, test: 4, maintenance: 5 };

    // 危险操作类型
    this.dangerousTypes = ['delete_data', 'drop_table', 'force_push', 'reset_repo'];

    // 安全限制
    this.maxActionsPerHour = 5;
  }

  /**
   * 生成优化决策
   */
  async generateDecision(evaluationReport) {
    const actions = [];
    const timestamp = new Date().toISOString();

    // 基于瓶颈生成决策动作
    for (const bottleneck of evaluationReport.bottlenecks || []) {
      const bottleneckActions = this._generateBottleneckActions(bottleneck);
      actions.push(...bottleneckActions);
    }

    // 基于成本效率生成决策
    if (evaluationReport.cost_efficiency) {
      const costActions = this._generateCostActions(evaluationReport.cost_efficiency);
      actions.push(...costActions);
    }

    // 基于评价生成决策
    if (evaluationReport.skill_evaluation) {
      const skillActions = this._generateSkillActions(evaluationReport.skill_evaluation);
      actions.push(...skillActions);
    }

    // 如果没有瓶颈，生成维护建议
    if (actions.length === 0) {
      actions.push(this._generateMaintenanceActions(evaluationReport));
    }

    // 优先级排序
    const prioritizedActions = await this.prioritizeActions(actions);

    return {
      id: await this.generateDecisionId(),
      timestamp,
      actions: prioritizedActions,
      metadata: {
        total_actions: prioritizedActions.length,
        critical_actions: prioritizedActions.filter((a) => a.priority === 'critical').length,
        high_actions: prioritizedActions.filter((a) => a.priority === 'high').length,
      },
    };
  }

  /**
   * 为瓶颈生成决策动作
   */
  _generateBottleneckActions(bottleneck) {
    const actions = [];

    switch (bottleneck.type) {
      case 'low_completion':
        actions.push({
          id: `act-${Date.now()}-1`,
          type: 'process_improvement',
          category: 'completion',
          priority: 'medium',
          title: '提高低完成率类型的流程',
          description: `类型 ${bottleneck.types.map((t) => t.type).join(', ')} 完成率较低`,
          changes: {
            suggested_skills: ['writing-plans', 'test-driven-development'],
            automation_increase: true,
          },
        });
        break;

      case 'low_satisfaction':
        actions.push({
          id: `act-${Date.now()}-2`,
          type: 'skill_optimization',
          category: 'skill',
          priority: 'high',
          title: '优化低满意度 Skill',
          description: `Skill ${bottleneck.skills.map((s) => s.skill).join(', ')} 需要优化`,
          changes: {
            skills_to_review: bottleneck.skills.map((s) => s.skill),
            action: 'review_and_improve_prompts',
          },
        });
        break;

      case 'high_cost':
        actions.push({
          id: `act-${Date.now()}-3`,
          type: 'config_change',
          category: 'cost',
          priority: bottleneck.severity,
          title: '控制 Token 使用',
          description: bottleneck.over_budget ? `超出预算 ${bottleneck.over_budget} tokens` : 'Token 使用接近预算上限',
          changes: {
            enable_smart_skipping: true,
            increase_cache_ttl: 7200,
            reduce_prompt_complexity: true,
          },
        });
        break;

      case 'low_cache':
        actions.push({
          id: `act-${Date.now()}-4`,
          type: 'config_change',
          category: 'cost',
          priority: 'medium',
          title: '提高缓存命中率',
          description: `当前缓存命中率仅为 ${(bottleneck.cache_hit_rate * 100).toFixed(1)}%`,
          changes: {
            cache_strategy: 'aggressive',
            prefetch_enabled: true,
            cache_ttl_multiplier: 2,
          },
        });
        break;
    }

    return actions;
  }

  /**
   * 生成成本优化动作
   */
  _generateCostActions(costEfficiency) {
    const actions = [];

    if (costEfficiency.cache_efficiency === 'poor') {
      actions.push({
        id: `act-${Date.now()}-5`,
        type: 'config_change',
        category: 'cost',
        priority: 'medium',
        title: '优化缓存配置',
        description: '缓存效率低下',
        changes: {
          increase_cache_size: true,
          enable_compression: true,
          cache_ttl: 3600,
        },
      });
    }

    if (costEfficiency.over_budget) {
      actions.push({
        id: `act-${Date.now()}-6`,
        type: 'emergency',
        category: 'cost',
        priority: 'critical',
        title: '启动紧急成本控制',
        description: 'Token 使用超出预算',
        changes: {
          enable_emergency_mode: true,
          disable_non_critical_features: true,
          reduce_ai_calls: true,
        },
      });
    }

    return actions;
  }

  /**
   * 生成 Skill 优化动作
   */
  _generateSkillActions(skillEvaluation) {
    const actions = [];

    if (skillEvaluation.worst_skill) {
      actions.push({
        id: `act-${Date.now()}-7`,
        type: 'skill_review',
        category: 'skill',
        priority: 'low',
        title: '审查最低评分 Skill',
        description: `Review ${skillEvaluation.worst_skill} skill`,
        changes: {
          skill_name: skillEvaluation.worst_skill,
          action: 'analyze_and_optimize',
        },
      });
    }

    return actions;
  }

  /**
   * 生成维护建议动作
   */
  _generateMaintenanceActions(evaluationReport) {
    return {
      id: `act-${Date.now()}-8`,
      type: 'maintenance',
      category: 'maintenance',
      priority: 'low',
      title: '系统健康检查',
      description: `系统运行良好 (${evaluationReport.system_health})`,
      changes: {
        action: 'continue_monitoring',
        next_review: 'weekly',
      },
    };
  }

  /**
   * 按优先级排序决策动作
   */
  async prioritizeActions(actions) {
    return actions.sort((a, b) => {
      // 先按优先级排序
      const priorityDiff = this.priorityOrder[a.priority] - this.priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // 同优先级按类别排序
      return this.categoryOrder[a.category] - this.categoryOrder[b.category];
    });
  }

  /**
   * 应用优化决策
   */
  async applyDecision(decision) {
    const appliedActions = [];
    const timestamp = new Date().toISOString();

    for (const action of decision.actions) {
      try {
        await this._applyAction(action);
        appliedActions.push({
          action_id: action.id,
          status: 'success',
          timestamp,
        });
      } catch (error) {
        appliedActions.push({
          action_id: action.id,
          status: 'failed',
          error: error.message,
          timestamp,
        });
      }
    }

    // 记录历史
    await this._recordHistory({
      type: 'apply',
      decision_id: decision.id,
      timestamp,
      applied_actions: appliedActions,
      total_actions: decision.actions.length,
      success_count: appliedActions.filter((a) => a.status === 'success').length,
    });

    return {
      success: appliedActions.filter((a) => a.status === 'success').length > 0,
      applied_actions: appliedActions,
      timestamp,
    };
  }

  /**
   * 应用单个决策动作
   */
  async _applyAction(action) {
    switch (action.type) {
      case 'config_change':
        await this._applyConfigChange(action);
        break;
      case 'emergency':
        await this._applyEmergencyMode(action);
        break;
      case 'skill_review':
      case 'process_improvement':
      case 'skill_optimization':
      case 'maintenance':
        // 这些类型只是建议，不需要实际应用
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
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
   * 应用紧急模式
   */
  async _applyEmergencyMode(action) {
    const config = await this._loadConfig();
    Object.assign(config, action.changes);
    config.emergency_mode = true;
    config.emergency_mode_enabled_at = new Date().toISOString();
    await this._saveConfig(config);
  }

  /**
   * 回滚优化决策
   */
  async rollback(decisionId) {
    const history = await this.getHistory();
    const applyRecord = history.find((h) => h.decision_id === decisionId && h.type === 'apply');

    if (!applyRecord) {
      throw new Error(`Decision ${decisionId} not found in history`);
    }

    const rolledBackActions = [];

    for (const appliedAction of applyRecord.applied_actions) {
      if (appliedAction.status === 'success') {
        try {
          await this._rollbackAction(appliedAction.action_id);
          rolledBackActions.push({
            action_id: appliedAction.action_id,
            status: 'success',
          });
        } catch (error) {
          rolledBackActions.push({
            action_id: appliedAction.action_id,
            status: 'failed',
            error: error.message,
          });
        }
      }
    }

    // 记录回滚历史
    await this._recordHistory({
      type: 'rollback',
      decision_id: decisionId,
      timestamp: new Date().toISOString(),
      rolled_back_actions: rolledBackActions,
      original_apply: applyRecord,
    });

    return {
      success: rolledBackActions.filter((a) => a.status === 'success').length > 0,
      rolled_back_actions: rolledBackActions,
    };
  }

  /**
   * 回滚单个动作
   */
  async _rollbackAction(actionId) {
    // 对于配置变更，恢复默认配置
    const config = await this._loadConfig();
    delete config.emergency_mode;
    delete config.emergency_mode_enabled_at;
    await this._saveConfig(config);
  }

  /**
   * 验证决策安全性
   */
  async validateDecision(decision) {
    const errors = [];

    // 检查危险操作
    for (const action of decision.actions) {
      if (this.dangerousTypes.includes(action.type)) {
        errors.push(`Dangerous action type: ${action.type}`);
      }
    }

    // 检查频率限制
    const history = await this.getHistory();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentApplies = history.filter((h) => h.type === 'apply' && new Date(h.timestamp).getTime() > oneHourAgo);

    if (recentApplies.length >= this.maxActionsPerHour) {
      errors.push(`Decision frequency limit exceeded: ${recentApplies.length}/${this.maxActionsPerHour} per hour`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取优化历史
   */
  async getHistory() {
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
   * 生成决策 ID
   */
  async generateDecisionId() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // 确保唯一性：查找当天已有的决策数量
    const history = await this.getHistory();
    const todayPrefix = `OPT-${dateStr}`;
    const todayCount = history.filter((h) => h.decision_id && h.decision_id.startsWith(todayPrefix)).length;
    const counter = todayCount + 1;

    return `${todayPrefix}-${String(counter).padStart(3, '0')}`;
  }

  /**
   * 记录历史
   */
  async _recordHistory(entry) {
    const history = await this.getHistory();
    history.unshift(entry); // 添加到开头

    const data = { history };
    await fs.mkdir(path.dirname(this.historyPath), { recursive: true });
    await fs.writeFile(this.historyPath, yaml.dump(data));
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
   * 检查决策是否已存在
   */
  async _decisionExists(decisionId) {
    const history = await this.getHistory();
    return history.some((h) => h.decision_id === decisionId);
  }

  /**
   * 打印决策报告
   */
  async printDecision(decision) {
    console.log(chalk.bold('\n🎯 优化决策\n'));
    console.log(chalk.gray(`决策 ID: ${decision.id}`));
    console.log(chalk.gray(`时间: ${new Date(decision.timestamp).toLocaleString('zh-CN')}`));
    console.log(chalk.gray(`动作数量: ${decision.metadata.total_actions}\n`));

    for (const action of decision.actions) {
      const priorityColors = {
        critical: chalk.red.bold,
        high: chalk.red,
        medium: chalk.yellow,
        low: chalk.blue,
      };
      const color = priorityColors[action.priority] || chalk.gray;

      console.log(color(`[${action.priority.toUpperCase()}] ${action.title}`));
      if (action.description) {
        console.log(chalk.gray(`  ${action.description}`));
      }
      if (action.changes) {
        console.log(chalk.gray(`  变更: ${JSON.stringify(action.changes, null, 2).split('\n').join('\n  ')}`));
      }
      console.log();
    }
  }
}
