import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  STATUSES,
  ACTIVE_STATUSES,
  TYPE_DIRS,
  TYPE_PREFIXES,
  EVENT_TYPES,
  normalizeStatus,
  isActiveStatus,
  metaStatus,
  requirementDate,
  normalizeMeta,
} from '../../scripts/requirement-manager/core/schema.js';

describe('core/schema - 唯一口径源', () => {
  describe('常量定义', () => {
    it('状态生命周期完整且有序', () => {
      expect(STATUSES).to.deep.equal(['planning', 'analyzed', 'implementing', 'review', 'done']);
    });

    it('活跃状态不含 done', () => {
      expect(ACTIVE_STATUSES).to.not.include('done');
      expect(ACTIVE_STATUSES).to.have.lengthOf(4);
    });

    it('类型目录使用 refactors 唯一拼写', () => {
      expect(TYPE_DIRS.refactor).to.equal('refactors');
      expect(Object.values(TYPE_DIRS)).to.not.include('refactorings');
    });

    it('类型前缀与目录一一对应', () => {
      expect(Object.keys(TYPE_DIRS)).to.deep.equal(Object.keys(TYPE_PREFIXES));
    });

    it('事件类型包含核心事件', () => {
      for (const type of ['requirement_created', 'status_changed', 'requirement_changed', 'retro_completed', 'lesson_saved']) {
        expect(EVENT_TYPES).to.include(type);
      }
    });
  });

  describe('normalizeStatus - 旧口径归一', () => {
    it('规范状态原样返回', () => {
      for (const status of STATUSES) {
        expect(normalizeStatus(status)).to.equal(status);
      }
    });

    it('旧状态词表映射到规范状态', () => {
      expect(normalizeStatus('open')).to.equal('planning');
      expect(normalizeStatus('in_progress')).to.equal('implementing');
      expect(normalizeStatus('testing')).to.equal('review');
      expect(normalizeStatus('completed')).to.equal('done');
      expect(normalizeStatus('closed')).to.equal('done');
    });

    it('未知状态返回 null', () => {
      expect(normalizeStatus('weird')).to.be.null;
      expect(normalizeStatus('')).to.be.null;
      expect(normalizeStatus(null)).to.be.null;
    });
  });

  describe('isActiveStatus', () => {
    it('活跃状态返回 true', () => {
      expect(isActiveStatus('planning')).to.be.true;
      expect(isActiveStatus('implementing')).to.be.true;
      expect(isActiveStatus('done')).to.be.false;
    });

    it('旧口径也能判定', () => {
      expect(isActiveStatus('in_progress')).to.be.true;
      expect(isActiveStatus('completed')).to.be.false;
    });
  });

  describe('requirementDate - 日期字段兼容', () => {
    it('规范字段优先', () => {
      const meta = { created: '2026-09-01T00:00:00Z', createdAt: '2026-08-01T00:00:00Z', created_at: '2026-07-01T00:00:00Z' };
      expect(requirementDate(meta, 'created')).to.equal('2026-09-01T00:00:00Z');
    });

    it('旧字段回退', () => {
      expect(requirementDate({ createdAt: '2026-08-01T00:00:00Z' }, 'created')).to.equal('2026-08-01T00:00:00Z');
      expect(requirementDate({ created_at: '2026-07-01T00:00:00Z' }, 'created')).to.equal('2026-07-01T00:00:00Z');
    });

    it('缺失返回 null', () => {
      expect(requirementDate({}, 'created')).to.be.null;
      expect(requirementDate(null, 'created')).to.be.null;
    });
  });

  describe('normalizeMeta / metaStatus', () => {
    it('状态归一且不修改原对象', () => {
      const meta = { status: 'in_progress' };
      const normalized = normalizeMeta(meta);
      expect(normalized.status).to.equal('implementing');
      expect(meta.status).to.equal('in_progress');
    });

    it('未知状态回退 planning', () => {
      expect(metaStatus({ status: 'garbage' })).to.equal('planning');
    });
  });
});
