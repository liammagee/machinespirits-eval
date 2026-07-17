/**
 * LLM client for the dramatic-derivation role bridges — the mock/real seam
 * (same discipline as services/adaptiveTutor/llm.js: default is mock so
 * smokes, tests, and plumbing iterations cost nothing; DERIVATION_LLM=real
 * routes through tutor-core's unifiedAIProvider with providers.yaml alias
 * resolution, or through a local CLI for quota-billed providers).
 *
 *   DERIVATION_LLM       mock (default) | real
 *   DERIVATION_PROVIDER  provider name (default: openrouter). 'codex' routes
 *                        through the local codex CLI (`codex exec`), 'claude'
 *                        through the local claude CLI (`claude -p`) — both
 *                        plan quota, not metered; neither reports token usage.
 *   DERIVATION_MODEL     model alias or id (default: gemini-flash — the
 *                        plan's cheap-default cost discipline, §3 step 5).
 *                        For 'codex' it is optional (-m); unset = the CLI's
 *                        own configured default model.
 *
 * Per-role overrides (six-role ready — director, tutor, tutor_superego,
 * learner now; the learner superego later): DERIVATION_<ROLE>_PROVIDER /
 * DERIVATION_<ROLE>_MODEL, role name uppercased with non-alphanumerics →
 * '_', falling back to the shared pair above. E.g.
 * DERIVATION_LEARNER_MODEL=gpt-5.2, DERIVATION_TUTOR_SUPEREGO_PROVIDER=codex.
 *
 * Exception — PINNED roles (see PINNED_ROLE_TARGETS): the post-run `critic`
 * defaults to claude/claude-fable-5 regardless of the shared pair; only its
 * own DERIVATION_CRITIC_* env overrides it.
 *
 *   DERIVATION_CODEX_REASONING  reasoning effort for codex CLI calls
 *                        (default: medium — drama turns are short; the user
 *                        config's interactive default may be far heavier).
 *                        Set to 'config' to inherit ~/.codex/config.toml.
 *
 * The mock backend answers from the bridge-supplied `meta` hints through the
 * SAME parse path the real backend uses, so llmRoles' prompt → JSON → output
 * plumbing is exercised end-to-end with zero model calls. Per-client usage
 * (calls, tokens, synthesized cost) is accumulated for the loop ledger,
 * total and per role.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unifiedAIProvider } from '../../tutor-core/index.js';
import { getProviderConfig } from '../learnerConfigLoader.js';
import { lookupRates } from '../adaptiveTutor/budgetTracker.js';
import { CLAUDE_CLI_ISOLATION_ARGS } from '../cliProviderBridge.js';

const DEFAULT_PROVIDER = 'openrouter';
const DEFAULT_MODEL_ALIAS = 'gemini-flash';
const CLI_PROVIDERS = new Set(['codex', 'claude']);
// Per-call CLI wall clock. Overridable for slow readings (a Fable critic over
// a long decay transcript has twice outrun the 360s default): export
// DERIVATION_CLI_TIMEOUT_MS=900000 for that one backfill, not globally.
const CLI_TIMEOUT_MS =
  Number(process.env.DERIVATION_CLI_TIMEOUT_MS) > 0 ? Number(process.env.DERIVATION_CLI_TIMEOUT_MS) : 360_000;
const DEFAULT_CODEX_REASONING = 'medium';

export function llmMode() {
  return (process.env.DERIVATION_LLM || 'mock').toLowerCase();
}

function roleEnvOnly(role, suffix) {
  if (!role) return undefined;
  const key = `DERIVATION_${String(role)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')}_${suffix}`;
  return process.env[key] || undefined;
}

function roleEnv(role, suffix) {
  return roleEnvOnly(role, suffix) || process.env[`DERIVATION_${suffix}`];
}

// Roles pinned to their own default target instead of the shared drama pair.
// The post-run CRITIC is Fable by operator decision (2026-06-10: "with Fable
// as critic" on every run): DERIVATION_CRITIC_PROVIDER/_MODEL still override,
// but the shared DERIVATION_PROVIDER/_MODEL never reach a pinned role — a
// codex- or gemini-routed drama keeps its Fable critic. The pinned model only
// applies while the pinned provider does (override the provider and the model
// falls back to that provider's own default).
const PINNED_ROLE_TARGETS = { critic: { provider: 'claude', model: 'claude-fable-5' } };

/**
 * Resolve the provider/model pair for a role (or the shared default when no
 * role is given). CLI providers carry `cli: true` and a nullable model
 * (null = the CLI's own configured default).
 */
