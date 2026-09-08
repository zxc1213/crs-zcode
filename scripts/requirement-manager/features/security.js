/**
 * Security Filter - 安全过滤器
 * 检测和过滤敏感信息，保护隐私和数据安全
 */

class SecurityFilter {
  constructor() {
    // 敏感信息模式定义
    this.patterns = {
      // 凭证类：password, token, key, secret, api_key
      credentials: {
        regex: /(?:password|passwd|pwd|token|key|secret|api[_-]?key|authorization|auth)[:\s]*[=:]?\s*[^\s'"{>]+/gi,
        label: 'credentials',
        replacement: '[REDACTED_CREDENTIAL]',
      },

      // 个人身份信息：SSN, 邮箱, 身份证
      pii: {
        regex: /\b\d{3}[-]?\d{2}[-]?\d{4}\b|[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b|\b[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]\b|\b[1-9]\d{5}\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}\b/gi,
        label: 'pii',
        replacement: '[REDACTED_PII]',
      },

      // 内部标记
      internal: {
        regex: /\b(confidential|internal|secret|restricted|proprietary|do not share|private)\b/gi,
        label: 'internal',
        replacement: '[INTERNAL]',
      },

      // API密钥：32字符以上的字符串
      apiKeys: {
        regex: /\b[a-zA-Z0-9_-]{32,}\b/g,
        label: 'apiKeys',
        replacement: '[REDACTED_KEY]',
      },

      // IP地址
      ips: {
        regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
        label: 'ips',
        replacement: '[REDACTED_IP]',
      },
    };
  }

  /**
   * 检测文本中的敏感信息
   * @param {string} text - 待检测文本
   * @returns {Object} - 检测结果 { detected: boolean, findings: Array, details: Object }
   */
  detect(text) {
    if (!text || typeof text !== 'string') {
      return {
        detected: false,
        findings: [],
        details: {},
      };
    }

    const findings = [];
    const details = {};

    for (const [category, config] of Object.entries(this.patterns)) {
      const matches = text.match(config.regex);
      if (matches && matches.length > 0) {
        findings.push({
          category,
          label: config.label,
          count: matches.length,
          samples: matches.slice(0, 3), // 最多显示3个样本
        });
        details[category] = matches;
      }
    }

    return {
      detected: findings.length > 0,
      findings,
      details,
    };
  }

  /**
   * 对文本进行脱敏处理
   * @param {string} text - 原始文本
   * @returns {Object} - { sanitized: string, report: Object }
   */
  sanitize(text) {
    if (!text || typeof text !== 'string') {
      return {
        sanitized: text || '',
        report: {
          originalLength: 0,
          sanitizedLength: 0,
          redactions: [],
        },
      };
    }

    let sanitized = text;
    const redactions = [];

    for (const [category, config] of Object.entries(this.patterns)) {
      const matches = sanitized.match(config.regex);
      if (matches && matches.length > 0) {
        redactions.push({
          category,
          label: config.label,
          count: matches.length,
          replacement: config.replacement,
        });
        sanitized = sanitized.replace(config.regex, config.replacement);
      }
    }

    return {
      sanitized,
      report: {
        originalLength: text.length,
        sanitizedLength: sanitized.length,
        redactions,
      },
    };
  }

  /**
   * 验证文本并返回警告信息
   * @param {string} text - 待验证文本
   * @returns {Object} - { valid: boolean, warnings: Array, severity: string }
   */
  validate(text) {
    const detection = this.detect(text);
    const warnings = [];
    let severity = 'none';

    if (!detection.detected) {
      return {
        valid: true,
        warnings: [],
        severity: 'none',
      };
    }

    for (const finding of detection.findings) {
      let warningSeverity = 'low';
      let message = '';

      switch (finding.label) {
        case 'credentials':
          warningSeverity = 'critical';
          message = `检测到 ${finding.count} 处凭证信息（密码、密钥等），这是最高风险级别。`;
          break;
        case 'pii':
          warningSeverity = 'high';
          message = `检测到 ${finding.count} 处个人身份信息（邮箱、身份证等），请注意隐私保护。`;
          break;
        case 'internal':
          warningSeverity = 'medium';
          message = `检测到 ${finding.count} 处内部标记，可能涉及机密信息。`;
          break;
        case 'apiKeys':
          warningSeverity = 'high';
          message = `检测到 ${finding.count} 处可能的API密钥。`;
          break;
        case 'ips':
          warningSeverity = 'low';
          message = `检测到 ${finding.count} 处IP地址。`;
          break;
      }

      warnings.push({
        category: finding.label,
        severity: warningSeverity,
        message,
        samples: finding.samples,
      });

      // 更新整体严重级别
      const severityLevels = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
      if (severityLevels[warningSeverity] > severityLevels[severity]) {
        severity = warningSeverity;
      }
    }

    return {
      valid: severity === 'none' || severity === 'low',
      warnings,
      severity,
    };
  }

  /**
   * 过滤需求描述，确保不包含敏感信息
   * @param {string} description - 需求描述
   * @returns {Object} - { safe: boolean, filtered: string, report: Object }
   */
  filterRequirement(description) {
    if (!description || typeof description !== 'string') {
      return {
        safe: true,
        filtered: description || '',
        report: {
          originalLength: 0,
          filteredLength: 0,
          changes: [],
        },
      };
    }

    const validation = this.validate(description);
    const sanitization = this.sanitize(description);

    return {
      safe: validation.valid,
      filtered: sanitization.sanitized,
      report: {
        originalLength: description.length,
        filteredLength: sanitization.sanitized.length,
        changes: sanitization.report.redactions,
        warnings: validation.warnings,
        severity: validation.severity,
      },
    };
  }

  /**
   * 获取敏感信息统计摘要
   * @param {string} text - 待分析文本
   * @returns {Object} - 统计摘要
   */
  getSummary(text) {
    const detection = this.detect(text);

    if (!detection.detected) {
      return {
        hasSensitiveInfo: false,
        totalDetections: 0,
        breakdown: {},
      };
    }

    const breakdown = {};
    let totalDetections = 0;

    for (const finding of detection.findings) {
      breakdown[finding.label] = finding.count;
      totalDetections += finding.count;
    }

    return {
      hasSensitiveInfo: true,
      totalDetections,
      breakdown,
      severity: this.validate(text).severity,
    };
  }
}

// 导出单例
const securityFilter = new SecurityFilter();

export default securityFilter;
