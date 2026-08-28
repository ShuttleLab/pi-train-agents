# train-agents — Pi 原生 "AGENTS.md 训练系统" 扩展

[English](./README.md) · **中文**

> 把项目级的 `AGENTS.md` 当成一个有大小限制的模型，用你在这个项目里真实跑过的 Pi 会话记录作为训练数据，定期做"反向传播"式修订：找证据、批量验证、小步修改、留预算、人来把关。


---

## 特色

- **原生 Pi 扩展**：一个 `.ts` 文件，复制到 `~/.pi/agent/extensions/` 即可使用
- **两档模型**：逐会话取证用低推理成本（tier1），综合提案用强推理（tier2）
- **预算护栏**：UTF-8 bytes/4 估算，5000 tok 默认上限，超预算零和游戏
- **批量验证**：同一问题在 ≥2 个独立会话出现才够格（`minGapEvidence=2`）
- **机械闸门**：max-edits 自适应、evidence 逐字溯源（F2）、add 需真实来源（F3）、find/anchor 唯一性校验
- **人工审核是唯一写入路径**：`/train-agents review` 逐条确认，绝不自动写入
- **安全**：写前版本新鲜度校验 + 时间戳备份（保留 5 份）+ 脱敏（密钥自动打码）
- **中英双语**：界面语言自动检测环境变量 `LANG`，也可在 `config.json` 中设为 `"zh"` 或 `"en"`

## ⚠️ 隐私声明

本工具会把**项目里 Pi 会话的内容**（你的 prompt、助手回复、bash 命令）发送给你配置的模型 provider（默认是你当前会话的模型）用于取证分析。已内置脱敏（AWS key / `sk-` / `Bearer` / 私钥等自动打码），但**脱敏不替代告知**：请确保你的 provider 允许处理这些数据，或通过 `analysis.model` / `synthesis.model` 指向你信任的端点。

---

## 安装

```bash
# 前提：pi 已安装（@earendil-works/pi-coding-agent）
# 推荐：从 npm 安装
pi install npm:pi-train-agents

# 备选：
pi install git:github.com/ShuttleLab/pi-train-agents   # 从 GitHub
pi install https://github.com/ShuttleLab/pi-train-agents
```

> `pi install` 会把包写入你的 settings 并自动加载 `dist/train-agents.ts`（由 `package.json` 的 `pi` 清单声明）。
>
> **卸载：** `pi remove npm:pi-train-agents` · **更新：** `pi update` · 首次运行自动生成 `~/.pi/agent/train-agents/config.json`（默认配置）。

---

## 使用

### 命令

| 命令 | 作用 |
|---|---|
| `/train-agents` | **一键全流程**：静默取证 + 生成提案，只输出提案（不写文件） |
| `/train-agents analyze` | 仅取证：输出证据摘要（规则被遵守/违反/空白） |
| `/train-agents propose` | 仅合成提案：基于已有证据生成修改建议 |
| `/train-agents review` | **人工审核唯一写入入口**：逐条展示 diff，接受/拒绝，接受的才写入 AGENTS.md |
| `/train-agents status` | 查看状态 + 配置项含义 + 如何修改 |

### 典型工作流

```bash
1. 干完活后，在项目目录下跑：/train-agents
   → 自动取证 + 生成提案。若证据不足（单次会话）："无提案"。
   → 攒够 2+ 会话后：显示提案编辑列表。

2. 审核：/train-agents review
   → 逐条展示 diff + evidence 原文，接受/拒绝。
   → 接受的写入 AGENTS.md，拒绝的记住（不再重复提）。

3. 复查：/train-agents status
   → 预算条、已分析会话、证据记录、gap ledger 一览。
```

---

## 配置

编辑 `~/.pi/agent/train-agents/config.json`，示例如下：

```json
{
  "language": "en",
  "minGapEvidence": 3,
  "maxEditsPerRun": 5,
  "since": "14d",
  "budgetTokens": 8000,
  "jobs": 4,
  "analysis": { "effort": "medium", "model": "anthropic/claude-sonnet-4-5" },
  "synthesis": { "effort": "high", "model": "anthropic/claude-opus-4-5" }
}
```