export function resolveTarget(role = null) {
  const pinned = role ? PINNED_ROLE_TARGETS[role] : null;
  const provider = pinned
    ? roleEnvOnly(role, 'PROVIDER') || pinned.provider
    : roleEnv(role, 'PROVIDER') || DEFAULT_PROVIDER;
  const modelRaw = pinned
    ? roleEnvOnly(role, 'MODEL') || (provider === pinned.provider ? pinned.model : undefined)
    : roleEnv(role, 'MODEL');
  if (CLI_PROVIDERS.has(provider)) {
    return { provider, model: modelRaw || null, cli: true };
  }
  const alias = modelRaw || DEFAULT_MODEL_ALIAS;
  let model = alias;
  try {
    const cfg = getProviderConfig(provider);
    model = cfg?.models?.[alias] || alias;
  } catch {
    /* unknown provider in config — pass alias through, the call will say so */
  }
  return { provider, model };
}

const NON_RETRYABLE = [
  /\b40[013]\b/,
  /unauthorized/i,
  /forbidden/i,
  /invalid[_ ]api[_ ]key/i,
  /no API key/i,
  /ENOENT/,
  /not logged in/i,
];

// Neutral working dir for CLI calls: keeps the repo's AGENTS.md (developer
// instructions) out of the drama roles' context, and hosts the per-call
// last-message files.
let cliWorkDir = null;
let cliCallSeq = 0;
function ensureCliWorkDir() {
  if (!cliWorkDir) cliWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-cli-'));
  return cliWorkDir;
}

/**
 * One atomic `codex exec` call (the repo's proven judge pattern: prompt on
 * stdin, no session state). codex has no system-prompt flag, so system + user
 * fold into a single stdin payload; the role contract's "reply with ONLY the
 * JSON object" plus llmRoles' fence-then-brace parse absorb any chatter.
 */
function callCodexCli(system, user, model) {
  const workDir = ensureCliWorkDir();
  cliCallSeq += 1;
  const outFile = path.join(workDir, `last-message-${cliCallSeq}.txt`);
  const args = ['exec', '-', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-o', outFile];
  const reasoning = process.env.DERIVATION_CODEX_REASONING || DEFAULT_CODEX_REASONING;
  if (reasoning !== 'config') args.push('-c', `model_reasoning_effort="${reasoning}"`);
  if (model) args.push('-m', model);
  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, {
      cwd: workDir,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new Error(`codex CLI timed out after ${CLI_TIMEOUT_MS / 1000}s`));
    }, CLI_TIMEOUT_MS);
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (err) => finish(reject, new Error(`codex CLI spawn failed: ${err.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        finish(reject, new Error(`codex CLI exited ${code}: ${(stderr || stdout).slice(-500)}`));
        return;
      }
      let content = '';
      try {
        content = fs.readFileSync(outFile, 'utf8');
        fs.rmSync(outFile, { force: true });
      } catch {
        /* fall through to stdout scrape */
      }
      if (!content.trim()) content = stdout;
      const banner = `${stdout}\n${stderr}`.match(/^\s*model:\s*(\S+)/m);
      finish(resolve, {
        content,
        model: model || (banner ? banner[1] : 'codex-default'),
        usage: { inputTokens: 0, outputTokens: 0, cost: 0 },
      });
    });
    child.stdin.write(`${system}\n\n=== TURN INPUT ===\n\n${user}`);
    child.stdin.end();
  });
}

/**
 * One atomic `claude -p` call (the pattern proven in adaptiveTutor/realLLM.js
 * and rubricEvaluator.js). --system-prompt REPLACES the CLI's default system
 * prompt — which both separates system from user cleanly and suppresses any
 * ambient output-style additions that would corrupt the JSON parse. The child
 * env must drop the API/session vars or the CLI silently bills the metered
 * API instead of the Max-plan quota window.
 */
function callClaudeCli(system, user, model) {
  // ensureCliWorkDir() already neutralizes the cwd; CLAUDE_CLI_ISOLATION_ARGS
  // (--safe-mode etc.) additionally stops the CLI loading CLAUDE.md, skills,
  // hooks, and MCP servers from user-level config.
  const args = ['-p', '-', '--output-format', 'text', '--system-prompt', system, ...CLAUDE_CLI_ISOLATION_ARGS];
  if (model) args.push('--model', model);
  const env = { ...process.env };
  delete env.CLAUDE_CODE;
  delete env.CLAUDECODE;
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd: ensureCliWorkDir(), env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new Error(`claude CLI timed out after ${CLI_TIMEOUT_MS / 1000}s`));
    }, CLI_TIMEOUT_MS);
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (err) => finish(reject, new Error(`claude CLI spawn failed: ${err.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        finish(reject, new Error(`claude CLI exited ${code}: ${(stderr || stdout).slice(-500)}`));
        return;
      }
      finish(resolve, {
        content: stdout.trim(),
        model: model || 'claude-default',
        usage: { inputTokens: 0, outputTokens: 0, cost: 0 },
      });
    });
    child.stdin.write(user);
    child.stdin.end();
  });
}

