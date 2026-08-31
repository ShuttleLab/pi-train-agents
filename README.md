# train-agents — Pi-native "AGENTS.md training system" extension

**English** · [中文](./README.zh.md)

[![npm version](https://img.shields.io/npm/v/pi-train-agents)](https://www.npmjs.com/package/pi-train-agents)
[![pi package](https://img.shields.io/badge/pi-package-2ea7a7)](https://pi.dev/packages/pi-train-agents)
[![license](https://img.shields.io/npm/l/pi-train-agents)](./LICENSE)

> Treat your project-level `AGENTS.md` as a size-budgeted model, and train it on the Pi sessions that actually ran in the project — a "backward pass" done right: evidence first, batch before update, small steps, a budget, and a human gate as the only write path.


---

## Highlights

- **Native Pi extension**: a single `.ts` file, drop it into `~/.pi/agent/extensions/`
- **Two-tier models**: cheap evidence analysis (tier1) + strong proposal synthesis (tier2)
- **Budget guardrail**: UTF-8 bytes/4 estimate, 5000 tok default cap, zero-sum above it
- **Batch verification**: a problem must appear in ≥2 independent sessions (`minGapEvidence=2`)
- **Mechanical gates**: adaptive max-edits, verbatim-evidence traceability (F2), real-source requirement for adds (F3), unique find/anchor
- **Human review is the only write path**: `/train-agents review` per-edit confirmation; never auto-writes
- **Safety**: version-freshness check + timestamped backup (5 kept) before writing + secret redaction
- **i18n**: display language auto-detected from `LANG` env, or force `"zh"` / `"en"` in config

## ⚠️ Privacy notice

This tool sends **the content of your Pi sessions in the project** (your prompts, assistant replies, bash commands) to the model provider you configured (by default, your current session model) for evidence analysis. Built-in redaction (AWS keys / `sk-` / `Bearer` / private keys, etc.) is applied, but **redaction is not a substitute for disclosure**: make sure your provider is allowed to process this data, or point `analysis.model` / `synthesis.model` at an endpoint you trust.

---

## Install

```bash
# Prerequisite: pi installed (@earendil-works/pi-coding-agent)
# Recommended: install from npm
pi install npm:pi-train-agents

# Alternatives:
pi install git:github.com/ShuttleLab/pi-train-agents   # from GitHub
pi install https://github.com/ShuttleLab/pi-train-agents
```

> `pi install` adds the package to your settings and auto-loads `dist/train-agents.ts` (declared via the `pi` manifest in `package.json`). The first run auto-creates `~/.pi/agent/train-agents/config.json` with defaults.

### Install & manage

| Operation | Command |
|---|---|
| Install | `pi install npm:pi-train-agents` |
| Uninstall | `pi remove npm:pi-train-agents` |
| Update | `pi update` |
| Pin a version | `pi install npm:pi-train-agents@0.1.1` |

---

## Usage

### Commands

| Command | What it does |
|---|---|
| `/train-agents` | **One-shot full pass**: silent evidence collection + proposal, outputs only the proposal (never writes) |
| `/train-agents analyze` | Evidence only: summary of followed/violated rules and candidate buckets |
| `/train-agents propose` | Synthesis only: build edits from already-collected evidence |
| `/train-agents review` | **The only human write path**: per-edit diff + evidence, accept/reject, accepted ones are written to AGENTS.md |
| `/train-agents status` | Status + config reference + how to edit |

### Typical workflow

```bash
1. After a working session, run: /train-agents
   → Auto evidence + proposal. Not enough evidence (single session)? "no proposal".
   → After ≥2 sessions: a proposal edit list appears.

2. Review: /train-agents review
   → Per-edit diff + evidence text; accept/reject.
   → Accepted edits are written; rejected ones are remembered (not re-proposed).

3. Check: /train-agents status
   → Budget bar, analyzed sessions, evidence records, gap ledger.
```

---

## Configuration

Edit `~/.pi/agent/train-agents/config.json`:

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

| Key | Default | Meaning |
|---|---|---|
| `language` | `"auto"` | UI language: `"zh"` / `"en"` / `"auto"` (detected from `LANG` env) |
| `budgetTokens` | `5000` | Budget cap (tokens), bytes/4 estimate |
| `maxEditsPerRun` | `null` (adaptive) | Max edits per run. null = adaptive (5 within budget, scaled up to ≤20 for shrink plans) |
| `minGapEvidence` | `2` | New rules need ≥2 independent sessions of evidence |
| `since` | `"30d"` | Training window: only sessions from the last N days |
| `gapLedgerMaxAge` | `"90d"` | Cross-run gap accumulation lifetime |
| `maxTranscripts` | `100` | Max sessions analyzed per run (newest-first sampling beyond) |
| `minUserTurns` | `2` | Skip trivial sessions with <2 user turns |
| `jobs` | `4` | Parallel evidence-analysis workers |
| `analysis.model` | `null` (current) | Evidence-tier model |
| `synthesis.model` | `null` (current) | Proposal-tier model |
| `analysis.effort` | `"medium"` | Evidence-tier reasoning (none/minimal/low/medium/high/xhigh/max). Note: only effective when the model supports effort tiers (e.g. has `supportsReasoningEffort`); otherwise differentiate the two tiers via `analysis.model`/`synthesis.model` |
| `synthesis.effort` | `"high"` | Proposal-tier reasoning (same note as above) |
| `memoryFiles` | `["AGENTS.md"]` | Memory file to maintain |
| `skillsDir` | `".agents/skills"` | Skill extraction target |

---

## Architecture

```
tier1 per-session evidence (complete + reasoningOpts dispatched by provider api)
  → deterministic distillation (redaction + head/tail truncation + verbatim check)
  → evidence records (with verbatim flag)

deterministic aggregation (topic grouping + required mistake; no similarity gate)
  → candidate buckets (each observation: rule/mistake/quote/verbatim/source/sessionId)
  → minGapEvidence prefilter (buckets touched by ≥2 sessions go to tier2)

tier2 proposal synthesis (complete + reasoningOpts, strong model)
  → per-observation rendering; non-verbatim quotes marked [not-verbatim]
  → only add a rule when observations truly show the same problem in ≥2 sessions (otherwise do not add)
  → evidence.source must be a real whitelisted session id

mechanical gates (validateProposal)
  → F2 traceability: evidence.text must be a verbatim quote substring ≥12 chars; empty benchmark → fail closed
  → F3 batch: add needs ≥minGapEvidence real sources (realSources.has filter)
  → adaptive max-edits + budget fit + unique find/anchor + kind/title checks

human review (review)
  → dialog shows find/replace + evidence text/source
  → re-read + re-hash before write (TOCTOU protection)
  → timestamped backup to DATA_DIR (last 5 kept)
  → rejection memory (persisted; not re-proposed without new evidence)
```

---

## Known limitations

- **A topic bucket can mix different problems**: deterministic clustering only groups by topic + requires a mistake; there is no similarity gate. One bucket may contain different problems (e.g. both "before deploy", but one is build and one is backup) — distinguished by tier2 semantic judgment + human review.
- **`add` depends entirely on tier2's judgment**: the deterministic layer does no semantic filtering; the two-session rule is enforced by F3 at the edit level (an add's evidence must come from ≥minGapEvidence real session sources). Adds may not be produced — write them by hand when needed. This tool primarily produces rewrite/remove.
- **Pi sessions only**: it does not read Claude Code / opencode / codex session stores.
- **ESC interrupt**: stopping mid-run with `jobs` concurrency requires Ctrl+C on the whole pi; graceful abort needs a custom modal UI (polish item).

---

## Tests & contributing

```bash
cd pi-train-agents
node --experimental-strip-types --test tests/*.test.ts
```

22 regression cases cover: similarity, clustering (incl. the S1-three + S2-one topic-bucket case), applyEdits (`$&` expansion, find uniqueness, anchor insertion), validateProposal (fragment bypass, fail-closed, real sources, budget zero-sum), parseMemoryUnits (section inheritance), verbatim propagation, and bilingual prompts.

**Run `npm run build` after editing `src/`**, or `dist/` will be out of sync with the source (the build ends with a syntax self-check).

---

## License

MIT License. This project is inspired by [backpass](https://github.com/kunchenguid/backpass) (MIT).