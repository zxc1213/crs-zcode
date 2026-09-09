# CRS 规则自定义指南

CRS 的提醒与守卫行为由**规则数据**驱动。内置默认规则 = 插件的标准工作流守卫；本项目想加自己的约定时，在 `.requirements/_system/rules.yaml` 里声明即可，**无需改插件代码**。

## 分工口径

| 文件 | 管什么 | 消费者 |
| --- | --- | --- |
| `_system/config.yaml` | 引擎参数（优先级权重、门禁阈值、骨架清单、docs-map 深度） | 引擎模块 |
| `_system/rules.yaml` | 行为约束（守卫条件+文案、注入提醒） | hooks + LLM |

## 规则类型

### guard — PostToolUse 守卫（Edit/Write/Bash 触发时按条件命中并注入提示）

```yaml
rules:
  - id: no-force-push          # 项目内唯一
    type: guard
    when:
      tools: [Bash]             # Edit|Write|Bash 子集
      command_contains: "git push --force"   # 仅 Bash；大小写与空白归一后子串匹配
      # statuses: [planning]   # 仅在活跃需求处于这些状态时生效；省略=不限
      # outside: .requirements  # 目标文件在该目录外才生效；省略=不限
    message: "禁止 force push，先确认"
    priority: 90                # 多条命中按此降序拼接；默认 0
    enabled: true               # 默认 true
```

### inject — SessionStart 注入的简短提醒（每轮会话一次）

```yaml
rules:
  - id: zh-commit
    type: inject
    priority: 10
    message: "提交信息使用中文"   # ≤120 字符，纯静态文本
```

注入总量受预算约束：`inject_budget_chars`（默认 600，上限 2000）。主消息（活跃需求提示）优先保留，inject 规则按 priority 降序追加，放不下的整条丢弃。

## 覆盖内置规则

同 `id` 即覆盖（字段级合并，只写要改的字段）：

```yaml
rules:
  - id: phase-guard       # 内置的 5 阶段守卫
    type: guard
    message: "文档 5 阶段没走完，先别动代码"   # 只改文案，条件继承内置
    # enabled: false      # 也可以整体关闭
```

## 占位符

guard 的 `message` 支持 `{id}`（活跃需求 ID）、`{status}`（状态）、`{path}`（目标文件绝对路径）；Stop 总结模板支持 `{id}`/`{n}`。无对应值时占位符原样保留。

## 校验与查看

```bash
node "$ZCODE_PLUGIN_ROOT/scripts/requirement-manager/index.js" rules             # 合并后的规则清单（标注来源）
node "$ZCODE_PLUGIN_ROOT/scripts/requirement-manager/index.js" rules --validate  # 校验 rules.yaml
```

非法规则（缺 id/message、类型错、message 超长：inject 120 / guard 200 字符）会被**剔除并告警**，其余规则继续生效；YAML 损坏时整体回退内置默认。

## 体积意识

每条规则都会进入 LLM 上下文——规则也是 token。写完跑一次注入面统计确认没有超预算：

```bash
node "$ZCODE_PLUGIN_ROOT/bin/crs-context-stats.js"
```

经验类知识（何时提醒、怎么做的教训）建议放 `_system/lessons/`（检索式，按需加载），只有"每次会话/每次操作都必须看到"的约定才值得写成 inject/guard 规则。
