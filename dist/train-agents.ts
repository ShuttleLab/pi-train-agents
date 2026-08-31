/**
 * train-agents — Pi extension for gradient-descent maintenance of AGENTS.md.
 * AUTO-GENERATED: do not edit directly. Source at src/.
 */
/**
 * train-agents core — pure logic + i18n.
 * No pi imports here: unit-testable with plain Node.
 */

import { createHash } from "node:crypto";

// ── i18n ─────────────────────────────────────────────────────────────────────
type Lang = "zh" | "en";
type MsgKey =
  | "notFoundMemory" | "listFail" | "foundN" | "sessionFail" | "analysisDone"
  | "modelNotFound" | "noAuth" | "badEffort" | "proposeStart" | "noEvidence"
  | "synthParseFail" | "gateRetry" | "gateFailTwice" | "proposalDone" | "reviewHint"
  | "reviewNeedTui" | "noProposal" | "skipRejected" | "externalModified" | "applyFailRestored"
  | "wroteEdits" | "noneAccepted" | "statusOut" | "cmdError" | "noSessionsThisRound" | "usage"
  | "footerSince" | "footerInst" | "footerReady" | "footerElapsed" | "footerFollowed"
  | "footerViolated" | "footerBuckets" | "footerDone" | "stepCollect" | "stepLoss"
  | "evTitle" | "evFile" | "evCounts" | "evRules" | "evNoRules" | "evBuckets" | "evNoBuckets"
  | "evBucketLine" | "evFollowViol" | "evNotVerbatim"
  | "propTitle" | "propBudget" | "propNoEdits" | "propNoEditsTier2" | "propEvidence" | "reviewNowPrompt" | "reviewNowBody" | "proposalSaved" | "nextStepLookPrompt" | "nextStepLookBody" | "nextStepWait" | "proposeWorking"
  | "stTitle" | "stMemory" | "stAnalyzed" | "stProposal" | "stDataFiles" | "stConfigTitle"
  | "stHConfig" | "stHValue" | "stHMeaning" | "stHAnalog" | "stRowMinGap" | "stRowMaxEdits"
  | "stRowSince" | "stRowAnalysis" | "stRowSynthesis" | "stRowJobs" | "stAboutModel" | "stHowToEdit"
  | "stSave" | "stNoteAdd" | "stNoteSafe" | "stModelNote"
  | "vTooManyEdits" | "vKind" | "vTitle" | "vNoQuote" | "vNoBenchmark" | "vNotTraceable"
  | "vFindNotFound" | "vFindNotUnique" | "vAnchorNotFound" | "vAnchorNotUnique" | "vAddSources" | "vShrink";

const ZH: Record<MsgKey, string> = {
  notFoundMemory: "未找到记忆文件（AGENTS.md）",
  listFail: "列举会话失败: {0}",
  foundN: "找到 {0} 个待分析会话（复用 {1}）",
  sessionFail: "会话分析失败: {0}",
  analysisDone: "分析完成：{0} 已分析 · {1} 跳过 · {2} 失败 · 复用 {3}",
  modelNotFound: "未找到{0}模型",
  noAuth: "模型 {0} 未配置鉴权",
  badEffort: "配置的 {0}.effort=\"{1}\" 非法（合法值 {2}），本次忽略该参数",
  proposeStart: "聚合证据 + 生成提案中…",
  noEvidence: "尚无证据，请先运行 analyze",
  synthParseFail: "合成提案解析失败",
  gateRetry: "提案未过闸门，re-prompt 中",
  gateFailTwice: "提案两次均未通过闸门：{0}",
  proposalDone: "提案已生成：{0} 条编辑（未写入文件）",
  reviewHint: "用 /train-agents review 审核",
  reviewNeedTui: "review 需要交互式终端（TUI），print/json 模式无法进行人工审核",
  noProposal: "尚无提案，请先运行 propose",
  skipRejected: "跳过已拒绝的编辑 {0}",
  externalModified: "AGENTS.md 在审核期间被外部修改，已中止写入（请重新 propose）",
  applyFailRestored: "应用失败：{0}（已从备份恢复）",
  wroteEdits: "已写入 {0} 条修改到 {1}（备份在 {2}）",
  noneAccepted: "未接受任何修改",
  statusOut: "状态已输出（见对话消息）",
  cmdError: "train-agents 错误: {0}",
  noSessionsThisRound: "本轮没有可分析的会话，未生成提案",
  usage: "用法: /train-agents [analyze|propose|review|status]（无参 = 一键全流程）",
  footerSince: "近",
  footerInst: "条指令 · 预算 {0}",
  footerReady: "待开始",
  footerElapsed: "已过 {0}s",
  footerFollowed: "条被遵守",
  footerViolated: "条被违反",
  footerBuckets: "个候选桶",
  footerDone: "已完成 · 耗时 {0}s",
  stepCollect: "收集样本",
  stepLoss: "计算损失",
  evTitle: "# AGENTS.md 取证摘要（train-agents）",
  evFile: "文件：{0} · {1} / {2} tok · {3} 会话纳入",
  evCounts: "证据：✓ {0} 条被遵守 · ✗ {1} 条被违反 · ◆ {2} 个候选桶 · {3} 条未触及",
  evRules: "## 有证据的规则",
  evNoRules: "（无——证据未达门槛，详见候选桶）",
  evBuckets: "## topic 候选桶（≥ {0} 会话报过；是否同一问题由合成层判断）",
  evNoBuckets: "（暂无跨会话候选）",
  evBucketLine: "- topic={0} · {1} 会话报过 · {2} 条观察 / 风险 {3}",
  evFollowViol: "遵守{0}/违反{1} · {2} 会话",
  evNotVerbatim: " ⚠未逐字",
  propTitle: "# 修改提案（未写入文件）",
  propBudget: "预算：{0} → {1} / {2} tok",
  propNoEdits: "（证据未达到阈值，本轮无提案）",
  propNoEditsTier2: "（证据通过了闸门，但 tier2 判断候选观察不是同一问题，未提出修改）",
  propEvidence: "证据({0}): {1}",
  reviewNowPrompt: "提案已生成，是否立即 review？",
  reviewNowBody: "将逐条展示编辑，你接受或拒绝；拒绝的会被记住，除非有新证据不再重复提。",
  proposalSaved: "提案已保存到数据目录，用 /train-agents review 随时审核",
  nextStepLookPrompt: "未生成提案，是否查看取证明细（analyze）？",
  nextStepLookBody: "看各规则被遵守/违反、以及候选桶的明细，判断是语料不足还是确实没有可收敛的问题。",
  nextStepWait: "继续正常干活攒语料即可；同一问题在 ≥2 个会话复现后，add 才会自然出现。",
  proposeWorking: "正在生成提案…（调用 tier2 强模型，通常需数十秒，请稍候）",
  stTitle: "# train-agents 状态",
  stMemory: "记忆文件: {0} · {1} / {2} tok · 预算 {3}%",
  stAnalyzed: "已分析会话: {0} · 证据记录: {1} · gap ledger: {2}",
  stProposal: "待审核提案: {0}",
  stDataFiles: "数据文件: ~/.pi/agent/train-agents/<cwd哈希>.{state,proposal,rejections}.json（项目内无残留；AGENTS.md 变更后旧证据自动失效）",
  stConfigTitle: "## 配置项含义（当前值，对齐 backpass）",
  stHConfig: "配置", stHValue: "当前值", stHMeaning: "含义", stHAnalog: "神经网络类比",
  stRowMinGap: "批量阈值：新规则/修改须 ≥{0} 个独立会话指向同一问题。单次会话偏差是噪音",
  stRowMaxEdits: "一次最多提几条修改（学习率）。自适应=预算内 5 条；超预算按超出量放大（每超 40 tok 多 1 条，上限 20）",
  stRowSince: "训练窗口：只分析最近 {0} 的会话。叠加增量缓存——已分析且 AGENTS.md 未变的会话不重复算",
  stRowAnalysis: "取证档推理强度：逐会话比对证据，量大但单次不需太强推理 → 中低强度（便宜、快），可 fan-out 并行",
  stRowSynthesis: "提案档推理强度：综合全部证据生成最终提案，需强推理 + 严格格式遵循 → 高强度（更准）",
  stRowJobs: "并行取证的任务数（同时调用模型分析多个会话）",
  stAboutModel: "**关于模型**：analysis.model / synthesis.model = {0}。不写死具体 id，换 provider 不用改代码；想指定就填 \"provider/model-id\"。",
  stHowToEdit: "**如何修改**：编辑 ~/.pi/agent/train-agents/config.json（首次运行已按默认生成）。例如：",
  stSave: "改完存盘即生效（status 可验证）。",
  stNoteAdd: "说明：新增规则(kind=add)依赖跨会话【近重复/强相似】gap 且经 tier2 语义判断 + 真实 source 溯源闸门；完全换词的中文 paraphrase 无法靠字符串相似度聚类，add 可能产不出，必要时可手写。本工具主要产出 rewrite/remove。",
  stNoteSafe: "安全：AGENTS.md 只在 /train-agents review 逐条确认后写入；写入前有版本新鲜度校验 + 时间戳备份（DATA_DIR 保留最近 5 份）；gap/evidence 均需逐字溯源。",
  stModelNote: "> 注：当前默认模型（{0}）的 api 为 {1}，若该模型不支持 effort 分档，两档实际靠 analysis.model / synthesis.model 配置不同模型来区分。",
  vTooManyEdits: "编辑数 {0} 超过上限 {1}",
  vKind: "编辑 {0}: kind 必须是 add/remove/rewrite/extract",
  vTitle: "编辑 {0}: 缺少 title",
  vNoQuote: "编辑 {0} 缺少逐字 evidence quote",
  vNoBenchmark: "编辑 {0}: 本轮无逐字 quote 基准，无法校验 evidence 溯源（拒绝提案）",
  vNotTraceable: "编辑 {0}: evidence 无法溯源到已收集的会话 quote（疑似编造）",
  vFindNotFound: "编辑 {0} 的 find 未在文件中出现",
  vFindNotUnique: "编辑 {0} 的 find 在文件中出现 {1} 次（必须唯一）",
  vAnchorNotFound: "编辑 {0} 的 anchor 未在文件中出现",
  vAnchorNotUnique: "编辑 {0} 的 anchor 在文件中出现 {1} 次（必须唯一）",
  vAddSources: "编辑 {0}: add 新规则需要 ≥{1} 个不同真实会话来源，当前仅 {2} 个",
  vShrink: "超预算收缩计划要求净负增量，但预测 +{0} tokens",
};

