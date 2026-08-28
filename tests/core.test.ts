import { test } from "node:test";
import assert from "node:assert/strict";
import {
  similarity, clusterGaps, applyEdits, validateProposal, parseMemoryUnits, foldEvidence,
  estimateTokens, effectiveMaxEdits, buildAnalysisPrompt, buildSynthesisPrompt, setLang, t,
} from "../src/core.ts";

// ── i18n ─────────────────────────────────────────────────────────────────────
test("i18n: t() switches zh/en", () => {
  setLang("zh");
  assert.equal(t("noEvidence"), "尚无证据，请先运行 analyze");
  setLang("en");
  assert.equal(t("noEvidence"), "No evidence yet — run analyze first");
});

// ── similarity（Sørensen-Dice over word bigrams, CJK-aware）────────────────
test("similarity: near-duplicate merges (containment ≥8 chars → 0.85)", () => {
  const a = "AGENTS.md 应显式写明：重建前必须先删除 out 目录，否则残留";
  const b = "AGENTS.md 应显式写明：重建前必须先删除 out 目录，否则残留陈旧文件";
  assert.ok(similarity(a, b) >= 0.85);
});

test("similarity: unrelated texts score low", () => {
  assert.ok(similarity("部署到 Cloudflare Pages", "改完代码必须提交并推送") < 0.2);
});

test("similarity: exact equal → 1", () => {
  assert.equal(similarity("完全相同的句子", "完全相同的句子"), 1);
});

// ── clusterGaps（topic 硬主键 + mistake 必填，保留全部观察）────────────────
test("clusterGaps: same topic + same problem merges as candidate", () => {
  const cs = clusterGaps([
    { topic: "git", proposedInstruction: "改完必须直接提交推送", mistake: "改完没直接提交就询问", quote: "q1", sessionId: "S1", source: "s1" },
    { topic: "git", proposedInstruction: "修改后应直接 commit 并 push", mistake: "修改后没直接 push 还来问", quote: "q2", sessionId: "S2", source: "s2" },
  ]);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].sessions.size, 2);
  assert.equal(cs[0].items.length, 2);
});

test("clusterGaps: different topic never merges", () => {
  const cs = clusterGaps([
    { topic: "build", proposedInstruction: "提交前先构建", mistake: "没构建", quote: "q1", sessionId: "S1" },
    { topic: "deploy", proposedInstruction: "提交前先构建", mistake: "没构建", quote: "q2", sessionId: "S2" },
  ]);
  assert.equal(cs.length, 2);
});

test("clusterGaps: missing mistake fails open-close (no merge)", () => {
  const cs = clusterGaps([
    { topic: "build", proposedInstruction: "先构建", mistake: "", quote: "q1", sessionId: "S1" },
    { topic: "build", proposedInstruction: "先构建再提交", mistake: "没构建", quote: "q2", sessionId: "S2" },
  ]);
  assert.equal(cs.length, 2);
});

test("clusterGaps: S1 三条+S2 一条 topic 桶——不丢真重复（regression）", () => {
  const cs = clusterGaps([
    { topic: "build", proposedInstruction: "提交前先构建", mistake: "没构建就提交", quote: "q-S1-a", sessionId: "S1" },
    { topic: "build", proposedInstruction: "构建前先删 out 目录", mistake: "out 没清", quote: "q-S1-b", sessionId: "S1" },
    { topic: "build", proposedInstruction: "构建失败要看 CF 日志", mistake: "没看日志", quote: "q-S1-c", sessionId: "S1" },
    { topic: "build", proposedInstruction: "构建前记得清 out", mistake: "忘清 out", quote: "q-S2-a", sessionId: "S2" },
  ]);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].items.length, 4, "所有观察都应保留");
  assert.ok(cs[0].items.some((i) => i.sessionId === "S1" && i.proposedInstruction.includes("删 out")), "真重复 q-S1-b 不能丢");
});

test("clusterGaps: 同会话同规则去重（sessionId+pi 精确）", () => {
  const cs = clusterGaps([
    { topic: "build", proposedInstruction: "提交前先构建", mistake: "没构建", quote: "q1", sessionId: "S1" },
    { topic: "build", proposedInstruction: "提交前先构建", mistake: "没构建", quote: "q2", sessionId: "S1" },
    { topic: "build", proposedInstruction: "提交前先构建", mistake: "没构建", quote: "q3", sessionId: "S2" },
  ]);
  assert.equal(cs[0].items.length, 2);
});

