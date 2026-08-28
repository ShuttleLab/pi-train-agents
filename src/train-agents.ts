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
import {
  DEFAULT_CONFIG, GAP_SIMILARITY_THRESHOLD, VALID_EFFORTS, type Lang,
  estimateTokens, parseSince, fingerprint, parseMemoryUnits, similarity, foldEvidence,
  effectiveMaxEdits, applyEdits, budgetStatus, validateProposal, buildAnalysisPrompt, buildSynthesisPrompt,
  distillSession, extractJson, isVerbatim, resolveLang, setLang, getLang, detectLang, t,
} from "./core.ts";

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
    emit(ctx, `# ${t("propTitle")}\n${msg}`);
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