| 配置 | 默认值 | 含义 |
|---|---|---|
| `language` | `"auto"` | 界面语言：`"zh"` / `"en"` / `"auto"`（自动从 `LANG` 环境变量探测） |
| `budgetTokens` | `5000` | 预算上限（tokens），bytes/4 估算 |
| `maxEditsPerRun` | `null`（自适应） | 单次最多提几条修改。null=自适应（预算内 5 条，超预算放大至 ≤20） |
| `minGapEvidence` | `2` | 新规则需要 ≥2 个独立会话的证据 |
| `since` | `"30d"` | 训练窗口，只分析最近 N 天会话 |
| `gapLedgerMaxAge` | `"90d"` | gap 跨 run 累计的有效期 |
| `maxTranscripts` | `100` | 单次分析最多会话数（超出按最新优先抽样） |
| `minUserTurns` | `2` | 用户轮次 <2 的琐碎会话跳过 |
| `jobs` | `4` | 并行取证线程数 |
| `analysis.model` | `null`（当前会话模型） | 取证用模型（null=默认） |
| `synthesis.model` | `null`（当前会话模型） | 提案用模型（null=默认） |
| `analysis.effort` | `"medium"` | 取证推理强度（none/minimal/low/medium/high/xhigh/max）。注：仅当模型支持 effort 分档（如带 `supportsReasoningEffort`）才生效，否则两档靠 `analysis.model`/`synthesis.model` 配不同模型区分 |
| `synthesis.effort` | `"high"` | 提案推理强度（同上） |
| `memoryFiles` | `["AGENTS.md"]` | 要维护的记忆文件 |
| `skillsDir` | `".agents/skills"` | skill 抽取落点 |

---

## 架构

```
tier1 逐会话取证（complete + reasoningOpts 按 api 分派）
  → 确定性蒸馏（脱敏 + head/tail 截断 + verbatim 校验）
  → 证据记录（含 verbatim 标记）

确定性聚合（topic 分组 + mistake 必填，无相似度闸门）
  → 候选桶（含各观察的规则/失误/quote/verbatim/source/sessionId）
  → minGapEvidence 预过滤（≥2 会话的桶才进 tier2）

tier2 合成提案（complete + reasoningOpts，强模型）
  → 桶内逐观察渲染，非逐字 quote 标 [未逐字·不可引用]
  → 桶内逐观察渲染，非逐字 quote 标 [未逐字·不可引用]
  → 仅当同一问题在 ≥2 会话反复出现才可新增规则（否则不新增）
  → evidence.source 必须用真实会话白名单

机械闸门（validateProposal）
  → F2 溯源：evidence.text 必须是逐字 quote 子串且 ≥12 字符；quoteSet 空则 fail closed
  → F3 批量：add 需要 ≥minGapEvidence 个真实来源（realSources.has 过滤）
  → 自适应 max-edits + 预算 fit + find 唯一 + kind/title 校验

人工审核（review）
  → 对话框展示 find/replace + evidence 原文+来源
  → 写盘前重读+重算 hash（TOCTOU 防护）
  → 时间戳备份到 DATA_DIR（保留最近 5 份）
  → 拒绝记忆（持久化，无新证据不重复提）
```

---

## 已知局限

- **topic 桶可能混入不同问题**：确定性聚类只按 topic 分组 + mistake 必填，不设相似度闸门。一个桶里可能混进不同问题（如都关于"部署前"，但一个是构建、一个是备份），靠 tier2 语义判断 + 人工审核区分。
- **add 完全押在 tier2 判断上**：确定性层不做语义过滤；两会话铁律由 F3 在编辑层强制（add 的 evidence 必须来自 ≥minGapEvidence 个真实会话来源）。add 可能产不出，必要时可手写——本工具主要产出 rewrite/remove。
- **只读 Pi 会话**：不读取 Claude Code / opencode / codex 等其他工具的会话记录。
- **ESC 中断**：jobs 并发跑大批会话时中途停止只能 Ctrl+C 整个 pi，暂不支持优雅中断（需自定义 modal UI，属打磨项）。

---

## 测试与贡献

```bash
cd pi-train-agents
node --experimental-strip-types --test tests/*.test.ts
```

22 个回归用例覆盖：相似度、聚类（含 S1 三条+S2 一条 topic 桶）、applyEdits（$& 展开、find 唯一性、anchor 插入）、validateProposal（F2 碎片旁路、F2 fail-closed、F3 真实来源、预算零和）、parseMemoryUnits（子章节继承）、verbatim 透传、prompt 双语。

**改 `src/` 后必须 `npm run build`**，否则 `dist/` 与源码不同步（构建末尾有语法自检）。

---

## 许可

MIT License。本项目受 [backpass](https://github.com/kunchenguid/backpass)（MIT）启发。