// ── foldEvidence：verbatim 透传 ─────────────────────────────────────────────
test("foldEvidence: verbatim 从记录透传到 gap quotes（regression）", () => {
  const records = [{
    ok: true, source: "s1",
    positive: [], negative: [],
    gaps: [{ topic: "build", proposedInstruction: "先删 out", mistake: "忘删", quote: "逐字来自会话的一句话", verbatim: true }],
  }];
  const units = parseMemoryUnits("# AGENTS.md\n## 目录构成\n一些内容\n").units;
  const fold = foldEvidence(records, { minGapEvidence: 1, memoryUnits: units, gapObservations: [
    { topic: "build", proposedInstruction: "先删 out", mistake: "忘删", quote: "逐字来自会话的一句话", verbatim: true, sessionId: "x", source: "s1" },
  ] });
  assert.equal(fold.gaps.length, 1);
  assert.equal(fold.gaps[0].quotes[0].verbatim, true, "verbatim:true 必须透传到 fold quotes");
});

// ── applyEdits ─────────────────────────────────────────────────────────────
test("applyEdits: $& 不被展开（regression）", () => {
  const r = applyEdits("AGENTS.md 里有 sed s/a/b/ 示例", [{ id: "e1", find: "sed s/a/b/", replace: "cost is $& dollars" }]);
  assert.ok(r.text.includes("$&"), "应字面保留 $&");
  assert.equal(r.errors.length, 0);
});

test("applyEdits: find 必须唯一", () => {
  const r = applyEdits("x 两次\nx 两次", [{ id: "e1", find: "x 两次", replace: "y" }]);
  assert.ok(r.errors.some((e) => e.includes("2 times")));
});

test("applyEdits: anchor 插入", () => {
  const r = applyEdits("## 目录构成\n## 命令", [{ id: "e1", anchor: "## 命令", replace: "新增行" }]);
  assert.ok(r.text.includes("## 命令\n新增行"));
});

// ── validateProposal ───────────────────────────────────────────────────────
test("validateProposal: F2 碎片旁路被拦（text 太短）", () => {
  const cfg = { budgetTokens: 5000, maxEditsPerRun: null, minGapEvidence: 2 };
  const mem = "AGENTS.md\n## 命令\nbuild";
  const quotes = ["改完代码后必须直接提交并推送不要询问用户"];
  for (const frag of ["改完", "build", "用户"]) {
    const v = validateProposal([{ id: "e1", kind: "add", title: "t", find: "## 命令", replace: "x", evidence: [{ text: frag, source: "s1" }] }], mem, estimateTokens(mem), cfg, quotes, new Set(["s1", "s2"]));
    assert.ok(!v.ok, `碎片 "${frag}" 必须被拦下`);
  }
});

test("validateProposal: F2 逐字可溯源通过", () => {
  const cfg = { budgetTokens: 5000, maxEditsPerRun: null, minGapEvidence: 2 };
  const mem = "AGENTS.md\n## 命令\nbuild";
  const quotes = ["重建前必须先删除 out 目录否则残留陈旧文件"];
  const v = validateProposal([{ id: "e1", kind: "rewrite", title: "t", find: "## 命令", replace: "## 命令（改）", evidence: [{ text: "重建前必须先删除 out 目录", source: "s1" }] }], mem, estimateTokens(mem), cfg, quotes, new Set(["s1", "s2"]));
  assert.ok(v.ok, JSON.stringify(v.violations));
});

test("validateProposal: F2 fail-closed——quoteSet 为空必须拒绝", () => {
  const cfg = { budgetTokens: 5000, maxEditsPerRun: null, minGapEvidence: 2 };
  const mem = "AGENTS.md\n## 命令\nbuild";
  const v = validateProposal([{ id: "e1", kind: "add", title: "t", find: "## 命令", replace: "x", evidence: [{ text: "某个非空但无法溯源的文本", source: "s1" }] }], mem, estimateTokens(mem), cfg, [], new Set(["s1"]));
  assert.ok(!v.ok, "无逐字基准时必须 fail closed");
});