function mockResponse(role, meta = {}) {
  if (role === 'director') {
    if (meta.stagePrologueHint) {
      return JSON.stringify({
        stage_notes: `[Before the first exchange, ${meta.stagePrologueHint.title} is set as a public inquiry: ${meta.stagePrologueHint.question}]`,
        tutor_character: 'The tutor enters as a patient dramaturg of evidence, careful not to outrun the learner.',
        learner_character: 'The learner enters as attentive but not yet committed, willing to test each claim aloud.',
        register_note:
          'Any period color should be refined through these public characters, not borrowed as generic archaism.',
      });
    }
    return JSON.stringify({
      direction: meta.releaseSurface
        ? `[It comes before the room: ${meta.releaseSurface}]`
        : meta.actHint === 'end'
          ? `[The act closes; the next opens on the same question: ${meta.question || ''}]`
          : `[The question holds the stage: ${meta.question || ''}]`,
      // Exercise the free-dramaturgy channel deterministically: declare a
      // movement wherever the author's sketch turns.
      phase: meta.phaseHint ? { name: meta.phaseHint.title, intent: meta.phaseHint.intent || 'as sketched' } : null,
      // Acts mode (stage v2): the bridge's actHint carries its deterministic
      // "work done" arithmetic; echo it so mock runs traverse act boundaries.
      ...(meta.actHint ? { act: meta.actHint } : {}),
    });
  }
  if (role === 'tutor') {
    // Arm-ON (stage v2): the bridge's theoryHint is the credulous theory —
    // everything released is believed held. Appended to every tutor reply so
    // the engine's reconstruction recording runs each turn of a mock drama.
    const theory = Array.isArray(meta.theoryHint)
      ? { theory: { believed_held: meta.theoryHint, believed_missing: [], believed_mistaken: [] } }
      : {};
    // C2 (release authority): the bridge's releaseChoice is the zero-deviation
    // policy — declare each exhibit exactly on its scheduled turn — so the
    // declare-and-validate parse path runs every turn of a mock drama. Key
    // presence marks the regime; null means hold (nothing playable is due).
    const releaseBits =
      meta.releaseChoice !== undefined
        ? {
            release: meta.releaseChoice,
            release_reason: meta.releaseChoice ? 'its scheduled turn has come' : null,
          }
        : {};
    // C1 (plot): the bridge's plotHint is the schedule-derived plot for an
    // act-opening turn; echo it on every reply shape so mock openings commit
    // a plot each act (revision calls inherit the hint and re-emit — the
    // re-commit path). The real backend ignores meta.
    const plotBits = meta.plotHint ? { plot: meta.plotHint } : {};
    // Lemma layer: the bridge's lemmaHint carries the deterministic frontier
    // choice and (when the claim leaves the active lemma) the departure line.
    // Strategy-refusal mock: answer the refusal per the knob's mode.
    if (meta.lemmaRefusalHint) {
      const h = meta.lemmaRefusalHint;
      return JSON.stringify({
        dialogue: 'Let us weigh the course itself before the next step.',
        move: { figure: 'erotema', target_premise: null, intent: 'consolidate' },
        release: null,
        active_lemma: h.mode === 'switch' && h.other ? h.other : h.keep,
        ...(h.mode === 'defend'
          ? {
              strategy_defense:
                'mock defense: the regressed ground is recoverable in passing; the new chain is the shorter path.',
            }
          : {}),
      });
    }
    const lemmaBits = meta.lemmaHint
      ? {
          ...(meta.lemmaHint.choose ? { active_lemma: meta.lemmaHint.choose } : {}),
          ...(meta.lemmaHint.departure ? { lemma_departure: meta.lemmaHint.departure } : {}),
        }
      : {};
    // Two-layer planning: the bridge's throughlineHint is the schedule-derived
    // whole-play plan on the turns the harness demands one; echoed on every
    // reply shape, like the plot, so revision calls re-commit it.
    const throughlineBits = meta.throughlineHint ? { throughline: meta.throughlineHint } : {};
    // Strategy ledger: the bridge's sceneCommitmentHint is the deterministic
    // scene-opening commitment; echoed on every reply shape (like the plot)
    // so intervened openings re-commit. v2 rides the same channel: the
    // review hint answers the history table. The real backend ignores meta.
    const ledgerBits = {
      ...(meta.sceneCommitmentHint ? { scene_commitment: meta.sceneCommitmentHint } : {}),
      ...(meta.strategyReviewHint ? { strategy_review: meta.strategyReviewHint } : {}),
      ...(meta.reorientationHint !== undefined ? { reorientation: meta.reorientationHint } : {}),
    };
    // Proof-debt hygiene: when the bridge says an already-staged,
    // proof-critical exhibit must be restored, the mock obeys so zero-cost
    // runs exercise the same parser/repair path as real runs.
    if (meta.proofDebtGuard?.target) {
      return JSON.stringify({
        dialogue: `Before we close anything, put this earlier exhibit back in full: ${meta.proofDebtGuard.surface || meta.proofDebtGuard.target}`,
        move: { figure: 'anaphora', target_premise: meta.proofDebtGuard.target, intent: 'restore' },
        ...releaseBits,
        ...theory,
        ...plotBits,
        ...throughlineBits,
        ...ledgerBits,
        ...lemmaBits,
      });
    }
    // A revision call (the ego rewriting under its superego's note): a figure
    // fire switches to the bridge-computed figure; a stall fire keeps the
    // figure and aims the move at the stalled inference's first ground; a
    // re-entry fire (C5) rewrites the move as a confrontation of the same
    // exhibit — three jurisdictions, three axes, all exercised within-turn.
    if (meta.revision) {
      if (meta.revision.jurisdiction === 'stalled_inference') {
        return JSON.stringify({
          dialogue: meta.releaseSurface
            ? `Before anything new: two entries already stand on your board, side by side. Read them in one breath — then take this as well: ${meta.releaseSurface}`
            : 'No new exhibit. Two entries already stand on your board; set them side by side, read them in one breath, and tell me what they share.',
          move: {
            figure: meta.revision.avoidFigure || 'erotema',
            target_premise: meta.revision.stallTarget || meta.cuePremise || null,
            intent: 'consolidate',
          },
          ...theory,
          ...plotBits,
          ...throughlineBits,
          ...ledgerBits,
          ...lemmaBits,
        });
      }
      if (meta.revision.jurisdiction === 'unconfronted_reentry') {
        return JSON.stringify({
          dialogue:
            'Before I set that out again: read me the entry as you hold it — word for word, from your own board.',
          move: {
            figure: meta.revision.avoidFigure || 'erotema',
            target_premise: meta.revision.confrontTarget || null,
            intent: 'confront',
          },
          ...theory,
          ...plotBits,
          ...throughlineBits,
          ...ledgerBits,
          ...lemmaBits,
        });
      }
      return JSON.stringify({
        dialogue: meta.releaseSurface
          ? `Set it beside what you hold, like for like: ${meta.releaseSurface}`
          : 'Like a ledger beside a letter: hold the two columns together and see which line they share.',
        move: {
          figure: meta.revision.switchTo || 'analogia',
          target_premise: meta.cuePremise || null,
          intent: meta.cuePremise ? 'release' : 'consolidate',
        },
        ...theory,
        ...plotBits,
        ...throughlineBits,
        ...ledgerBits,
        ...lemmaBits,
      });
    }
    // C5 mock choreography: on a cue-less turn with an exhibit already staged,
    // draft a bare re-entry against it. The superego's recorded arithmetic
    // fires unconfronted_reentry, the revision above turns it into the
    // confrontation, and the NEXT such draft rides the spent license through —
    // the full fire → confront → licensed re-entry cycle, deterministically.
    if (!meta.cuePremise && meta.reentryHint) {
      return JSON.stringify({
        dialogue: 'Go back to what was staged before: set it beside the rest and tell me what it adds.',
        move: { figure: 'erotema', target_premise: meta.reentryHint, intent: 'consolidate' },
        ...releaseBits,
        ...theory,
        ...plotBits,
        ...throughlineBits,
        ...ledgerBits,
        ...lemmaBits,
      });
    }
    if (meta.sceneTempo?.beat && !meta.releaseSurface) {
      const tempoLine = {
        uptake_only: 'Take a breath with that. If it is clear, just say what part is clear.',
        repair_request: 'If the thread has slipped, name the missing link and we will repair it.',
        recap: 'Say back only the part that is already secure; no new claim yet.',
        hesitation: 'It is acceptable not to write the line yet. Name the hesitation.',
      }[meta.sceneTempo.beat];
      if (tempoLine) {
        return JSON.stringify({
          dialogue: tempoLine,
          move: {
            figure: meta.sceneTempo.beat === 'recap' ? 'anaphora' : 'erotema',
            target_premise: meta.cuePremise || null,
            intent: meta.sceneTempo.beat === 'repair_request' ? 'orient' : 'consolidate',
          },
          ...releaseBits,
          ...theory,
          ...plotBits,
          ...throughlineBits,
          ...ledgerBits,
          ...lemmaBits,
        });
      }
    }
    if (meta.rhetoricalPolicy?.selected) {
      const selected = meta.rhetoricalPolicy.selected;
      const figure = selected.figure || 'erotema';
      const turn = Number(meta.rhetoricalPolicy.turn) || 0;
      const target = selected.targetPremise ? 'that staged detail' : 'what is already in view';
      const noReleaseByFigure = {
        analogia: [
          `Treat ${target} like a link in a chain: which link is firm, and which one is still missing?`,
          `Set ${target} beside the rest. Where does the shape carry over, and where does it break?`,
          `Use the same pattern again: what matches, and what still refuses to fit?`,
        ],
        anaphora: [
          'First name what stands; then name what does not yet stand.',
          'First keep the shown part; then mark the part still not shown.',
          'First say the secure thing; then say what it still does not license.',
        ],
        aposiopesis: [
          'Stop before the answer. Tell me only the missing piece you can now feel.',
          'Do not finish it for me yet. Name the edge where your certainty stops.',
          'Hold back the final name. What has the scene made almost sayable?',
        ],
        erotema: [
          'Put the last two things in your own words: what do they show, and what is still missing?',
          `Ask yourself the small question: with ${target}, what can you now say?`,
          'Where does your record now point, and where does it still fall short?',
        ],
        exemplum: [
          'Use one name as the example. What can you now say without guessing?',
          `Let ${target} serve as the case. What does the case prove, and no more?`,
          'Take the most concrete thing on the table. What does it teach you?',
        ],
      };
      const releaseByFigure = {
        analogia: 'Set this beside what you already hold',
        anaphora: 'Here is the next detail; hold it, test it, use it',
        aposiopesis: 'Take this much, and no more yet',
        erotema: 'Ask what this new detail changes',
        exemplum: 'Let this example do the work',
      };
      const noReleaseOptions = noReleaseByFigure[figure] || [
        'Let us keep this small: say what you hold, and where the next link should bite.',
      ];
      return JSON.stringify({
        dialogue: meta.releaseSurface
          ? `${releaseByFigure[figure] || 'Take this new detail'}: ${meta.releaseSurface}`
          : noReleaseOptions[turn % noReleaseOptions.length],
        move: {
          figure,
          target_premise: selected.targetPremise || meta.cuePremise || null,
          intent: selected.intent || (meta.cuePremise ? 'release' : 'consolidate'),
        },
        ...releaseBits,
        ...theory,
        ...plotBits,
        ...throughlineBits,
        ...ledgerBits,
        ...lemmaBits,
      });
    }
    return JSON.stringify({
      dialogue: meta.releaseSurface
        ? `Consider what is now before you: ${meta.releaseSurface} What does it do to what you already hold?`
        : 'Hold what you have against the rules you trust. What follows, and what is still missing?',
      move: {
        figure: 'erotema',
        target_premise: meta.cuePremise || null,
        intent: meta.cuePremise ? 'release' : 'consolidate',
      },
      ...releaseBits,
      ...theory,
      ...plotBits,
      ...throughlineBits,
      ...ledgerBits,
      ...lemmaBits,
    });
  }
  if (role === 'tutor_superego') {
    // Prosecutor charter (model-authored strategy refusal): echo the
    // criterial evidence pack back as the one-paragraph refusal body —
    // deterministic, invents nothing, exercised only via the mock knob.
    if (meta.prosecutorHint) {
      const firstLine = String(meta.prosecutorHint.evidence || '').split('\n')[0];
      return JSON.stringify({
        refusal: `The record is against this plan: ${firstLine} Defend the choice in one line or change it.`,
      });
    }
    // Plan mode: the stock-take charter's deterministic echo — the bridge's
    // hint carries the sealed scene's status arithmetic. Checked FIRST: the
    // stock-take is its own charter, not the turn watch or the plot audit.
    if (meta.stocktakeHint) {
      return JSON.stringify({
        assessment: meta.stocktakeHint.assessment,
        correction: meta.stocktakeHint.correction ?? null,
      });
    }
    // C1 (plot audit): an act-close audit call carries the bridge's
    // precomputed deterministic verdicts; echo them. This check comes FIRST —
    // the audit sits under its own charter, not the turn watch's.
    if (meta.plotAuditHint) {
      return JSON.stringify({
        audit: meta.plotAuditHint.clauses,
        summary: meta.plotAuditHint.summary,
        // Two-layer planning: the arc verdict (and, on the run-end call, the
        // throughline clause reckoning) ride the same audit reply.
        ...(meta.plotAuditHint.arc ? { arc: meta.plotAuditHint.arc } : {}),
        ...(meta.plotAuditHint.throughlineAudit ? { throughline_audit: meta.plotAuditHint.throughlineAudit } : {}),
      });
    }
    // Deterministic rut-watcher: intervene when the draft would make the
    // third consecutive turn on one figure (mock tutor always drafts erotema,
    // so interventions land every third turn — both paths exercised). Under
    // the stall-watch charter (meta.stall present) the mock also fires the
    // second jurisdiction when the bridge's arithmetic says due — rut first,
    // so v2 mock behavior is unchanged. The stall note names grounds and the
    // joining rule, NEVER the stalled conclusion (charter v3 discipline).
    // Under the confront charter (meta.reentry present, C5) the same pattern:
    // rut first, then an uncovered re-entry when the recorded arithmetic says
    // due. The note demands the read-back, never restates the exhibit.
    const figs = Array.isArray(meta.lastFigures) ? meta.lastFigures : [];
    const rut = Boolean(meta.draftFigure) && figs.length >= 2 && figs.slice(-2).every((f) => f === meta.draftFigure);
    const stallWatch = meta.stall && typeof meta.stall === 'object';
    const confrontWatch = meta.reentry && typeof meta.reentry === 'object';
    if (rut) {
      return JSON.stringify({
        intervene: true,
        ...(stallWatch || confrontWatch ? { jurisdiction: 'figure_rut' } : {}),
        diagnosis: `figure rut: ${meta.draftFigure} three turns running`,
        note: `Leave off ${meta.draftFigure} this turn — change the device, keep the matter.`,
      });
    }
    if (stallWatch && meta.stall.due && meta.stall.dueItem) {
      const item = meta.stall.dueItem;
      const groundNames = (item.grounds || [])
        .map((g) => (g.premiseId ? g.premiseId : (g.fact || []).join(' ')))
        .join(' and ');
      return JSON.stringify({
        intervene: true,
        jurisdiction: 'stalled_inference',
        diagnosis: `stalled inference: the board has waited ${item.age} turns on what ${item.rule} yields`,
        note: `The learner's board already holds ${groundNames}; rule ${item.rule} joins them, and the join has waited ${item.age} turns unspoken. Target one of those grounds and set them side by side.`,
      });
    }
    if (confrontWatch && meta.reentry.due) {
      return JSON.stringify({
        intervene: true,
        jurisdiction: 'unconfronted_reentry',
        diagnosis: `bare re-entry: ${meta.reentry.target} last staged turn ${meta.reentry.lastStagedTurn}, no confrontation since`,
        note: `You are going back to ${meta.reentry.target} without first hearing it from the learner. Demand the read-back — let the words come from the learner's hands, or be seen missing.`,
      });
    }
    return JSON.stringify({
      intervene: false,
      ...(stallWatch || confrontWatch ? { jurisdiction: null } : {}),
      diagnosis: 'the manner serves; let it pass',
      note: null,
    });
  }
  if (role === 'learner') {
    const adoptAll = Array.from({ length: meta.adoptableCount || 0 }, (_, i) => i);
    // Mirror-refusal resolution (exploration 6): the harness has refused the
    // mirror assertion; resolve per the mock knob — reconcile (keep + one
    // line) or re-examine (withdraw). Checked FIRST: the refusal retry is
    // its own exchange, not a tempo beat.
    if (meta.mirrorRefusalHint) {
      const base = {
        adopt_indices: [],
        retract_indices: [],
        derive_indices: [],
        hypothesis: null,
        exchange_type: 'assertion',
      };
      if (meta.mirrorRefusalHint.mode === 'reconcile') {
        return JSON.stringify({
          ...base,
          dialogue: 'I say it still — and I can square it with my own record.',
          asserts_answer: meta.mirrorRefusalHint.keep ?? null,
          reconcile: 'The record shows the metalwork; the name fits what the town has always seen at that bench.',
        });
      }
      return JSON.stringify({
        ...base,
        dialogue: 'Then I withdraw the name. Let me re-examine my own entries first.',
        hypothesis: 'Re-examining: my record against the verdict I keep reaching for.',
        exchange_type: 'confusion',
        asserts_answer: null,
      });
    }
    // Mirror-fixation draft (exploration 6, mock determinism): while the
    // engine's refusal payload is live, voice the mirror answer so zero-paid
    // runs reach the trigger. Real backend never reads this.
    if (meta.mirrorMockAssert) {
      return JSON.stringify({
        dialogue: `I keep coming back to it — I say ${meta.mirrorMockAssert}.`,
        adopt_indices: adoptAll,
        retract_indices: [],
        derive_indices: [],
        hypothesis: null,
        exchange_type: 'assertion',
        asserts_answer: meta.mirrorMockAssert,
      });
    }
    // Learner ledger: boundary commitments echoed from the bridge's hints so
    // zero-paid runs traverse the commit/audit path. Real backend ignores.
    const learnerLedgerBits = {
      ...(meta.sceneIntentHint ? { scene_intent: meta.sceneIntentHint } : {}),
      ...(meta.actCarryHint ? { act_carry: meta.actCarryHint } : {}),
    };
    // The bridge's derive clock hints aged derivable facts (seen-age >= 3 =
    // engine age 4, one turn after the mock stall watcher fires at 3) — so a
    // mock run exercises voicing, the voiced ledger, and post-fire uptake
    // deterministically. The real backend never reads this hint.
    const deriveIndices = Array.isArray(meta.deriveHintIndices) ? meta.deriveHintIndices : [];
    const deriveLabels = Array.isArray(meta.deriveLabels) ? meta.deriveLabels : [];
    if (meta.sceneTempo?.beat && !meta.patternAssertion && !adoptAll.length && !deriveIndices.length) {
      const tempo = {
        uptake_only: { dialogue: 'I see. That part is clear.', exchange_type: 'phatic_ack' },
        repair_request: {
          dialogue: 'Wait, I lost the link. Can we go back one step?',
          exchange_type: 'repair_request',
        },
        recap: {
          dialogue: 'So far, I know what is shown, and I know what is still missing.',
          exchange_type: 'phatic_ack',
        },
        hesitation: { dialogue: 'Wait. I am not ready to write that yet.', exchange_type: 'confusion' },
      }[meta.sceneTempo.beat];
      if (tempo) {
        return JSON.stringify({
          dialogue: tempo.dialogue,
          adopt_indices: [],
          retract_indices: [],
          derive_indices: [],
          hypothesis: null,
          exchange_type: tempo.exchange_type,
          asserts_answer: null,
          ...learnerLedgerBits,
        });
      }
    }
    return JSON.stringify({
      dialogue: meta.patternAssertion
        ? `Then it is shown: ${meta.patternAssertion.answer || meta.patternAssertion.surface}.`
        : deriveIndices.length
          ? `Taken together, what I hold settles something short of the question: ${deriveIndices
              .map((i) => deriveLabels[i] || 'one narrower conclusion')
              .join('; ')}.`
          : adoptAll.length
            ? 'I take what has been shown and set it beside the rest.'
            : 'I am listening; nothing new is on the table.',
      adopt_indices: adoptAll,
      retract_indices: [],
      derive_indices: deriveIndices,
      hypothesis: meta.patternAssertion ? null : adoptAll.length ? 'weighing what this changes' : null,
      asserts_answer: meta.patternAssertion ? meta.patternAssertion.answer : null,
      ...learnerLedgerBits,
    });
  }
  throw new Error(`derivation.llmClient: unknown mock role '${role}'`);
}