const EN: Record<MsgKey, string> = {
  notFoundMemory: "No memory file found (AGENTS.md)",
  listFail: "Failed to list sessions: {0}",
  foundN: "Found {0} sessions to analyze ({1} reused)",
  sessionFail: "Session analysis failed: {0}",
  analysisDone: "Analysis done: {0} analyzed · {1} skipped · {2} failed · {3} reused",
  modelNotFound: "{0} model not found",
  noAuth: "Model {0} has no auth configured",
  badEffort: "Invalid {0}.effort=\"{1}\" (valid: {2}); ignoring this run",
  proposeStart: "Aggregating evidence + generating proposal…",
  noEvidence: "No evidence yet — run analyze first",
  synthParseFail: "Failed to parse synthesis proposal",
  gateRetry: "Proposal failed gates; re-prompting",
  gateFailTwice: "Proposal failed gates twice: {0}",
  proposalDone: "Proposal generated: {0} edits (not written)",
  reviewHint: "Review with /train-agents review",
  reviewNeedTui: "review requires an interactive terminal (TUI); print/json modes cannot do human review",
  noProposal: "No proposal yet — run propose first",
  skipRejected: "Skipping rejected edit {0}",
  externalModified: "AGENTS.md was modified externally during review; aborted write (please propose again)",
  applyFailRestored: "Apply failed: {0} (restored from backup)",
  wroteEdits: "Wrote {0} edits to {1} (backup at {2})",
  noneAccepted: "No edits accepted",
  statusOut: "Status output (see message)",
  cmdError: "train-agents error: {0}",
  noSessionsThisRound: "No sessions to analyze this round; no proposal generated",
  usage: "Usage: /train-agents [analyze|propose|review|status] (no arg = full pass)",
  footerSince: "since",
  footerInst: "instructions · budget {0}",
  footerReady: "ready",
  footerElapsed: "elapsed {0}s",
  footerFollowed: "followed",
  footerViolated: "violated",
  footerBuckets: "candidate buckets",
  footerDone: "done · elapsed {0}s",
  stepCollect: "collect samples",
  stepLoss: "calculate loss",
  evTitle: "# AGENTS.md Evidence Summary (train-agents)",
  evFile: "File: {0} · {1} / {2} tok · {3} sessions included",
  evCounts: "Evidence: ✓ {0} followed · ✗ {1} violated · ◆ {2} candidate buckets · {3} untouched",
  evRules: "## Rules with evidence",
  evNoRules: "(none — below threshold, see candidate buckets)",
  evBuckets: "## topic candidate buckets (≥{0} sessions; same-problem judgment by synthesis)",
  evNoBuckets: "(no cross-session candidates)",
  evBucketLine: "- topic={0} · {1} sessions · {2} observations / risk {3}",
  evFollowViol: "followed {0}/violated {1} · {2} sessions",
  evNotVerbatim: " ⚠not-verbatim",
  propTitle: "# Proposal (not written)",
  propBudget: "Budget: {0} → {1} / {2} tok",
  propNoEdits: "(evidence below threshold, no proposal this round)",
  propNoEditsTier2: "(evidence passed the gate, but tier2 judged the candidate observations are not the same problem; no edits proposed)",
  propEvidence: "evidence({0}): {1}",
  reviewNowPrompt: "Proposal generated. Review now?",
  reviewNowBody: "You'll review each edit (accept/reject); rejected ones are remembered and not re-proposed without new evidence.",
  proposalSaved: "Proposal saved to the data directory. Run /train-agents review anytime.",
  nextStepLookPrompt: "No proposal generated. View the evidence summary (analyze)?",
  nextStepLookBody: "See which rules were followed/violated and the candidate buckets, to tell whether it is thin corpus or genuinely nothing to converge on.",
  nextStepWait: "Keep working to accumulate sessions; the same problem recurring in ≥2 sessions is required for an add to appear.",
  proposeWorking: "Generating proposal… (tier2 model, usually tens of seconds; please wait)",
  stTitle: "# train-agents status",
  stMemory: "Memory file: {0} · {1} / {2} tok · budget {3}%",
  stAnalyzed: "Analyzed sessions: {0} · evidence records: {1} · gap ledger: {2}",
  stProposal: "Proposal pending review: {0}",
  stDataFiles: "Data files: ~/.pi/agent/train-agents/<cwd-hash>.{state,proposal,rejections}.json (nothing in the project; stale evidence auto-invalidated when AGENTS.md changes)",
  stConfigTitle: "## Configuration (current values, aligned with backpass)",
  stHConfig: "Key", stHValue: "Current", stHMeaning: "Meaning", stHAnalog: "Neural-net analogy",
  stRowMinGap: "Batch threshold: a new rule/edit needs ≥{0} independent sessions pointing at the same problem. A single session is noise.",
  stRowMaxEdits: "Max edits per run (learning rate). Adaptive = 5 when within budget; scales with overage (1 per 40 tok over, cap 20) for shrink plans.",
  stRowSince: "Training window: only sessions from the last {0}. Incremental cache — already-analyzed sessions with unchanged AGENTS.md are not recomputed.",
  stRowAnalysis: "Evidence-tier reasoning: per-session evidence comparison, high volume but low per-call complexity → cheap/fast, fan-out parallel.",
  stRowSynthesis: "Proposal-tier reasoning: aggregate all evidence into the final proposal, needs strong reasoning + strict format → stronger/slower.",
  stRowJobs: "Parallel evidence-analysis workers.",
  stAboutModel: "**Models**: analysis.model / synthesis.model = {0}. Not hard-coded; leave null to use your current session model, or set \"provider/model-id\".",
  stHowToEdit: "**How to change**: edit ~/.pi/agent/train-agents/config.json (auto-created on first run). Example:",
  stSave: "Saved changes take effect on the next run (verify via status).",
  stNoteAdd: "Note: new-rule (kind=add) proposals depend on cross-session near-duplicate/similar gaps, judged semantically by tier2 + real-source traceability gates. Fully rephrased Chinese paraphrases cannot be clustered by string similarity — adds may not be produced; write them by hand when needed. This tool primarily produces rewrite/remove.",
  stNoteSafe: "Safety: AGENTS.md is only written after per-edit confirmation in /train-agents review; a version-freshness check + timestamped backup (last 5 kept in DATA_DIR) run before writing; gaps/evidence must be verbatim-traceable.",
  stModelNote: "> Note: the current default model ({0}) uses api {1}; if it does not support effort tiers, differentiate the two tiers by configuring analysis.model / synthesis.model.",
  vTooManyEdits: "edit count {0} exceeds cap {1}",
  vKind: "edit {0}: kind must be add/remove/rewrite/extract",
  vTitle: "edit {0}: missing title",
  vNoQuote: "edit {0} missing verbatim evidence quote",
  vNoBenchmark: "edit {0}: no verbatim quote benchmark this round; cannot verify evidence traceability (proposal rejected)",
  vNotTraceable: "edit {0}: evidence cannot be traced to a collected session quote (possibly fabricated)",
  vFindNotFound: "edit {0}: find text not present in file",
  vFindNotUnique: "edit {0}: find text appears {1} times in file (must be unique)",
  vAnchorNotFound: "edit {0}: anchor text not present in file",
  vAnchorNotUnique: "edit {0}: anchor text appears {1} times in file (must be unique)",
  vAddSources: "edit {0}: add (new rule) needs ≥{1} distinct real session sources, got {2}",
  vShrink: "over-budget shrink plan must have net negative delta, but projected +{0} tokens",
};

const MSGS: Record<Lang, Record<MsgKey, string>> = { zh: ZH, en: EN };

let _lang: Lang = "zh";

function setLang(lang: Lang) { _lang = lang; }
function getLang(): Lang { return _lang; }

function detectLang(env: Record<string, string | undefined> = process.env): Lang {
  const e = String(env.LC_ALL || env.LC_MESSAGES || env.LANG || "").toLowerCase();
  return e.startsWith("zh") ? "zh" : "en";
}

/** cfg.language: "zh" | "en" | "auto" (default auto → env detect) */
function resolveLang(cfg: any): Lang {
  const v = String(cfg?.language ?? "auto").toLowerCase();
  if (v === "zh" || v === "en") return v as Lang;
  return detectLang();
}

function t(key: MsgKey, ...args: (string | number)[]): string {
  let s: string = MSGS[_lang]?.[key] ?? MSGS.en[key] ?? key;
  args.forEach((a, i) => { s = s.replaceAll(`{${i}}`, String(a)); });
  return s;
}

// ── 默认配置 ─────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  memoryFiles: ["AGENTS.md"],
  budgetTokens: 5000,
  skillsDir: ".agents/skills",
  maxEditsPerRun: null as number | null, // null = adaptive
  minGapEvidence: 2,
  since: "30d",
  gapLedgerMaxAge: "90d",
  maxTranscripts: 100,
  minUserTurns: 2,
  jobs: 4,
  language: "auto" as "zh" | "en" | "auto",
  analysis: { model: null as string | null, effort: "medium" },
  synthesis: { model: null as string | null, effort: "high" },
};

const DEFAULT_MAX_EDITS = 5;
const SHRINK_MAX_EDITS = 20;
const SHRINK_EDIT_TOKENS = 40;
const GAP_SIMILARITY_THRESHOLD = 0.5; // only for gapLedger dedup
const MAX_TRANSCRIPT_TEXT = 4000;
const MAX_SESSION_CHARS = 120_000;
const UNIT_TEXT_IN_PROMPT = 160;
const VALID_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

// ── 工具函数 ──────────────────────────────────────────────────────────────────
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(Buffer.byteLength(text, "utf8") / 4);
}

