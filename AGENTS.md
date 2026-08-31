# pi-train-agents

## What this is

A native [Pi](https://github.com/earendil-works/pi-coding-agent) extension that treats a project's memory file (`AGENTS.md`) as a size-budgeted model and "trains" it with gradient descent on the Pi sessions that actually ran in this repo. Inspired by [backpass](https://github.com/kunchenguid/backpass). It is **evidence-backed and human-gated**: `AGENTS.md` is only written after per-edit confirmation in `/train-agents review`, never automatically.

It is a standalone developer tool (MIT). It is **not** a ShuttleLab product — it manages the memory files of any project you point it at.

## Commands

Two install modes — pick per purpose:

**As a package (end users, `pi install`):**
- `pi install npm:pi-train-agents` — add to settings, auto-load `dist/train-agents.ts` via the `pi` manifest.
- `pi remove npm:pi-train-agents` — uninstall. `pi update` — update an installed package.

**As a dev checkout (this repo):**
- `npm run build` — bundle `src/` into a self-contained `dist/train-agents.ts` (syntax self-check). **Run this after every `src/` change.**
- `npm run test` — pure-function regression tests (`node --test` on `tests/*.test.ts`, 23 cases).
- `npm run deploy` — copy `dist/` to `~/.pi/agent/extensions/` (for a **non-packaged** manual install only). If you installed via **`pi install npm:pi-train-agents`**, do **not** run `deploy` — it would add a duplicate local copy and pi would load two `/train-agents` commands (`:1`/`:2`). If your install is a **symlink** to `dist/`, `build` alone is enough and `deploy` would replace the symlink with a copy. Prefer `pi update npm:pi-train-agents` to refresh an installed package.

**In Pi:** `/train-agents` (one-shot full pass), `/train-agents analyze|propose|review|status`; after a fresh `npm run build`, `/reload` hot-reloads instead of restarting pi.

## Architecture

```
tier1 per-session evidence (modelRegistry.complete + reasoningOpts by provider api)
  → deterministic distillation (redact secrets + head/tail truncate + verbatim check)
  → evidence records (with verbatim flag)

deterministic aggregation (topic grouping + required mistake; NO similarity gate)
  → candidate buckets (each observation: rule/mistake/quote/verbatim/source/sessionId)
  → minGapEvidence prefilter (buckets touched by ≥minGapEvidence sessions go to tier2)

tier2 proposal synthesis (strong model)
  → per-observation rendering; non-verbatim quotes marked [not-verbatim]
  → only add a rule when observations truly show the same problem in ≥minGapEvidence sessions

mechanical gates (validateProposal)
  → F2 traceability: evidence.text must be a verbatim quote substring ≥12 chars; empty benchmark → fail closed
  → F3 batch: add needs ≥minGapEvidence real sources (realSources.has filter)
  → adaptive max-edits + budget fit + unique find/anchor + kind/title

human review (/train-agents review) — the only write path
  → per-edit diff + evidence; re-read + re-hash before write; timestamped backup; rejection memory
```

## i18n (critical for every UI/prompt change)

- All user-facing strings **and** the analysis/synthesis prompts are bilingual (`zh` / `en`) in `src/core.ts`.
- **Any new string must be added to BOTH `MSGS.zh` and `MSGS.en` and to the `MsgKey` type** — a missing language key silently falls back to English.
- UI language: config `language` = `"zh"` | `"en"` | `"auto"` (default `auto` → detected from `LANG` env, fallback `en`). Command description is resolved at registration via `resolveLang(loadConfig())`.
- Prompts are per-lang templates (`ANALYSIS_PROMPT` / `SYNTHESIS_PROMPT`) with `{PLACEHOLDER}` interpolation (including `minGapEvidence`).

## Layout

- `src/core.ts` — pure logic + i18n + prompts. No pi imports (unit-testable with plain node).
- `src/train-agents.ts` — the pi extension: Footer, `callModel`, command runners, entry.
- `scripts/build.mjs` — bundle `core.ts` + `train-agents.ts` into `dist/` (string-locating, not regex; dedups node:fs imports; ends with `--check`).
- `scripts/install.mjs` — copy build to `~/.pi/agent/extensions/`.
- `tests/core.test.ts` — 23 regression cases (every bug found across reviews is pinned here).
- `dist/` — the committed, self-contained build. `README.md` (en) / `README.zh.md`.

## Data files (user-level, never in the repo)

`~/.pi/agent/train-agents/<cwd-hash>.{state,proposal,rejections}.json` — analyzed-session cache, evidence, gap ledger, latest proposal, rejection memory. Stale evidence is auto-invalidated when the target `AGENTS.md` changes.

## Safety red lines

- **Never auto-write the target `AGENTS.md`.** Only `/train-agents review` writes, per-edit, after explicit confirm.
- **Evidence must be verbatim-traceable.** Non-verbatim quotes are flagged (`⚠未逐字`) and cannot be used as evidence; empty benchmark → proposal rejected (fail closed).
- **The two-session rule is enforced twice**: deterministic prefilter (`minGapEvidence`) AND tier2's prompt judgment (`≥minGapEvidence`). Keep both in sync.
- Session content is sent to the configured model provider — redact secrets, and only point `analysis.model` / `synthesis.model` at endpoints you trust.

## Known limitations

- Fully rephrased Chinese paraphrase gaps cannot be auto-clustered by string similarity; a topic bucket may mix different problems (e.g. "before deploy" but one is build, one is backup) — resolved by tier2 judgment + human review.
- Only Pi sessions are read (not Claude Code / opencode / codex). No cross-tool use.
- No ESC interrupt during long runs with `jobs` concurrency.