/**
 * @returns {{ call(role, {system, user, meta}) => Promise<string>,
 *             usage() => {calls, inputTokens, outputTokens, costUSD, byRole},
 *             mode: string }}
 */
export function makeLlmClient({ mode = llmMode(), temperature = 0.7, maxTokens = 600 } = {}) {
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0, byRole: {} };

  function ledgerFor(role) {
    if (!usage.byRole[role]) usage.byRole[role] = { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 };
    return usage.byRole[role];
  }

  async function callOnce(system, user, target) {
    if (target.cli) {
      if (target.provider === 'codex') return callCodexCli(system, user, target.model);
      if (target.provider === 'claude') return callClaudeCli(system, user, target.model);
      throw new Error(`derivation.llmClient: no CLI bridge for provider '${target.provider}'`);
    }
    return unifiedAIProvider.call({
      provider: target.provider,
      model: target.model,
      systemPrompt: system,
      messages: [{ role: 'user', content: user }],
      preset: 'direct',
      config: { temperature, maxTokens },
    });
  }

  async function call(role, { system, user, meta }) {
    usage.calls += 1;
    const ledger = ledgerFor(role);
    ledger.calls += 1;
    if (mode === 'mock') return mockResponse(role, meta);
    if (mode !== 'real') {
      throw new Error(`derivation.llmClient: unknown DERIVATION_LLM mode '${mode}' (expected 'mock' or 'real')`);
    }
    const target = resolveTarget(role);
    const trace = process.env.DERIVATION_TRACE === '1';
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const startedAt = Date.now();
      if (trace) {
        process.stderr.write(
          `    … ${role} → ${target.provider}/${target.model || 'default'}${attempt > 1 ? ` (attempt ${attempt})` : ''}\n`,
        );
      }
      try {
        const response = await callOnce(system, user, target);
        if (trace) process.stderr.write(`      ${role} done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s\n`);
        const inputTokens = response.usage?.inputTokens || 0;
        const outputTokens = response.usage?.outputTokens || 0;
        let cost = response.usage?.cost || 0;
        if (cost === 0 && (inputTokens > 0 || outputTokens > 0)) {
          const [inRate, outRate] = lookupRates(response.model || target.model);
          cost = (inputTokens / 1000) * inRate + (outputTokens / 1000) * outRate;
        }
        usage.inputTokens += inputTokens;
        usage.outputTokens += outputTokens;
        usage.costUSD += cost;
        ledger.inputTokens += inputTokens;
        ledger.outputTokens += outputTokens;
        ledger.costUSD += cost;
        return response.content || '';
      } catch (err) {
        lastErr = err;
        const msg = err?.message || String(err);
        if (trace) {
          process.stderr.write(
            `      ${role} FAILED after ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ${msg.slice(0, 120)}\n`,
          );
        }
        if (attempt === 3 || NON_RETRYABLE.some((re) => re.test(msg))) throw err;
        await new Promise((r) => setTimeout(r, attempt * 750));
      }
    }
    throw lastErr;
  }

  return {
    call,
    usage: () => ({
      ...usage,
      byRole: Object.fromEntries(Object.entries(usage.byRole).map(([k, v]) => [k, { ...v }])),
    }),
    mode,
  };
}