function parseSince(since: any): number | null {
  if (since == null || since === "all" || since === "0") return null;
  const m = String(since).trim().match(/^(\d+)\s*([dhwm])$/i);
  if (!m) return null;
  const n = Number(m[1]), unit = m[2].toLowerCase();
  const ms: any = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  return n * ms[unit];
}

// R3：对 section 文本（已剥 #）做包含匹配；仅列明确的背景/结构标题（不含裸词"目录/部署/结构/配置"，避免误伤指令章节）
const REF_RE = /目录构成|文件结构|技术栈|路由表|部署架构|项目构成|架构细节|数据结构|reference|stack|structure|directory|routing|dependencies|architecture|项目概览|i18n 两种体系|环境变量|框架怪癖|License|许可|技术选型|项目结构|项目组成/i;

function fingerprint(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

function extractJson(text: string): any | null {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try { return JSON.parse(t.slice(start, end + 1)); } catch { return null; }
}

function textOf(content: any): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n");
}

function shapeOfArgs(args: any): string {
  if (!args || typeof args !== "object") return JSON.stringify(args ?? {});
  try { const s = JSON.stringify(args); return s.length > 240 ? s.slice(0, 240) + "…" : s; } catch { return "[args]"; }
}

// 保守脱敏：打码常见密钥格式，保留证据保真度
function redact(text: string): string {
  let t = text;
  t = t.replace(/\bAKIA[0-9A-Z]{16}\b/g, "AKIA[REDACTED]");
  t = t.replace(/\bsk-[A-Za-z0-9]{16,}\b/g, "sk-[REDACTED]");
  t = t.replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "gh_[REDACTED]");
  t = t.replace(/\bBearer\s+[A-Za-z0-9._~+/-]{20,}/g, "Bearer [REDACTED]");
  t = t.replace(/([A-Za-z_]*TOKEN|API[_A-Z]*KEY|PASSWORD|SECRET|CLIENT_SECRET|PRIVATE_KEY)\s*[=:]\s*\S+/gi, "$1=[REDACTED]");
  t = t.replace(/https?:\/\/[^/@:]+:[^/@]+@/g, (m) => m.replace(/:[^@]+@/, ":[REDACTED]@"));
  t = t.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "-----BEGIN [REDACTED] PRIVATE KEY-----");
  return t;
}

/** 归一化空白后检查 quote 是否逐字出现在 corpus 中 */
function isVerbatim(quote: string, corpus: string): boolean {
  const nq = (quote || "").replace(/\s+/g, " ").trim();
  if (!nq || nq.length < 5) return false;
  const nc = corpus.replace(/\s+/g, " ").trim();
  return nc.includes(nq);
}

// ── 记忆文件解析 ──────────────────────────────────────────────────────────────
function parseMemoryUnits(text: string): { units: any[]; tokens: number } {
  const lines = text.split("\n");
  const units: any[] = [];
  let section = "", buf: string[] = [], idx = 0, inFence = false;
  // R3：标题层级栈——reference 章节的子章节继承 reference 状态
  let stack: { level: number; ref: boolean }[] = [];
  let curRef = false;
  const flush = () => {
    if (buf.length === 0) return;
    const body = buf.join("\n").trim();
    if (!body) return;
    units.push({ id: `u${++idx}`, kind: curRef ? "reference" : "instruction", section, text: body, tokens: estimateTokens(body) });
    buf = [];
  };
  for (const line of lines) {
    if (line.trim().startsWith("```")) { inFence = !inFence; buf.push(line); continue; }
    if (inFence) { buf.push(line); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      const level = h[1].length;
      section = h[2].trim();
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const ownRef = REF_RE.test(section);
      const inherited = stack.length > 0 && stack[stack.length - 1].ref;
      curRef = ownRef || inherited;
      stack.push({ level, ref: curRef });
      units.push({ id: `u${++idx}`, kind: curRef ? "reference" : "instruction", section, text: section, tokens: estimateTokens(section) });
    } else if (line.trim() === "") { flush(); }
    else { buf.push(line); }
  }
  flush();
  return { units, tokens: estimateTokens(text) };
}

