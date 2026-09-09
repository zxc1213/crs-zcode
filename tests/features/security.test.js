/**
 * security.test.js - 凭证检测正则的误报修复回归（BUG-20260909-001-69b32f）
 *
 * 背景：旧正则把「关键词 + 空白 + 自然语言」也判为凭证（如"token 消耗"），
 * 收紧后仅匹配「关键词 + 显式 =/: 分隔符 + ≥6 位密钥样 ASCII 值」。
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import securityFilter from '../../scripts/requirement-manager/features/security.js';

describe('security filter credentials 正则（BUG-20260909-001-69b32f）', () => {
  it('自然技术叙述不误报：token 作计量名词', () => {
    const r = securityFilter.filterRequirement('优化插件 token 消耗，减少上下文体积');
    expect(r.safe).to.equal(true);
    expect(r.report.severity).to.equal('none');
  });

  it('自然语言值不误报：license key: 购买后发放', () => {
    expect(securityFilter.filterRequirement('license key: 购买后发放激活').safe).to.equal(true);
  });

  it('真实凭证仍拦截：password=hunter2', () => {
    const r = securityFilter.filterRequirement('密码 password=hunter2 写死在配置');
    expect(r.safe).to.equal(false);
    expect(r.report.severity).to.equal('critical');
  });

  it('真实凭证仍拦截：db_password: s3cr3tValue', () => {
    expect(securityFilter.filterRequirement('配置 db_password: s3cr3tValue 请排查').safe).to.equal(false);
  });

  it('真实凭证仍拦截：authorization: Bearer <jwt>', () => {
    expect(
      securityFilter.filterRequirement('authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIi').safe
    ).to.equal(false);
  });

  it('值恰好 6 位命中（阈值含边界）', () => {
    expect(securityFilter.filterRequirement('password=abc123').safe).to.equal(false);
  });

  it('值 5 位不命中 credentials', () => {
    expect(securityFilter.filterRequirement('password=abc12').safe).to.equal(true);
  });

  it('分隔符两侧空格容忍：token = eyJhbGciOiJIUz', () => {
    expect(securityFilter.filterRequirement('token = eyJhbGciOiJIUz').safe).to.equal(false);
  });

  it('分隔符紧贴：token:eyJhbGciOiJIUz', () => {
    expect(securityFilter.filterRequirement('token:eyJhbGciOiJIUz').safe).to.equal(false);
  });

  it('api[_-]?key 长词优先命中：api_key=sk-proj-abcd1234', () => {
    expect(securityFilter.filterRequirement('api_key=sk-proj-abcd1234').safe).to.equal(false);
  });

  it('apiKeys 长串规则不受本次收紧影响', () => {
    const r = securityFilter.filterRequirement('密钥串 AbCdEf0123456789AbCdEf0123456789 出现在日志');
    const labels = (r.report.changes || []).map((c) => c.label);
    expect(labels).to.include('apiKeys');
  });
});