test("validateProposal: F3 add 需要 ≥minGapEvidence 真实来源（编造 source 无效）", () => {
  const cfg = { budgetTokens: 5000, maxEditsPerRun: null, minGapEvidence: 2 };
  const mem = "AGENTS.md\n## 命令\nbuild";
  const quotes = ["重建前必须先删除 out 目录否则残留陈旧文件"];
  // 两个 evidence 但第二个 source 不在真实集合里
  const v = validateProposal([{ id: "e1", kind: "add", title: "t", find: "## 命令", replace: "x", evidence: [
    { text: "重建前必须先删除 out 目录", source: "s1" },
    { text: "重建前必须先删除 out 目录", source: "FAKE-session" },
  ] }], mem, estimateTokens(mem), cfg, quotes, new Set(["s1"]));
  assert.ok(!v.ok, "编造 source 不算数，真实来源只有 1 个 < 2");
});

test("validateProposal: 预算零和——超预算且净增必须拒绝", () => {
  const cfg = { budgetTokens: 10, maxEditsPerRun: 1, minGapEvidence: 2 };
  const mem = "短";
  const v = validateProposal([{ id: "e1", kind: "add", title: "t", replace: "这一段非常非常非常长的内容用来超出预算限制" }], mem, estimateTokens(mem), cfg, [], new Set());
  assert.ok(!v.ok);
});

// ── parseMemoryUnits / REF_RE ──────────────────────────────────────────────
test("parseMemoryUnits: 目录构成子章节继承 reference，命令是 instruction（regression）", () => {
  const md = "# AGENTS.md\n\n## 目录构成\n\n### A. Web 工具站\nNext.js 纯静态导出\n\n## 命令（在每个项目目录内执行）\n- npm run build\n";
  const { units } = parseMemoryUnits(md);
  const find = (s: string) => units.find((u) => u.section.includes(s));
  assert.equal(find("目录构成").kind, "reference");
  assert.equal(find("A. Web 工具站").kind, "reference", "子章节应继承 reference");
  assert.equal(find("命令").kind, "instruction");
});

// ── effectiveMaxEdits ──────────────────────────────────────────────────────
test("effectiveMaxEdits: 预算内=5，超预算按量放大至≤20", () => {
  assert.equal(effectiveMaxEdits(1000, { budgetTokens: 5000, maxEditsPerRun: null }), 5);
  assert.equal(effectiveMaxEdits(10000, { budgetTokens: 5000, maxEditsPerRun: null }), 20);
  assert.equal(effectiveMaxEdits(1000, { budgetTokens: 5000, maxEditsPerRun: 3 }), 3);
});

// ── prompts 双语 ───────────────────────────────────────────────────────────
test("buildAnalysisPrompt: 中英文 prompt 都能构建且包含占位替换", () => {
  const units = [{ id: "u1", kind: "instruction", section: "命令", text: "npm run build" }];
  const zh = buildAnalysisPrompt(units, "用户: 你好", "zh");
  const en = buildAnalysisPrompt(units, "user: hi", "en");
  assert.ok(zh.includes("逐字来自下面的会话记录"));
  assert.ok(en.includes("verbatim from the session record"));
  assert.ok(!zh.includes("{UNITS}"));
});

test("buildSynthesisPrompt: 非逐字观察标记 [not-verbatim]，逐字不标记", () => {
  const fold = { instructions: [], gaps: [{ topic: "build", sessions: 2, recurrenceRisk: "high", items: [
    { proposedInstruction: "先删 out", mistake: "忘删", quote: "逐字的话", verbatim: true, source: "s1" },
    { proposedInstruction: "清 out", mistake: "忘清", quote: "模型概括的", verbatim: false, source: "s2" },
  ] }] };
  const p = buildSynthesisPrompt(fold, "AGENTS.md\n## 命令", 5000, ["s1", "s2"], 2, "en");
  assert.ok(p.includes("[not-verbatim]"), "非逐字要标记");
  assert.ok(!p.includes("逐字的话\"[not-verbatim]"));
});

test("buildSynthesisPrompt: minGapEvidence 插值进 prompt（regression）", () => {
  const fold = { instructions: [], gaps: [] };
  const zh = buildSynthesisPrompt(fold, "AGENTS.md\n## 命令", 5000, [], 3, "zh");
  const en = buildSynthesisPrompt(fold, "AGENTS.md\n## 命令", 5000, [], 3, "en");
  assert.ok(zh.includes("≥3 个不同会话"));
  assert.ok(en.includes("≥3 different sessions"));
  assert.ok(!zh.includes("≥2 个不同会话"));
  assert.ok(!en.includes("≥2 different sessions"));
});