// ── 相似度 / 聚类 ─────────────────────────────────────────────────────────────
function bigrams(text: string): Set<string> {
  const norm = text.toLowerCase().replace(/[`*_~]/g, "").replace(/\s+/g, " ").trim();
  const tokens = norm.match(/[\u4e00-\u9fff]|[a-z0-9]+/g) || [];
  if (tokens.length < 2) return new Set(tokens);
  const out = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) out.add(`${tokens[i]} ${tokens[i + 1]}`);
  return out;
}

/** Sørensen-Dice over word bigrams（对齐 backpass memory.js similarity），中英通吃 */
function similarity(a: string, b: string): number {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return A.size === B.size ? 1 : 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  let dice = (2 * shared) / (A.size + B.size);
  const na = a.toLowerCase().replace(/\s+/g, " ").trim();
  const nb = b.toLowerCase().replace(/\s+/g, " ").trim();
  if ((na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 8) dice = Math.max(dice, 0.85);
  return dice;
}

/** 粗候选收集：topic 硬主键 + mistake 必填。是否同一问题由 tier2 语义判断 + F3 真实来源 + 人工审核把关 */
function clusterGaps(observations: any[]): any[] {
  const clusters: any[] = [];
  for (const obs of observations) {
    if (!obs || !obs.proposedInstruction) continue;
    const hit = clusters.find((c) => {
      if (!obs.topic || !c.topic || obs.topic !== c.topic) return false;
      const m1 = String(c.mistake || "").trim(), m2 = String(obs.mistake || "").trim();
      if (!m1 || !m2) return false;
      return true;
    });
    const normPi = (obs.proposedInstruction || "").replace(/\s+/g, " ").trim();
    const item = { topic: obs.topic, proposedInstruction: obs.proposedInstruction, mistake: obs.mistake, quote: obs.quote, verbatim: !!obs.verbatim, recurrenceRisk: obs.recurrenceRisk, source: obs.source, sessionId: obs.sessionId };
    if (hit) {
      const dup = hit.items.some((it: any) => it.sessionId === obs.sessionId && (it.proposedInstruction || "").replace(/\s+/g, " ").trim() === normPi);
      if (!dup) hit.items.push(item);
      hit.sessions.add(obs.sessionId);
      if (obs.proposedInstruction.length > hit.proposedInstruction.length) hit.proposedInstruction = obs.proposedInstruction;
    } else {
      clusters.push({ proposedInstruction: obs.proposedInstruction, mistake: obs.mistake, topic: obs.topic, sessions: new Set([obs.sessionId]), items: [item] });
    }
  }
  return clusters;
}

function riskMax(a: string, b: string): string {
  const rank: any = { low: 0, medium: 1, high: 2 };
  return (rank[b] ?? 0) > (rank[a] ?? 0) ? b : a;
}

function foldEvidence(records: any[], opts: { minGapEvidence: number; memoryUnits: any[]; gapObservations: any[] }) {
  const usable = records.filter((r) => r && r.ok);
  const analyzedSessions = usable.length;
  const instrMap = new Map<string, any>();
  const touch = (id: string) => {
    if (!instrMap.has(id)) instrMap.set(id, { instruction: id, positive: 0, negative: 0, sessions: new Set(), quotes: [] });
    return instrMap.get(id);
  };
  let positive = 0, negative = 0;
  for (const r of usable) {
    const src = r.source;
    for (const it of r.positive || []) {
      if (!((it.quote || "").trim())) continue;
      const e = touch(it.instruction); e.positive++; e.sessions.add(src); if ((it.quote || "").trim()) e.quotes.push({ polarity: "positive", text: it.quote || "", source: src, verbatim: !!it.verbatim }); positive++;
    }
    for (const it of r.negative || []) {
      if (!((it.quote || "").trim())) continue;
      const e = touch(it.instruction); e.negative++; e.sessions.add(src); if ((it.quote || "").trim()) e.quotes.push({ polarity: "negative", text: it.quote || "", source: src, verbatim: !!it.verbatim }); negative++;
    }
  }
  for (const u of opts.memoryUnits) touch(u.id);

  const instructionRows = [...instrMap.values()].map((e) => {
    const u = opts.memoryUnits.find((x) => x.id === e.instruction);
    return {
      instruction: e.instruction, kind: u?.kind ?? null, positive: e.positive, negative: e.negative,
      sessions: e.sessions.size,
      relevance: analyzedSessions ? e.sessions.size / analyzedSessions : 0,
      text: u?.text ?? "",
      tokens: u?.tokens ?? null, section: u?.section ?? null, known: Boolean(u),
      quotes: e.quotes.slice(0, 6),
    };
  }).sort((a, b) => b.negative - a.negative || b.sessions - a.sessions || a.instruction.localeCompare(b.instruction));

  const gapClusters = clusterGaps(opts.gapObservations)
    .map((c) => ({
      topic: c.topic || "other",
      proposedInstruction: c.proposedInstruction,
      sessions: c.sessions.size,
      recurrenceRisk: c.items.reduce((mx: string, i: any) => riskMax(mx, i.recurrenceRisk), "low"),
      items: c.items,
      quotes: c.items.slice(0, 8).map((i: any) => ({ text: i.quote || "", source: i.source, verbatim: !!i.verbatim })),
    }))
    .filter((c) => c.sessions >= opts.minGapEvidence)
    .sort((a, b) => b.sessions - a.sessions);

  return { analyzedSessions, totals: { positive, negative, gapClusters: gapClusters.length }, instructions: instructionRows, gaps: gapClusters };
}

// ── Tier2 提案 / 闸门 ─────────────────────────────────────────────────────────
function effectiveMaxEdits(memoryTokens: number, cfg: any): number {
  if (Number.isInteger(cfg.maxEditsPerRun) && cfg.maxEditsPerRun > 0) return cfg.maxEditsPerRun;
  const overage = memoryTokens - cfg.budgetTokens;
  if (overage <= 0) return DEFAULT_MAX_EDITS;
  return Math.min(SHRINK_MAX_EDITS, Math.max(DEFAULT_MAX_EDITS, Math.ceil(overage / SHRINK_EDIT_TOKENS)));
}

function occurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let c = 0, i = hay.indexOf(needle);
  while (i !== -1) { c++; i = hay.indexOf(needle, i + 1); }
  return c;
}

/** 应用 edits（函数替换防 $& 展开；anchor 插入；find/anchor 唯一校验） */
function applyEdits(text: string, edits: any[]): { text: string; errors: string[] } {
  let cur = text;
  const errors: string[] = [];
  for (const e of edits) {
    if (e.find) {
      const n = occurrences(cur, e.find);
      if (n === 0) { errors.push(`edit ${e.id}: find not found`); continue; }
      if (n > 1) { errors.push(`edit ${e.id}: find appears ${n} times`); continue; }
      cur = cur.replace(e.find, () => e.replace ?? "");
    } else if (e.anchor) {
      const n = occurrences(cur, e.anchor);
      if (n === 0) { errors.push(`edit ${e.id}: anchor not found`); continue; }
      if (n > 1) { errors.push(`edit ${e.id}: anchor appears ${n} times`); continue; }
      const at = cur.indexOf(e.anchor) + e.anchor.length;
      cur = cur.slice(0, at) + "\n" + (e.replace ?? "") + cur.slice(at);
    } else {
      const sep = cur.endsWith("\n") ? "\n" : "\n\n";
      cur = `${cur}${sep}${e.replace ?? ""}\n`;
    }
  }
  return { text: cur, errors };
}

function budgetStatus(currentText: string, projectedText: string, cap: number) {
  const current = estimateTokens(currentText);
  const projected = estimateTokens(projectedText);
  return { cap, current, projected, delta: projected - current, withinBudget: projected <= cap, over: Math.max(0, projected - cap) };
}

/** 机械闸门：max-edits / kind/title / evidence 溯源(F2) / add 真实来源(F3) / find/anchor 唯一 / 预算 fit */
function validateProposal(edits: any[], memText: string, memTokens: number, cfg: any, allQuotes: string[] = [], realSources: Set<string> = new Set()): { ok: boolean; violations: string[] } {
  const v: string[] = [];
  const cap = effectiveMaxEdits(memTokens, cfg);
  if (edits.length > cap) v.push(t("vTooManyEdits", edits.length, cap));
  const kinds = ["add", "remove", "rewrite", "extract"];
  const normQ = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const quoteSet = new Set(allQuotes.map(normQ).filter(Boolean));
  const traceable = (text: string) => {
    const nt = normQ(text);
    if (nt.length < 12) return false;
    for (const q of quoteSet) if (q.includes(nt)) return true;
    return false;
  };
  for (const e of edits) {
    const id = e.id || e.title || "?";
    if (!kinds.includes(String(e.kind || "").toLowerCase())) v.push(t("vKind", id));
    if (!String(e.title || "").trim()) v.push(t("vTitle", id));
    if (!Array.isArray(e.evidence) || e.evidence.length === 0 || !e.evidence.some((x: any) => x && String(x.text || "").trim())) {
      v.push(t("vNoQuote", id));
    } else if (quoteSet.size === 0) {
      v.push(t("vNoBenchmark", id));
    } else if (!e.evidence.some((x: any) => x && traceable(x.text))) {
      v.push(t("vNotTraceable", id));
    }
    if (String(e.kind || "").toLowerCase() === "add") {
      const srcs = new Set((e.evidence || []).map((x: any) => x?.source).filter((s) => realSources.has(s)));
      if (srcs.size < cfg.minGapEvidence) v.push(t("vAddSources", id, cfg.minGapEvidence, srcs.size));
    }
    if (e.find) {
      const n = occurrences(memText, e.find);
      if (n === 0) v.push(t("vFindNotFound", id));
      else if (n > 1) v.push(t("vFindNotUnique", id, n));
    }
    if (e.anchor) {
      const n = occurrences(memText, e.anchor);
      if (n === 0) v.push(t("vAnchorNotFound", id));
      else if (n > 1) v.push(t("vAnchorNotUnique", id, n));
    }
  }
  const { text: projected, errors } = applyEdits(memText, edits);
  if (errors.length) v.push(...errors);
  const bs = budgetStatus(memText, projected, cfg.budgetTokens);
  if (!bs.withinBudget && bs.delta >= 0) v.push(t("vShrink", bs.delta));
  return { ok: v.length === 0, violations: v };
}

// ── 双语 Prompt ───────────────────────────────────────────────────────────────
const ANALYSIS_PROMPT: Record<Lang, string> = {
  zh: `你是一个严格的会话分析器。下面是一个会话的压缩记录和一份 AGENTS.md 的可寻址规则单元。
请逐条判断每条规则单元在该会话中被遵守(followed)、被违反(violated)、还是未被触及(irrelevant)。
判定要严格、宁缺毋滥：仅当会话【明显体现】某条规则被主动遵守时才标 followed；
仅当会话【明显违反】某条规则时才标 violated；其余（无关或无法判断）一律标 irrelevant。
不要默认所有规则都被遵守——多数情况下应为 irrelevant。
同时，如果发现会话中存在 AGENTS.md 完全没有覆盖的问题（gap），请提出一个候选规则。

硬性要求（红线）：
1. 任何判定（含 followed/violated/gap）都必须附带 quote 字段，且该 quote 必须逐字来自下面的会话记录，绝不可编造或概括。
   若某条规则你无法在会话中找出【逐字】体现它被遵守或被违反的具体时刻，则应标 irrelevant，而不是 followed。
2. 对 reference 类单元（背景/目录/技术栈/路由等），不要因为"会话没提到它"就标记为 violated 或建议删除；它只在被"错误使用"时才算 violated。
3. gap 的 mistake 为必填，缺失则整条 gap 作废。
4. 只输出 JSON，不要其它文字。

AGENTS.md 规则单元：
{UNITS}

会话压缩记录：
{TRANSCRIPT}

输出 JSON 格式：
{FORMAT}`,
  en: `You are a strict session analyzer. Below is a compressed record of one session and the addressable rule units of an AGENTS.md file.
For each rule unit, judge whether it was followed, violated, or irrelevant in this session.
Be strict and conservative: only mark "followed" when the session clearly demonstrates the rule being actively applied;
only mark "violated" when the session clearly breaks the rule; everything else (unrelated or unclear) is "irrelevant".
Do not assume every rule was followed — most should be irrelevant.
Also, if the session reveals a problem that AGENTS.md does not cover at all (a gap), propose a candidate rule.

Hard requirements (red lines):
1. Every judgment (followed/violated/gap) must include a quote field, and the quote must be verbatim from the session record below — never fabricate or paraphrase.
   If you cannot find a verbatim moment in the session that demonstrates a rule being followed or violated, mark it "irrelevant" instead.
2. For reference units (background/directory/stack/routing etc.), do NOT mark them violated or suggest deletion just because the session never mentioned them; only when they were actually misused.
3. gap.mistake is required; a gap without it is discarded.
4. Output only JSON, no other text.

AGENTS.md rule units:
{UNITS}

Session record:
{TRANSCRIPT}

Output JSON format:
{FORMAT}`,
};

const ANALYSIS_FORMAT: Record<Lang, string> = {
  zh: `{ "units": [ { "id": "u3", "status": "followed|violated|irrelevant", "quote": "逐字原文", "note": "一句话说明" } ], "gaps": [ { "topic": "build|deploy|i18n|git|config|test|structure|docs|other", "proposedInstruction": "≤15字祈使短句", "mistake": "具体失误（必填）", "quote": "逐字原文", "recurrenceRisk": "low|medium|high" } ] }`,
  en: `{ "units": [ { "id": "u3", "status": "followed|violated|irrelevant", "quote": "verbatim text", "note": "one-line note" } ], "gaps": [ { "topic": "build|deploy|i18n|git|config|test|structure|docs|other", "proposedInstruction": "imperative ≤15 chars", "mistake": "the concrete mistake (required)", "quote": "verbatim text", "recurrenceRisk": "low|medium|high" } ] }`,
};

function buildAnalysisPrompt(units: any[], distilledText: string, lang: Lang): string {
  const unitLines = units.map((u) =>
    `- [${u.id}] (${u.kind}) ${u.section ? u.section + " › " : ""}${u.text.slice(0, UNIT_TEXT_IN_PROMPT).replace(/\n/g, " ")}`
  ).join("\n");
  return ANALYSIS_PROMPT[lang]
    .replace("{UNITS}", unitLines)
    .replace("{TRANSCRIPT}", "```\n" + distilledText + "\n```")
    .replace("{FORMAT}", ANALYSIS_FORMAT[lang]);
}

const SYNTHESIS_PROMPT: Record<Lang, string> = {
  zh: `你是一个 AGENTS.md 编辑提案器。基于下面的聚合证据，生成小规模、可审计的修改提案。

纪律（红线）：
1. 每次提案编辑数很少（学习率）：预算内最多 5 条；若文件已超预算，则必须是"收缩"计划（净负增量）。
2. 预算护栏：目标文件约 {TOKENS} tokens，硬上限 {BUDGET} tokens。新增内容必须有等量删减/精简来平衡（零和）。
3. 每条编辑必须附带至少一条 evidence，其 text 必须【逐字】来自下面列出的会话 quote，source 必须用下面给出的真实会话 id，绝不可编造。标了 [未逐字·不可引用] 的 quote 不得作为 evidence 引用。
4. 对 reference 类单元（背景/目录/技术栈/路由等），不要因为"没被引用"就建议删除或抽取；只在被"错误使用"或确实过时时才动。
5. 每条编辑用 find/replace 表达：find 必须是目标文件中出现【恰好一次】的原文片段。
6. 新增类（add）编辑若期望插入到特定章节后，请提供 anchor（锚点文本，必须是文件中恰好出现一次的行）；不加 anchor 则追加到文件末尾。
7. 空白(gap)候选桶只是【分组】：一个 topic 桶里可能包含多个不同问题（例如都关于"部署前"，但实际是构建 vs 备份）。
   仅当其中【若干观察】确实证明【同一个问题】在 ≥{MIN_GAP} 个不同会话反复出现时，才可新增规则（kind=add），且该 add 的 evidence 必须引用这些真实观察的 quote + 真实 source；否则不要新增。
8. 只输出合法 JSON。

可用会话来源（evidence.source 必须用这里面的真实 id）：{SOURCES}

聚合证据 — 规则单元：
{INSTRUCTIONS}

聚合证据 — 空白(gap)候选桶（按 topic 分组；每条观察含规则/失误/quote，需你判断哪些观察是同一个问题）：
{GAPS}

当前 AGENTS.md 全文：
{AGENTS}

输出 JSON：
{FORMAT}`,
  en: `You are an AGENTS.md edit proposer. Based on the aggregated evidence below, produce a small, auditable set of edits.

Discipline (red lines):
1. Keep the number of edits small (learning rate): at most 5 within budget; if the file is over budget, the plan must be a shrink plan (net negative delta).
2. Budget guardrail: target file is about {TOKENS} tokens, hard cap {BUDGET} tokens. Additions must be balanced by equal removals/tightening (zero-sum).
3. Every edit must carry at least one evidence entry whose text is VERBATIM from a session quote listed below, and whose source is a real session id from the whitelist below — never fabricate. Quotes marked [not-verbatim] must not be cited as evidence.
4. For reference units (background/directory/stack/routing etc.), do NOT suggest deletion or extraction just because they were not cited; only when actually misused or clearly outdated.
5. Express each edit with find/replace: find must be a snippet that occurs EXACTLY ONCE in the target file.
6. For add edits, if you want to place the rule under a specific section, provide an anchor (a line that occurs exactly once); without an anchor the text is appended at the end.
7. Gap candidate buckets are just groupings: one topic bucket may contain several different problems (e.g. both about "before deploy", but one is build and one is backup).
   Only when some observations truly show the SAME problem recurring in ≥{MIN_GAP} different sessions may you add a rule (kind=add), and its evidence must cite those real observations' quotes + real sources; otherwise do not add.
8. Output only valid JSON.

Available session sources (evidence.source must use these real ids): {SOURCES}

Aggregated evidence — rule units:
{INSTRUCTIONS}

Aggregated evidence — gap candidate buckets (grouped by topic; each observation has rule/mistake/quote; judge which observations are the same problem):
{GAPS}

Current AGENTS.md:
{AGENTS}

Output JSON:
{FORMAT}`,
};

const SYNTHESIS_FORMAT: Record<Lang, string> = {
  zh: `{ "edits": [ { "id": "e1", "kind": "add|remove|rewrite|extract", "title": "一句话", "rationale": "理由", "find": "原文（add 可省）", "replace": "新文本（remove 时空串）", "anchor": "章节锚点（可选，仅 add 使用）", "evidence": [ { "polarity": "positive|negative", "text": "逐字原文", "source": "会话id" } ], "transcripts": 2 } ] }`,
  en: `{ "edits": [ { "id": "e1", "kind": "add|remove|rewrite|extract", "title": "one-line title", "rationale": "reason", "find": "verbatim snippet (optional for add)", "replace": "new text (empty string for remove)", "anchor": "section anchor (optional, add only)", "evidence": [ { "polarity": "positive|negative", "text": "verbatim text", "source": "session id" } ], "transcripts": 2 } ] }`,
};

function buildSynthesisPrompt(fold: any, memoryText: string, budgetTokens: number, realSources: string[] = [], minGapEvidence: number, lang: Lang): string {
  const instrLines = fold.instructions.map((i: any) =>
    `- [${i.instruction}] (${i.kind}) ±${i.positive}/∓${i.negative} · ${i.sessions} sessions · ${i.section ? i.section + " › " : ""}${String(i.text ?? "").slice(0, 100)}`
  ).join("\n");
  const gapLines = fold.gaps.map((g: any) => {
    const head = `## topic=${g.topic}（${g.sessions} sessions）`;
    const lines = (g.items || []).slice(0, 15).map((it: any) => {
      const q = it.verbatim ? `"${String(it.quote || "").slice(0, 140)}"` : `"${String(it.quote || "").slice(0, 140)}"[not-verbatim]`;
      return `  - obs(${String(it.source || "").slice(-24)}): rule="${String(it.proposedInstruction || "").slice(0, 60)}" mistake="${String(it.mistake || "").slice(0, 60)}" quote=${q}`;
    });
    return head + "\n" + lines.join("\n");
  }).join("\n");
  return SYNTHESIS_PROMPT[lang]
    .replace("{TOKENS}", String(estimateTokens(memoryText)))
    .replace("{BUDGET}", String(budgetTokens))
    .replace("{MIN_GAP}", String(minGapEvidence))
    .replace("{SOURCES}", realSources.join(", ") || "(none)")
    .replace("{INSTRUCTIONS}", instrLines || "(none)")
    .replace("{GAPS}", gapLines || "(none)")
    .replace("{AGENTS}", "```\n" + memoryText + "\n```")
    .replace("{FORMAT}", SYNTHESIS_FORMAT[lang]);
}

