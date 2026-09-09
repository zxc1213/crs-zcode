/**
 * scheduler.test.js - 阶段调度器与类型路由测试
 *
 * v1.3 瘦身后调度器只管执行模式与阶段顺序；本文件保护其核心契约，
 * 防止后续改动悄悄改变步骤/检查点生成行为。
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { schedule, generateSkillPrompt, getSupportedModes, getModeConfig, Scheduler } from '../../scripts/requirement-manager/core/scheduler.js';
import { getRoute, getSkillChain, getPhases, getNextPhase, getSupportedTypes, isTypeSupported } from '../../scripts/requirement-manager/core/router.js';

describe('core/router - 类型路由', () => {
  it('支持五种规范类型', () => {
    expect(getSupportedTypes()).to.deep.equal(['feature', 'bug', 'question', 'adjustment', 'refactor']);
    expect(isTypeSupported('feature')).to.equal(true);
    expect(isTypeSupported('unknown')).to.equal(false);
  });

  it('getRoute 返回副本（外部修改不影响内部状态）', () => {
    const route = getRoute('feature');
    route.primarySkill = 'hacked';
    expect(getRoute('feature').primarySkill).to.equal('brainstorming');
  });

  it('skill 链：primarySkill 在前，optionalSkills 在后', () => {
    expect(getSkillChain('feature')).to.deep.equal(['brainstorming', 'writing-plans']);
    expect(getSkillChain('question')).to.deep.equal(['research']);
    expect(getSkillChain('unknown')).to.deep.equal([]);
  });

  it('phases 与 getNextPhase 环游', () => {
    const phases = getPhases('bug');
    expect(phases).to.deep.equal(['investigation', 'diagnosis', 'fix', 'verification']);
    expect(getNextPhase('bug', 'investigation')).to.equal('diagnosis');
    expect(getNextPhase('bug', 'verification')).to.equal(null);
    expect(getNextPhase('bug', 'not_a_phase')).to.equal('investigation');
  });
});

describe('core/scheduler - 阶段调度', () => {
  it('生成步骤：primary 必需在前，阶段对齐', () => {
    const plan = schedule({ type: 'feature', id: 'FEAT-X', mode: 'semi', description: '登录功能' });

    expect(plan.steps).to.have.lengthOf(2);
    expect(plan.steps[0]).to.include({ skill: 'brainstorming', phase: 'analysis', required: true });
    expect(plan.steps[1]).to.include({ skill: 'writing-plans', phase: 'planning', required: false });
    expect(plan.steps.map((s) => s.step)).to.deep.equal([1, 2]);
  });

  it('semi 模式生成检查点，fully 模式不生成', () => {
    const semi = schedule({ type: 'bug', id: 'BUG-X', mode: 'semi', description: 'x' });
    expect(semi.checkpoints).to.have.lengthOf(1);
    expect(semi.checkpoints[0].afterStep).to.equal(1);
    expect(semi.checkpoints[0].requiresConfirmation).to.equal(true);

    const fully = schedule({ type: 'bug', id: 'BUG-X', mode: 'fully', description: 'x' });
    expect(fully.checkpoints).to.have.lengthOf(0);
    expect(fully.autoContinue).to.equal(true);
  });

  it('元数据汇总 primarySkill 与步骤数', () => {
    const plan = schedule({ type: 'refactor', id: 'REF-X', mode: 'semi', description: 'x' });
    expect(plan.metadata.primarySkill).to.equal('code-explorer');
    expect(plan.metadata.totalSteps).to.equal(2);
    expect(plan.metadata.totalCheckpoints).to.equal(1);
  });

  it('未知类型与未知模式直接拒绝', () => {
    expect(() => schedule({ type: 'nope', id: 'X', mode: 'semi', description: 'x' })).to.throw('不支持的需求类型');
    expect(() => schedule({ type: 'feature', id: 'X', mode: 'nope', description: 'x' })).to.throw('不支持的执行模式');
  });

  it('generateSkillPrompt 通用模板包含上下文', () => {
    const prompt = generateSkillPrompt('brainstorming', { id: 'FEAT-1', type: 'feature', description: '购物车' });
    expect(prompt).to.include('FEAT-1');
    expect(prompt).to.include('购物车');
    expect(prompt).to.include('brainstorming');
  });

  it('执行模式口径稳定', () => {
    expect(getSupportedModes()).to.deep.equal(['fully', 'semi', 'manual']);
    expect(getModeConfig('semi').requiresCheckpoints).to.equal(true);
    expect(getModeConfig('nope')).to.equal(null);
  });

  it('Scheduler 类可独立实例化（多项目隔离）', () => {
    const s = new Scheduler('/tmp/project-a');
    expect(s.baseDir).to.equal('/tmp/project-a');
    const plan = s.schedule({ type: 'question', id: 'QUES-1', mode: 'manual', description: 'x' });
    expect(plan.modeDescription).to.equal('手动执行');
  });
});
