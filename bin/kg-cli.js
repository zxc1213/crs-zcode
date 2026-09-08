#!/usr/bin/env node
/**
 * 知识图谱 CLI 工具
 *
 * 用法：
 *   kg-search <query>          搜索相似需求
 *   kg-stats                   显示统计信息
 *   kg-connections <req-id>     显示知识关联
 *   kg-recommend               智能推荐
 *   kg-rebuild                 重建索引
 */

import { getKnowledgeGraph, rebuildKnowledgeGraph } from '../scripts/knowledge-graph/index.js';
import { resolve } from 'path';

const requirementsPath = resolve('.requirements');

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    switch (command) {
      case 'search':
        await searchCommand(args[0], args[1]);
        break;

      case 'stats':
        await statsCommand();
        break;

      case 'connections':
        await connectionsCommand(args[0]);
        break;

      case 'recommend':
        await recommendCommand();
        break;

      case 'rebuild':
        await rebuildCommand();
        break;

      default:
        showUsage();
    }
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

/**
 * 搜索相似需求
 * @param {string} query
 * @param {string} [limit='5']
 */
async function searchCommand(query, limit = '5') {
  const graph = await getKnowledgeGraph(requirementsPath);
  const results = graph.findSimilarRequirements(query, parseInt(limit));

  console.log(`\n🔍 搜索结果: "${query}"`);
  console.log(`找到 ${results.length} 个相似需求\n`);

  results.forEach(({ item, score }, index) => {
    console.log(`${index + 1}. [${item.id}] ${item.title}`);
    console.log(`   类型: ${item.type} | 优先级: ${item.priority.level} (${item.priority.score})`);
    console.log(`   状态: ${item.status}`);
    console.log(`   相似度: ${(1 - score).toFixed(2)}`);
    console.log(`   标签: ${item.tags.join(', ') || '无'}`);
    console.log(`   关键词: ${item.keywords.join(', ')}`);
    console.log();
  });
}

/**
 * 显示统计信息
 */
async function statsCommand() {
  const graph = await getKnowledgeGraph(requirementsPath);
  const stats = graph.getStats();

  console.log('\n📊 知识图谱统计\n');
  console.log(`总需求数: ${stats.total}\n`);

  console.log('按类型:');
  Object.entries(stats.byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\n按状态:');
  Object.entries(stats.byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('\n按优先级:');
  Object.entries(stats.byPriority).forEach(([level, count]) => {
    console.log(`  ${level}: ${count}`);
  });

  console.log();
}

/**
 * 显示知识关联
 * @param {string} reqId
 */
async function connectionsCommand(reqId) {
  const graph = await getKnowledgeGraph(requirementsPath);
  const connections = graph.getKnowledgeConnections(reqId, 2);

  console.log(`\n🔗 需求关联: ${reqId}\n`);

  connections.forEach((reqs, level) => {
    console.log(`层级 ${level}:`);
    reqs.forEach((req, index) => {
      console.log(`  ${index + 1}. [${req.id}] ${req.title}`);
      console.log(`     类型: ${req.type} | 优先级: ${req.priority.level}`);
    });
    console.log();
  });
}

/**
 * 智能推荐
 */
async function recommendCommand() {
  const graph = await getKnowledgeGraph(requirementsPath);
  const recommendations = graph.recommendateRelated({
    currentType: 'features',
    currentTags: [],
    currentPriority: 'P0',
  });

  console.log('\n💡 智能推荐\n');
  console.log(`推荐 ${recommendations.length} 个相关需求:\n`);

  recommendations.forEach((req, index) => {
    console.log(`${index + 1}. [${req.id}] ${req.title}`);
    console.log(`   优先级: ${req.priority.level} (${req.priority.score})`);
    console.log(`   状态: ${req.status}`);
    console.log(`   标签: ${req.tags.join(', ') || '无'}`);
    console.log();
  });
}

/**
 * 重建索引
 */
async function rebuildCommand() {
  console.log('🔄 重建知识图谱索引...');
  await rebuildKnowledgeGraph();
  console.log('✅ 重建完成');
}

/**
 * 显示使用说明
 */
function showUsage() {
  console.log(`
知识图谱 CLI 工具

用法:
  kg-search <query> [limit]    搜索相似需求 (默认 limit=5)
  kg-stats                     显示统计信息
  kg-connections <req-id>      显示知识关联
  kg-recommend                 智能推荐
  kg-rebuild                   重建索引

示例:
  kg-search "用户登录" 10
  kg-stats
  kg-connections REQ-20260513-001
  kg-recommend
  kg-rebuild
`);
}

main();