// ── 蒸馏（需 fs，但无需 pi）──────────────────────────────────────────────────
async function distillSession(path: string): Promise<{ text: string; userTurns: number; mtime: number; size: number }> {
  const st = statSync(path);
  const raw = readFileSync(path, "utf8");
  const parts: string[] = [];
  let userTurns = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let entry: any;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry?.type !== "message" || !entry.message) continue;
    const msg = entry.message;
    if (msg.role === "user") {
      userTurns++;
      const t2 = textOf(msg.content);
      if (t2.trim()) parts.push(`user: ${t2.slice(0, MAX_TRANSCRIPT_TEXT)}`);
    } else if (msg.role === "assistant") {
      const content = Array.isArray(msg.content) ? msg.content : [];
      const texts = content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n");
      if (texts.trim()) parts.push(`assistant: ${texts.slice(0, MAX_TRANSCRIPT_TEXT)}`);
      for (const b of content) {
        if (b?.type === "toolCall") parts.push(`  tool: ${b.name}(${shapeOfArgs(b.arguments)})`);
      }
    } else if (msg.role === "bashExecution") {
      const cmd = String(msg.command ?? "").slice(0, 300);
      parts.push(`  command: ${cmd} (exit ${msg.exitCode ?? "?"})`);
    }
  }
  let rawText = redact(parts.join("\n"));
  if (rawText.length > MAX_SESSION_CHARS) {
    const half = Math.floor(MAX_SESSION_CHARS / 2);
    rawText = rawText.slice(0, half) + "\n…[truncated]…\n" + rawText.slice(-half);
  }
  return { text: rawText, userTurns, mtime: st.mtimeMs, size: st.size };
}

/**
 * train-agents — Pi extension for gradient-descent maintenance of AGENTS.md.
 * Inspired by backpass (kunchenguid/backpass): treat the project memory file as a
 * size-budgeted model, train it on the sessions that actually ran, with a human
 * gate as the only write path.
 *
 * i18n: zh / en (config `language`, default auto-detect from env LANG).
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, copyFileSync, unlinkSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";


// ── 路径与状态 ────────────────────────────────────────────────────────────────
const DATA_DIR = join(homedir(), ".pi", "agent", "train-agents");
const CONFIG_PATH = join(DATA_DIR, "config.json");

const cwdHash = (cwd: string) => fingerprint(resolve(cwd));
const statePath = (cwd: string) => join(DATA_DIR, `${cwdHash(cwd)}.state.json`);
const rejPath = (cwd: string) => join(DATA_DIR, `${cwdHash(cwd)}.rejections.json`);
const propPath = (cwd: string) => join(DATA_DIR, `${cwdHash(cwd)}.proposal.json`);

function ensureDir() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }

function loadConfig() {
  ensureDir();
  const base = { ...DEFAULT_CONFIG, analysis: { ...DEFAULT_CONFIG.analysis }, synthesis: { ...DEFAULT_CONFIG.synthesis } };
  if (existsSync(CONFIG_PATH)) {
    try { return deepMerge(base, JSON.parse(readFileSync(CONFIG_PATH, "utf8"))); }
    catch { /* 损坏则用默认 */ }
  } else {
    saveConfig(base);
  }
  return base;
}

function saveConfig(cfg: any) { ensureDir(); writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); }

function deepMerge(base: any, over: any): any {
  if (!over || typeof over !== "object") return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over)) {
    if (over[k] === undefined) continue;
    out[k] = (out[k] && typeof out[k] === "object" && !Array.isArray(out[k]) && typeof over[k] === "object" && !Array.isArray(over[k]))
      ? deepMerge(out[k], over[k]) : over[k];
  }
  return out;
}

function loadState(cwd: string) {
  if (existsSync(statePath(cwd))) {
    try { return JSON.parse(readFileSync(statePath(cwd), "utf8")); } catch { }
  }
  return { analyzed: {}, evidence: [], gapLedger: [] };
}
function saveState(cwd: string, st: any) { ensureDir(); writeFileSync(statePath(cwd), JSON.stringify(st, null, 2)); }

function loadRejections(cwd: string): any[] {
  if (existsSync(rejPath(cwd))) { try { return JSON.parse(readFileSync(rejPath(cwd), "utf8")); } catch { } }
  return [];
}
function saveRejections(cwd: string, r: any[]) { ensureDir(); writeFileSync(rejPath(cwd), JSON.stringify(r, null, 2)); }

// ── 记忆文件解析 ──────────────────────────────────────────────────────────────
function resolveMemoryFile(cwd: string, cfg: any): { primary: string | null } {
  for (const name of cfg.memoryFiles) {
    const p = join(cwd, name);
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf8").trim();
      const m = raw.match(/^@(.+\.md)\s*$/);
      if (m) { const target = join(cwd, m[1]); if (existsSync(target)) return { primary: target }; }
      return { primary: p };
    }
  }
  return { primary: null };
}

// ── 模型调用 ──────────────────────────────────────────────────────────────────
function reasoningOpts(model: any, effort: string | undefined) {
  if (!effort) return {};
  const api = String(model?.api || "");
  if (api === "anthropic-messages") return { thinkingEnabled: true, effort };
  if (api.startsWith("openai") || api.startsWith("azure")) return { reasoningEffort: effort };
  if (api.startsWith("google")) return { thinking: { enabled: true } };
  return {};
}

async function callModel(ctx: ExtensionCommandContext, cfg: any, role: "analysis" | "synthesis", prompt: string): Promise<string> {
  const rc = cfg[role];
  let model = ctx.model;
  if (rc.model) { const [p, ...r] = rc.model.split("/"); model = ctx.modelRegistry.find(p, r.join("/")); }
  if (!model) { ctx.ui.notify(t("modelNotFound", role), "error"); throw new Error("model not found"); }
  if (!ctx.modelRegistry.hasConfiguredAuth(model)) { ctx.ui.notify(t("noAuth", `${model.provider}/${model.id}`), "error"); throw new Error("no auth"); }
  let effort = rc.effort;
  if (effort && !VALID_EFFORTS.includes(effort)) {
    ctx.ui.notify(t("badEffort", role, effort, VALID_EFFORTS.join("/")), "warning");
    effort = undefined;
  }
  const messages = [{ role: "user" as const, content: [{ type: "text" as const, text: prompt }], timestamp: Date.now() }];
  const resp: any = await ctx.modelRegistry.complete(model, { messages }, {
    ...reasoningOpts(model, effort),
    cacheRetention: "none",
    sessionId: `train-agents-${role}`,
    signal: ctx.signal,
  } as any);
  if (resp?.stopReason === "error") throw new Error(resp.errorMessage || "model call failed");
  return (resp.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
}

async function analyzeTranscript(ctx: ExtensionCommandContext, cfg: any, units: any[], distilled: any, lang: Lang): Promise<any> {
  const prompt = buildAnalysisPrompt(units, distilled.text, lang);
  const out = await callModel(ctx, cfg, "analysis", prompt);
  const json = extractJson(out);
  if (!json) return { units: [], gaps: [] };
  const hasQ = (q: string) => (q || "").trim().length > 0;
  const hasM = (s: string) => (s || "").trim().length > 0;
  const unitsFiltered = (json.units || [])
    .filter((u: any) => (u.status === "followed" || u.status === "violated") ? hasQ(u.quote) : true)
    .map((u: any) => ({ ...u, verbatim: hasQ(u.quote) ? isVerbatim(u.quote, distilled.text) : false }));
  const gapsFiltered = (json.gaps || []).filter((g: any) => hasQ(g.quote) && hasM(g.mistake)).map((g: any) => ({ ...g, verbatim: isVerbatim(g.quote, distilled.text) }));
  return { units: unitsFiltered, gaps: gapsFiltered };
}

// ── Footer 实时进度 ───────────────────────────────────────────────────────────
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
function spin() { return SPIN[Math.floor(Date.now() / 90) % SPIN.length]; }
function bar(pct: number, width = 24): string {
  const cells = Math.round(Math.min(1, pct) * width);
  return "▰".repeat(cells) + "▱".repeat(width - cells);
}

let currentFooter: any = null;

class Footer {
  state: any = {};
  ctx: ExtensionCommandContext | null = null;
  active = false;
  private timer: any = null;
  start(ctx: ExtensionCommandContext, repo: string, since: string, cur: number, cap: number, units: number) {
    this.ctx = ctx; this.active = true; currentFooter = this;
    this.state = { repo, since, cur, cap, units, steps: [], transcripts: "", evidence: { helped: 0, violated: 0, gaps: 0 }, startTime: Date.now() };
    this.paint(); this.timer = setInterval(() => this.paint(), 200);
  }
  setStep(name: string, status: "todo" | "doing" | "done") {
    const i = this.state.steps.findIndex((s: any) => s.name === name);
    const row = { name, status }; if (i >= 0) this.state.steps[i] = row; else this.state.steps.push(row); this.paint();
  }
  setTranscript(s: string) { this.state.transcripts = s; this.paint(); }
  setEvidence(e: any) { this.state.evidence = e; this.paint(); }
  private paint() {
    if (!this.active) return;
    const ctx = this.ctx; if (!ctx || ctx.mode !== "tui") return;
    const s = this.state; const pct = s.cap ? Math.round((s.cur / s.cap) * 100) : 0;
    const elapsed = Math.floor((Date.now() - (s.startTime || Date.now())) / 1000);
    ctx.ui.setFooter((_tui, theme) => ({
      render: (width: number) => {
        const tm = theme;
        const stepStr = (s.steps as any[]).map((st: any) =>
          st.status === "done" ? tm.fg("success", "✓") + " " + tm.fg("dim", st.name)
          : st.status === "doing" ? tm.fg("accent", spin()) + " " + tm.bold(st.name)
          : tm.fg("dim", "○ " + st.name)
        ).join("   ");
        const barColor = pct > 90 ? tm.fg("warning", bar(pct)) : tm.fg("dim", bar(pct));
        const budgetColor = pct > 90 ? tm.fg("warning", String(pct) + "%") : tm.fg("dim", String(pct) + "%");
        return [
          tm.fg("accent", "∇ train-agents") + tm.fg("dim", ` · ${s.repo} · ${t("footerSince")} ${s.since}`),
          `AGENTS.md ${barColor} ${tm.bold(s.cur.toLocaleString())} / ${s.cap.toLocaleString()} tok · ${s.units} ${t("footerInst", pct + "%")}`,
          stepStr || tm.fg("dim", "○ " + t("footerReady")),
          (s.transcripts ? `  ${s.transcripts}` : "") + tm.fg("dim", `  · ${t("footerElapsed", elapsed)}`),
          `  ${tm.fg("success", "✓ " + s.evidence.helped + " " + t("footerFollowed"))}   ${tm.fg("error", "✗ " + s.evidence.violated + " " + t("footerViolated"))}   ${tm.fg("warning", "◆ " + s.evidence.gaps + " " + t("footerBuckets"))}`,
        ].filter(Boolean).map((l) => (l.length > width ? l.slice(0, width - 1) + "…" : l));
      }, invalidate: () => {},
    }));
  }
  stop(ctx: ExtensionCommandContext) {
    this.active = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (currentFooter === this) currentFooter = null;
    if (ctx.mode !== "tui") return;
    const s = this.state; const pct = s.cap ? Math.round((s.cur / s.cap) * 100) : 0;
    const elapsed = Math.floor((Date.now() - (s.startTime || Date.now())) / 1000);
    ctx.ui.setFooter((_tui, theme) => ({
      render: (width: number) => {
        const tm = theme;
        const barColor = pct > 90 ? tm.fg("warning", bar(pct)) : tm.fg("dim", bar(pct));
        return [
          tm.fg("accent", "∇ train-agents") + tm.fg("dim", ` · ${s.repo} · ${t("footerDone", elapsed)}`),
          `AGENTS.md ${barColor} ${tm.bold(s.cur.toLocaleString())} / ${s.cap.toLocaleString()} tok`,
          `  ${tm.fg("success", "✓ " + s.evidence.helped + " " + t("footerFollowed"))}   ${tm.fg("error", "✗ " + s.evidence.violated + " " + t("footerViolated"))}   ${tm.fg("warning", "◆ " + s.evidence.gaps + " " + t("footerBuckets"))}`,
        ].filter(Boolean).map((l) => (l.length > width ? l.slice(0, width - 1) + "…" : l));
      }, invalidate: () => {},
    }));
  }
}

function emit(ctx: ExtensionCommandContext, text: string, pi?: any) {
  if (ctx.mode === "tui" || ctx.mode === "rpc") {
    try { (pi || (ctx as any).pi)?.sendMessage?.({ customType: "train-agents", content: text, display: true, details: {} }, { triggerTurn: false } as any); } catch { }
  } else { console.log(text); }
}

// ── 命令实现 ──────────────────────────────────────────────────────────────────
async function runAnalyze(ctx: ExtensionCommandContext, silent = false) {
  const cfg = loadConfig();
  const lang = resolveLang(cfg); setLang(lang);
  const { primary } = resolveMemoryFile(ctx.cwd, cfg);
  const footer = new Footer();
  if (!primary) { ctx.ui.notify(t("notFoundMemory"), "warning"); return null; }
  const memText = readFileSync(primary, "utf8");
  const { units, tokens } = parseMemoryUnits(memText);
  const st = loadState(ctx.cwd);
  const memHash = fingerprint(memText);
  const curSession = ctx.sessionManager.getSessionFile();

  st.evidence = (st.evidence || []).filter((r: any) => r.memoryHash === memHash);
  st.gapLedger = (st.gapLedger || []).filter((g: any) => {
    if (!g.proposedInstruction) return false;
    return !units.some((u: any) => similarity(u.text, g.proposedInstruction) >= 0.6);
  });
  saveState(ctx.cwd, st);

  footer.start(ctx, ctx.cwd.split("/").pop() || ctx.cwd, cfg.since, tokens, cfg.budgetTokens, units.length);
  footer.setStep(t("stepCollect"), "doing");

  const sinceMs = parseSince(cfg.since);
  const cutoff = sinceMs == null ? 0 : Date.now() - sinceMs;
  let sessions: any[] = [];
  try { sessions = await SessionManager.list(ctx.cwd); } catch (e: any) { ctx.ui.notify(t("listFail", e.message), "error"); footer.stop(ctx); return null; }
  const candidates = sessions.filter((s: any) => {
    if (curSession && s.path === curSession) return false;
    if (cutoff && new Date(s.modified).getTime() < cutoff) return false;
    return true;
  });
  let worklist = candidates.filter((s: any) => {
    const a = st.analyzed[s.path];
    if (!a) return true;
    try { const stm = statSync(s.path); return a.hash !== memHash || a.mtime !== stm.mtimeMs || a.size !== stm.size; } catch { return true; }
  });
  const reused = candidates.length - worklist.length;
  if (cfg.maxTranscripts && worklist.length > cfg.maxTranscripts) {
    worklist.sort((a: any, b: any) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    worklist.length = cfg.maxTranscripts;
  }

  footer.setStep(t("stepCollect"), "done");
  footer.setStep(t("stepLoss"), "doing");
  ctx.ui.notify(t("foundN", worklist.length, reused), "info");

  let analyzed = 0, skipped = 0, failed = 0, helped = 0, violated = 0, gaps = 0, idx = 0;
  const jobs = Math.max(1, cfg.jobs || 4);

  const worker = async (s: any) => {
    idx++;
    const label = `${spin()} ${idx}/${worklist.length} ● ${s.path.split("/").pop()}`;
    footer.setTranscript(label);
    const distilled = await distillSession(s.path);
    if (distilled.userTurns < cfg.minUserTurns) { skipped++; return; }
    try {
      const res = await analyzeTranscript(ctx, cfg, units, distilled, lang);
      const record = {
        ok: true, source: s.path.split("/").pop(), sessionFile: s.path, at: Date.now(), memoryHash: memHash,
        positive: (res.units || []).filter((u: any) => u.status === "followed").map((u: any) => ({ instruction: u.id, quote: u.quote || "", verbatim: !!u.verbatim, effect: u.note || "" })),
        negative: (res.units || []).filter((u: any) => u.status === "violated").map((u: any) => ({ instruction: u.id, quote: u.quote || "", verbatim: !!u.verbatim, effect: u.note || "" })),
        gaps: (res.gaps || []).map((g: any) => ({ topic: g.topic || "other", proposedInstruction: g.proposedInstruction, mistake: g.mistake, quote: g.quote || "", verbatim: !!g.verbatim, recurrenceRisk: g.recurrenceRisk })),
      };
      st.evidence.push(record);
      st.analyzed[s.path] = { hash: memHash, at: Date.now(), mtime: distilled.mtime, size: distilled.size };
      analyzed++;
      helped += record.positive.length; violated += record.negative.length; gaps += record.gaps.length;
    } catch (e: any) {
      failed++;
      ctx.ui.notify(t("sessionFail", e.message), "warning");
    }
    footer.setEvidence({ helped, violated, gaps });
  };

  const queue = [...worklist];
  async function runPool() {
    const workers: Promise<void>[] = [];
    for (let i = 0; i < jobs && queue.length > 0; i++) {
      workers.push((async () => { while (queue.length > 0) { const s = queue.shift()!; if (ctx.signal?.aborted) break; await worker(s); } })());
    }
    await Promise.all(workers);
  }
  await runPool();

  for (const rec of st.evidence) {
    for (const g of rec.gaps) {
      const dup = st.gapLedger.some((x: any) => x.sessionId === rec.sessionFile && similarity(x.proposedInstruction, g.proposedInstruction) >= GAP_SIMILARITY_THRESHOLD);
      if (!dup && g.proposedInstruction) {
        st.gapLedger.push({ topic: g.topic || "other", proposedInstruction: g.proposedInstruction, mistake: g.mistake, quote: g.quote, verbatim: !!g.verbatim, recurrenceRisk: g.recurrenceRisk, source: rec.source, sessionId: rec.sessionFile, at: rec.at });
      }
    }
  }
  const gapAgeMs = parseSince(cfg.gapLedgerMaxAge);
  if (gapAgeMs != null) st.gapLedger = st.gapLedger.filter((g: any) => Date.now() - g.at < gapAgeMs);
  saveState(ctx.cwd, st);

  footer.setStep(t("stepLoss"), "done");
  const fold = foldEvidence(st.evidence, { minGapEvidence: cfg.minGapEvidence, memoryUnits: units, gapObservations: st.gapLedger });
  footer.setEvidence({ helped: fold.totals.positive, violated: fold.totals.negative, gaps: fold.totals.gapClusters });
  footer.stop(ctx);
  ctx.ui.notify(t("analysisDone", analyzed, skipped, failed, reused), "info");
  if (!silent) printEvidence(ctx, fold, primary, tokens, cfg);
  return fold;
}

function printEvidence(ctx: ExtensionCommandContext, fold: any, memPath: string, tokens: number, cfg: any) {
  const out: string[] = [];
  out.push(t("evTitle"));
  out.push(t("evFile", memPath, tokens, cfg.budgetTokens, fold.analyzedSessions));
  const withEvidence = fold.instructions.filter((i: any) => i.positive > 0 || i.negative > 0);
  const untouched = fold.instructions.length - withEvidence.length;
  out.push(t("evCounts", fold.totals.positive, fold.totals.negative, fold.totals.gapClusters, untouched));
  out.push("");
  if (withEvidence.length === 0) { out.push(t("evRules")); out.push(t("evNoRules")); } else {
    out.push(t("evRules"));
    for (const i of withEvidence) {
      const flag = i.negative > 0 ? "✗" : "✓";
      out.push(`- ${flag} [${i.instruction}](${i.kind}) ${t("evFollowViol", i.positive, i.negative, i.sessions)} · ${i.section || ""}`.trim());
      for (const q of i.quotes.slice(0, 2)) { const qt = String(q.text || "").trim(); if (qt) out.push(`    - ${qt.slice(0, 120)}${q.verbatim ? "" : t("evNotVerbatim")}`); }
    }
  }
  out.push("");
  out.push(t("evBuckets", cfg.minGapEvidence));
  if (fold.gaps.length === 0) out.push(t("evNoBuckets"));
  for (const g of fold.gaps) {
    out.push(t("evBucketLine", g.topic, g.sessions, (g.items || []).length, g.recurrenceRisk));
    for (const q of g.quotes.slice(0, 2)) { const qt = String(q.text || "").trim(); if (qt) out.push(`    - ${qt.slice(0, 120)}${q.verbatim ? "" : t("evNotVerbatim")}`); }
  }
  emit(ctx, out.join("\n"));
}

async function runPropose(ctx: ExtensionCommandContext) {
  const cfg = loadConfig();
  const lang = resolveLang(cfg); setLang(lang);
  const { primary } = resolveMemoryFile(ctx.cwd, cfg);
  if (!primary) { ctx.ui.notify(t("notFoundMemory"), "warning"); return; }
  const memText = readFileSync(primary, "utf8");
  const { units, tokens } = parseMemoryUnits(memText);
  const st = loadState(ctx.cwd);
  const memHash = fingerprint(memText);
  st.evidence = (st.evidence || []).filter((r: any) => r.memoryHash === memHash);
  if (!st.evidence || st.evidence.length === 0) { ctx.ui.notify(t("noEvidence"), "warning"); return; }

  ctx.ui.notify(t("proposeStart"), "info");
  const fold = foldEvidence(st.evidence, { minGapEvidence: cfg.minGapEvidence, memoryUnits: units, gapObservations: st.gapLedger });
  const allQuotes = (st.evidence || []).flatMap((r: any) =>
    [...(r.positive || []), ...(r.negative || []), ...(r.gaps || [])]
      .filter((x: any) => x?.verbatim)
      .map((x: any) => x.quote || "").filter(Boolean)
  );
  const realSources = new Set(st.evidence.map((r: any) => r.source).filter(Boolean));
  const prompt = buildSynthesisPrompt(fold, memText, cfg.budgetTokens, [...realSources], cfg.minGapEvidence, lang);
  // 生成提案中：覆盖 analyze 的 done footer，避免“0s”却还在跑合成模型的误导
  if (ctx.mode === "tui") {
    ctx.ui.setFooter((_t, theme) => ({ render: (width: number) => [theme.fg("accent", "◆ " + t("proposeWorking"))], invalidate: () => {} }));
  }
  let json: any = null, lastViolations: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let p = prompt;
    if (attempt === 1) p += `\n\nviolations:\n- ` + lastViolations.join("\n- ");
    const out = await callModel(ctx, cfg, "synthesis", p);
    json = extractJson(out);
    if (!json) { ctx.ui.notify(t("synthParseFail"), "error"); return; }
    const v = validateProposal(json.edits || [], memText, tokens, cfg, allQuotes, realSources);
    if (v.ok) break;
    lastViolations = v.violations;
    if (attempt === 0) { ctx.ui.notify(t("gateRetry"), "warning"); continue; }
    ctx.ui.notify(t("gateFailTwice", v.violations.join("; ")), "error"); return;
  }

  const edits = (json.edits || []).map((e: any, i: number) => {
    const id = e.id || `e${i + 1}`;
    const delta = estimateTokens(applyEdits(memText, [{ ...e, id }]).text) - tokens;
    return { ...e, id, deltaTokens: delta };
  });
  // 真跑暴露的修复：edits 为空时【不写】proposal.json（否则 status 误报“待审核提案”，review 却空）；提示语区分两种空提案
  if (edits.length === 0) {
    const hasAny = fold.totals.positive + fold.totals.negative + fold.gaps.length > 0;
    const msg = hasAny ? t("propNoEditsTier2") : t("propNoEdits");
    ctx.ui.notify(msg, "info");
    if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
    emit(ctx, `# ${t("propTitle")}\n${msg}`);
    // 交互式下一步：无提案时也给出引导
    if (ctx.hasUI) {
      const look = await ctx.ui.confirm(t("nextStepLookPrompt"), t("nextStepLookBody"));
      if (look) { await runAnalyze(ctx, false); }
      else { ctx.ui.notify(t("nextStepWait"), "info"); }
    } else {
      ctx.ui.notify(t("nextStepWait"), "info");
    }
    return;
  }
  const proposal = {
    repo: ctx.cwd.split("/").pop(), memoryFile: primary, memoryHash: memHash,
    budget: { ...budgetStatus(memText, applyEdits(memText, edits).text, cfg.budgetTokens), capTokens: cfg.budgetTokens },
    edits,
    stats: { transcripts: fold.analyzedSessions }, generatedAt: new Date().toISOString(),
  };
  ensureDir(); writeFileSync(propPath(ctx.cwd), JSON.stringify(proposal, null, 2));
  ctx.ui.notify(t("proposalDone", proposal.edits.length), "info");
  printProposal(ctx, proposal);
  // 清掉“生成提案中”footer，再弹下一步确认（避免对话框叠加在进度文本上）
  if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
  // 交互式下一步：TUI 且提案非空时，弹出确认是否立即 review（手动命令也能得到下一步引导）
  if (ctx.hasUI && proposal.edits.length > 0) {
    const go = await ctx.ui.confirm(t("reviewNowPrompt"), t("reviewNowBody"));
    if (go) { await runReview(ctx); }
    else { ctx.ui.notify(t("proposalSaved"), "info"); }
  }
}

function printProposal(ctx: ExtensionCommandContext, proposal: any) {
  const out: string[] = [
    t("propTitle"),
    t("propBudget", proposal.budget.current, proposal.budget.projected, proposal.budget.capTokens),
    "",
  ];
  for (const e of proposal.edits) {
    const delta = e.deltaTokens || 0;
    out.push(`- [${e.id}] ${String(e.kind || "").toUpperCase()} ${e.title} (${delta >= 0 ? "+" : ""}${delta} tok, ${e.transcripts} ${e.transcripts === 1 ? "session" : "sessions"})`);
    if (e.find) out.push(`    find: ${String(e.find).slice(0, 100)}`);
    if (e.replace) out.push(`    replace: ${String(e.replace).slice(0, 100)}`);
    for (const ev of (e.evidence || []).slice(0, 2)) out.push(`    ${t("propEvidence", ev.source, String(ev.text).slice(0, 120))}`);
  }
  ctx.ui.notify(`${t("proposalDone", proposal.edits.length)} · ${t("reviewHint")}`, "info");
  emit(ctx, out.join("\n"));
}

async function runReview(ctx: ExtensionCommandContext) {
  const cfg = loadConfig();
  const lang = resolveLang(cfg); setLang(lang);
  if (!ctx.hasUI) { ctx.ui.notify(t("reviewNeedTui"), "warning"); return; }
  const { primary } = resolveMemoryFile(ctx.cwd, cfg);
  if (!primary) { ctx.ui.notify(t("notFoundMemory"), "warning"); return; }
  if (!existsSync(propPath(ctx.cwd))) { ctx.ui.notify(t("noProposal"), "warning"); return; }
  const proposal = JSON.parse(readFileSync(propPath(ctx.cwd), "utf8"));
  const memText = readFileSync(primary, "utf8");
  const rej = loadRejections(ctx.cwd);

  const currentHash = fingerprint(memText);
  if (proposal.memoryHash && proposal.memoryHash !== currentHash) {
    ctx.ui.notify(t("externalModified"), "warning");
    return;
  }

  const accepted: any[] = [];
  for (const e of proposal.edits) {
    const fp = fingerprint(`${e.kind || ""}|${e.find || ""}|${e.replace || ""}|${e.title || ""}`);
    const alreadyRejected = rej.find((r: any) => r.fingerprint === fp);
    if (alreadyRejected) { ctx.ui.notify(t("skipRejected", e.id), "info"); continue; }
    const preview = [
      `【${String(e.kind || "").toUpperCase()}】${e.title}`,
      e.rationale ? `rationale: ${e.rationale}` : "",
      e.find ? `find:\n${e.find}` : "",
      e.replace ? `replace:\n${e.replace}` : "",
      ...(e.evidence || []).slice(0, 3).map((ev: any) => `${t("propEvidence", ev.source, String(ev.text || "").slice(0, 160))}`),
    ].filter(Boolean).join("\n");
    const ok = await ctx.ui.confirm(`[${e.id}] ${String(e.kind || "").toUpperCase()} — ${e.title}?`, preview);
    if (ok) accepted.push(e);
    else {
      const reason = (await ctx.ui.input("reason (optional):", "")) || "";
      rej.push({ fingerprint: fp, id: e.id, title: e.title, reason, at: Date.now() });
    }
  }
  saveRejections(ctx.cwd, rej);
  if (accepted.length === 0) { ctx.ui.notify(t("noneAccepted"), "info"); return; }

  const backupPath = join(DATA_DIR, `${cwdHash(ctx.cwd)}.backup-${Date.now()}.bak`);
  copyFileSync(primary, backupPath);
  const freshText = readFileSync(primary, "utf8");
  if (proposal.memoryHash && fingerprint(freshText) !== proposal.memoryHash) {
    ctx.ui.notify(t("externalModified"), "warning");
    return;
  }
  const { text: newText, errors } = applyEdits(freshText, accepted);
  if (errors.length) {
    copyFileSync(backupPath, primary);
    ctx.ui.notify(t("applyFailRestored", errors.join("; ")), "error");
    return;
  }
  writeFileSync(primary, newText);
  try { unlinkSync(propPath(ctx.cwd)); } catch { }
  try {
    const backups = readdirSync(DATA_DIR).filter((f) => f.startsWith(`${cwdHash(ctx.cwd)}.backup-`)).sort();
    while (backups.length > 5) { try { unlinkSync(join(DATA_DIR, backups.shift()!)); } catch { } }
  } catch { }
  ctx.ui.notify(t("wroteEdits", accepted.length, primary, backupPath), "info");
  const st = loadState(ctx.cwd); st.analyzed = {}; st.evidence = []; saveState(ctx.cwd, st);
}

function runStatus(ctx: ExtensionCommandContext) {
  const cfg = loadConfig();
  const lang = resolveLang(cfg); setLang(lang);
  const { primary } = resolveMemoryFile(ctx.cwd, cfg);
  const st = loadState(ctx.cwd);
  const tokens = primary ? estimateTokens(readFileSync(primary, "utf8")) : 0;
  const pct = cfg.budgetTokens ? Math.round((tokens / cfg.budgetTokens) * 100) : 0;
  const currentModel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "(unknown)";
  const effEdits = effectiveMaxEdits(tokens, cfg);
  const maxEditsDisp = cfg.maxEditsPerRun != null ? String(cfg.maxEditsPerRun) : `adaptive (now ${effEdits})`;
  const modelDesc = cfg.analysis.model || cfg.synthesis.model
    ? `"${cfg.analysis.model || "null"}" / "${cfg.synthesis.model || "null"}"`
    : `null (current session model: ${currentModel})`;
  const langLabel = lang === "zh" ? "zh" : "en";
  const lines = [
    t("stTitle"),
    t("stMemory", primary || "(none)", tokens, cfg.budgetTokens, pct),
    t("stAnalyzed", Object.keys(st.analyzed || {}).length, (st.evidence || []).length, (st.gapLedger || []).length),
    t("stProposal", existsSync(propPath(ctx.cwd)) ? `yes (/train-agents review)` : `no`),
    t("stDataFiles"),
    "",
    `## ${t("stConfigTitle")} (language=${langLabel})`.replace(/^## ##/, "##"),
    "",
    `| ${t("stHConfig")} | ${t("stHValue")} | ${t("stHMeaning")} | ${t("stHAnalog")} |`,
    `|---|---|---|---|`,
    `| minGapEvidence | ${cfg.minGapEvidence} | ${t("stRowMinGap", cfg.minGapEvidence)} | batch size |`,
    `| maxEdits | ${maxEditsDisp} | ${t("stRowMaxEdits")} | learning rate |`,
    `| since | ${cfg.since} | ${t("stRowSince", cfg.since)} | training window |`,
    `| analysis.effort | ${cfg.analysis.effort} | ${t("stRowAnalysis")} | tier1 forward |`,
    `| synthesis.effort | ${cfg.synthesis.effort} | ${t("stRowSynthesis")} | tier2 synthesis |`,
    `| jobs | ${cfg.jobs} | ${t("stRowJobs")} | workers |`,
    `| language | ${langLabel} | zh / en / auto | — |`,
    "",
    t("stAboutModel", modelDesc),
    t("stModelNote", currentModel, String((ctx.model as any)?.api || "unknown")),
    "",
    t("stHowToEdit"),
    "",
    "```json",
    `{ "language": "en", "minGapEvidence": 3, "maxEditsPerRun": 5, "since": "14d", "budgetTokens": 8000, "jobs": 8,`,
    `  "analysis": { "effort": "low", "model": "anthropic/claude-sonnet-4-5" },`,
    `  "synthesis": { "effort": "high", "model": "anthropic/claude-opus-4-5" } }`,
    "```",
    "",
    t("stSave"),
    "",
    t("stNoteAdd"),
    t("stNoteSafe"),
  ];
  ctx.ui.notify(t("statusOut"), "info");
  emit(ctx, lines.join("\n"));
}

// ── 扩展入口 ──────────────────────────────────────────────────────────────────
export default function (pi: ExtensionAPI) {
  const wrap = (fn: (ctx: ExtensionCommandContext, args: string) => Promise<void>) =>
    async (args: string, ctx: ExtensionCommandContext) => {
      (ctx as any).pi = pi;
      try { await fn(ctx, args); } catch (e: any) { ctx.ui.notify(t("cmdError", e.message), "error"); }
      finally { if (currentFooter) { currentFooter.stop(ctx); currentFooter = null; } }
    };

  // P1#7：命令 description 在注册时求值（早于各命令 handler 的 loadConfig），这里先定一次语言。
  // 审查小尾巴：loadConfig() 首次会写 config.json，包一层 try/catch——即便从不使用本命令、或 HOME 只读，也不应在扩展加载阶段抛错。
  try { setLang(resolveLang(loadConfig())); } catch { setLang(detectLang()); }

  pi.registerCommand("train-agents", {
    description: getLang() === "zh"
      ? "AGENTS.md 训练系统：无参=一键全流程 / analyze / propose / review / status"
      : "AGENTS.md training: (no arg) full pass / analyze / propose / review / status",
    getArgumentCompletions: (prefix: string) => {
      const subs = ["analyze", "propose", "review", "status"];
      return prefix ? subs.filter((s) => s.startsWith(prefix)).map((s) => ({ value: s, label: s })) : subs.map((s) => ({ value: s, label: s }));
    },
    handler: wrap(async (ctx, args) => {
      const first = args.trim().split(/\s+/)[0]?.toLowerCase();
      if (!first) {
        const fold = await runAnalyze(ctx, true);
        if (fold && fold.analyzedSessions > 0) await runPropose(ctx);
        else ctx.ui.notify(t("noSessionsThisRound"), "info");
        return;
      }
      if (first === "propose") return runPropose(ctx);
      if (first === "review") return runReview(ctx);
      if (first === "status") return runStatus(ctx);
      if (first === "analyze") return runAnalyze(ctx);
      ctx.ui.notify(t("usage"), "info");
    }),
  });
}

