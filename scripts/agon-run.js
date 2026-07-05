#!/usr/bin/env node
// Agon runner — plays adversarial tutoring-game episodes and writes ledgers.
//
//   node scripts/agon-run.js --arms A0,A1 --episodes 4 [--turns N] [--dry]
//        [--config config/agon/fractions-agon.yaml] [--out exports/agon/<runId>]
//        [--run-id <id>] [--resume] [--tutor-model gpt-5.5]
//        [--learner-model claude-sonnet-5] [--codex-effort medium]
//
// Providers: tutor ego+superego via the codex CLI, learner via the claude CLI
// (services/agon/llm.js over services/cliProviderBridge.js). --dry swaps in
// deterministic scripted agents (services/agon/scripted.js): zero API calls.
//
// Persistence: exports only, no DB writes. Per-turn JSONL (crash-safe append)
// + per-episode final JSON; --resume skips episodes whose final JSON exists.
// Arms are interleaved per episode index so quota drift hits both arms evenly
// (memory: parallel-adaptive-pilots reverses to sequential under shared quota).

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { pathToFileURL } from 'url';
import crypto from 'crypto';

import {
  loadGameConfig,
  createEpisode,
  tutorTurnStart,
  classifyTutorMove,
  applyTutorMove,
  buildLearnerBrief,
  checkLearnerEnvelope,
  adjudicateLearnerTurn,
  buildDisclosure,
  isTerminal,
  summarize,
} from '../services/agon/referee.js';
import {
  buildTutorSystemPrompt,
  buildSuperegoSystemPrompt,
  buildLearnerSystemPrompt,
  buildTutorEgoUser,
  buildSuperegoUser,
  buildRevisionUser,
  buildLearnerUser,
  REPAIR_NOTE,
} from '../services/agon/prompts.js';
import { parseAgentOutput } from '../services/agon/llm.js';

// ---------------------------------------------------------------------------
// Episode loop (library entrypoint — tests drive this with scripted agents)
// ---------------------------------------------------------------------------

export async function runEpisode({
  config,
  arm,
  episodeId,
  agents,
  overrides = {},
  onEvent = () => {},
  jsonlPath = null,
}) {
  const state = createEpisode(config, { arm, episodeId, overrides });
  const transcript = []; // visible messages only: {role, text}
  const turnRecords = [];
  const tutorSystem = buildTutorSystemPrompt(config, { arm, state });
  const superegoSystem = buildSuperegoSystemPrompt(config, { arm, state });
  const learnerSystem = buildLearnerSystemPrompt(config, { state });

  async function callAndParse(agentFn, { system, user }, label, flags) {
    const started = Date.now();
    let result = await agentFn({ system, user });
    let parsed = parseAgentOutput(result.text);
    let repairs = 0;
    if (!parsed) {
      repairs = 1;
      flags.push(`${label}:parse_repair`);
      result = await agentFn({ system, user: `${user}\n\n${REPAIR_NOTE}` });
      parsed = parseAgentOutput(result.text);
    }
    return { parsed, raw: result.text, latencyMs: Date.now() - started, repairs };
  }

  while (true) {
    const turn = tutorTurnStart(state);
    const disclosure = buildDisclosure(state);
    const flags = [];
    const timings = {};

    // --- Tutor ego draft ---------------------------------------------------
    const egoUser = buildTutorEgoUser({ state, disclosure, transcript });
    const ego = await callAndParse(agents.tutorEgo, { system: tutorSystem, user: egoUser }, 'ego', flags);
    timings.egoMs = ego.latencyMs;
    let draftEnvelope = ego.parsed?.envelope ?? {
      move: 'meta',
      concept: null,
      item_id: null,
      rationale: 'parse fallback',
    };
    let draftVisible = ego.parsed?.visible || stripFences(ego.raw);
    if (!ego.parsed) flags.push('ego:parse_fallback');

    let classified = classifyTutorMove(state, draftEnvelope);
    if (!classified.legal) {
      flags.push(`ego:illegal_move(${classified.reason})`);
      const retry = await callAndParse(
        agents.tutorEgo,
        {
          system: tutorSystem,
          user: `${egoUser}\n\nYour envelope was rejected by the referee: ${classified.reason}. Choose a legal move.`,
        },
        'ego-legal-retry',
        flags,
      );
      timings.egoRetryMs = retry.latencyMs;
      if (retry.parsed) {
        const reclassified = classifyTutorMove(state, retry.parsed.envelope);
        if (reclassified.legal) {
          draftEnvelope = retry.parsed.envelope;
          draftVisible = retry.parsed.visible || draftVisible;
          classified = reclassified;
        }
      }
    }

    // --- Superego audit ----------------------------------------------------
    const segoUser = buildSuperegoUser({ state, disclosure, transcript, draftEnvelope, draftVisible });
    const segoStarted = Date.now();
    const segoRaw = await agents.tutorSuperego({ system: superegoSystem, user: segoUser });
    timings.superegoMs = Date.now() - segoStarted;
    const segoParsed = parseAgentOutput(segoRaw.text);
    let verdict = 'OK';
    let critique = '';
    if (segoParsed?.envelope?.verdict === 'REVISE') {
      verdict = 'REVISE';
      critique = String(segoParsed.envelope.critique || '');
    } else if (!segoParsed) {
      flags.push('superego:parse_fallback_ok');
    }

    let finalEnvelope = draftEnvelope;
    let finalVisible = draftVisible;
    if (verdict === 'REVISE') {
      const revisionUser = buildRevisionUser({ state, disclosure, transcript, draftEnvelope, draftVisible, critique });
      const revision = await callAndParse(
        agents.tutorEgo,
        { system: tutorSystem, user: revisionUser },
        'revision',
        flags,
      );
      timings.revisionMs = revision.latencyMs;
      if (revision.parsed) {
        const revClassified = classifyTutorMove(state, revision.parsed.envelope);
        if (revClassified.legal) {
          finalEnvelope = revision.parsed.envelope;
          finalVisible = revision.parsed.visible || finalVisible;
          classified = revClassified;
        } else {
          flags.push(`revision:illegal_kept_draft(${revClassified.reason})`);
        }
      } else {
        flags.push('revision:parse_kept_draft');
      }
    }

    const moveRecord = applyTutorMove(state, classified, {
      rationale: finalEnvelope.rationale || '',
      visibleText: finalVisible,
    });
    transcript.push({ role: 'tutor', text: finalVisible });

    // --- Learner turn (with referee bounce loop) ---------------------------
    let directiveNote = null;
    let learnerParsed = null;
    let learnerRaw = null;
    let legality = { ok: false };
    let learnerMs = 0;
    const maxBounces = state.rules.max_bounces;
    for (let attempt = 0; attempt <= maxBounces; attempt += 1) {
      const brief = buildLearnerBrief(state);
      const learnerUser = buildLearnerUser({ state, brief, transcript, directiveNote });
      const call = await callAndParse(agents.learner, { system: learnerSystem, user: learnerUser }, 'learner', flags);
      learnerMs += call.latencyMs;
      learnerRaw = call.raw;
      if (call.parsed) {
        learnerParsed = { envelope: call.parsed.envelope, visible: call.parsed.visible };
      } else {
        flags.push('learner:parse_fallback_comply');
        learnerParsed = {
          envelope: { action: 'comply', dodge_type: null, stated_answer: null },
          visible: stripFences(learnerRaw),
        };
      }
      legality = checkLearnerEnvelope(state, learnerParsed.envelope);
      if (legality.ok) break;
      state.bounces += 1;
      directiveNote = directiveNoteFor(legality);
      flags.push(`learner:bounce(${legality.directive})`);
    }
    if (!legality.ok) {
      flags.push('learner:forced_comply_after_bounces');
      learnerParsed.envelope = {
        action: 'comply',
        dodge_type: null,
        stated_answer: learnerParsed.envelope?.stated_answer ?? null,
      };
    }
    timings.learnerMs = learnerMs;

    const adjudication = adjudicateLearnerTurn(state, {
      envelope: learnerParsed.envelope,
      publicText: learnerParsed.visible,
    });
    transcript.push({ role: 'learner', text: learnerParsed.visible });

    const record = {
      turn,
      disclosure,
      draftEnvelope,
      superego: { verdict, critique },
      finalEnvelope,
      move: moveRecord,
      learnerEnvelope: learnerParsed.envelope,
      tutorVisible: finalVisible,
      learnerVisible: learnerParsed.visible,
      adjudication,
      score: state.score,
      flags,
      timings,
    };
    turnRecords.push(record);
    if (jsonlPath) fs.appendFileSync(jsonlPath, JSON.stringify({ episodeId, ...record }) + '\n');

    onEvent(
      `[agon] ${episodeId} t${turn} ${moveRecord.move}` +
        (moveRecord.itemId ? `(${moveRecord.itemId})` : moveRecord.conceptId ? `(${moveRecord.conceptId})` : '') +
        (moveRecord.wellPosed === false ? ' ILL-POSED' : '') +
        ` sego=${verdict}` +
        ` -> ${adjudication.outcome}` +
        (adjudication.charged ? ` charged=${adjudication.dodgeType}` : '') +
        (adjudication.leakedItems.length ? ` LEAK=${adjudication.leakedItems.join(',')}` : '') +
        ` score=${state.score}`,
    );

    if (isTerminal(state)) break;
  }

  return { state, summary: summarize(state), transcript, turnRecords };
}

function directiveNoteFor(legality) {
  if (legality.directive === 'must_comply') {
    return 'must_comply — every dodge budget is exhausted against a well-posed probe. Set action="comply", put your true best answer in stated_answer, and say it in your visible reply.';
  }
  if (legality.directive === 'switch_or_comply') {
    return `switch_or_comply — that dodge type is exhausted. Declare one of [${(legality.alternatives || []).join(', ')}] or comply. (${legality.reason})`;
  }
  return `protocol_repair — ${legality.reason}. Follow the envelope schema exactly.`;
}

function stripFences(text) {
  const stripped = String(text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*-{3,}\s*/, '')
    .trim();
  return stripped || String(text || '').trim();
}

// ---------------------------------------------------------------------------
// CLI main
// ---------------------------------------------------------------------------

function parseCliArgs(argv) {
  const args = {
    config: 'config/agon/fractions-agon.yaml',
    arms: ['A1'],
    episodes: 1,
    turns: null,
    out: null,
    runId: null,
    resume: false,
    dry: false,
    tutorModel: 'gpt-5.5',
    learnerModel: 'claude-sonnet-5',
    codexEffort: process.env.CODEX_REASONING_EFFORT || 'medium',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => argv[++i];
    if (key === '--config') args.config = next();
    else if (key === '--arms')
      args.arms = next()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (key === '--arm') args.arms = [next()];
    else if (key === '--episodes') args.episodes = Number(next());
    else if (key === '--turns') args.turns = Number(next());
    else if (key === '--out') args.out = next();
    else if (key === '--run-id') args.runId = next();
    else if (key === '--resume') args.resume = true;
    else if (key === '--dry') args.dry = true;
    else if (key === '--tutor-model') args.tutorModel = next();
    else if (key === '--learner-model') args.learnerModel = next();
    else if (key === '--codex-effort') args.codexEffort = next();
    else throw new Error(`unknown flag ${key}`);
  }
  return args;
}

function gitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const args = parseCliArgs(process.argv);
  const config = loadGameConfig(args.config);
  const overrides = args.turns ? { rules: { max_turns: args.turns } } : {};

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const runId = args.runId || `agon-${stamp}`;
  const outDir = args.out || path.join('exports', 'agon', runId);
  const episodesDir = path.join(outDir, 'episodes');
  fs.mkdirSync(episodesDir, { recursive: true });

  // Codex reasoning effort: game turns are tactical; medium keeps latency and
  // quota sane (the bridge defaults to xhigh otherwise).
  process.env.CODEX_REASONING_EFFORT = args.codexEffort;

  let agents;
  if (args.dry) {
    const { makeScriptedAgents } = await import('../services/agon/scripted.js');
    agents = makeScriptedAgents(config);
  } else {
    const { makeCliAgents } = await import('../services/agon/llm.js');
    agents = makeCliAgents({
      tutorModel: args.tutorModel,
      learnerModel: args.learnerModel,
      log: (line) => console.log(line),
    });
  }

  const manifest = {
    runId,
    startedAt: new Date().toISOString(),
    configPath: args.config,
    configHash: crypto.createHash('sha256').update(fs.readFileSync(args.config)).digest('hex').slice(0, 16),
    gameId: config.id,
    arms: args.arms,
    episodesPerArm: args.episodes,
    turnsOverride: args.turns,
    dry: args.dry,
    agents: agents.descriptor,
    codexEffort: args.dry ? null : args.codexEffort,
    gitCommit: gitCommit(),
    schedule: [],
  };
  fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(manifest, null, 2));
  console.log(
    `[agon] run ${runId} -> ${outDir} (arms=${args.arms.join(',')} episodes/arm=${args.episodes} dry=${args.dry})`,
  );

  const summaries = [];
  for (let e = 1; e <= args.episodes; e += 1) {
    for (const arm of args.arms) {
      const episodeId = `${arm}-e${e}`;
      const episodePath = path.join(episodesDir, `${episodeId}.json`);
      if (args.resume && fs.existsSync(episodePath)) {
        console.log(`[agon] ${episodeId} already complete — skipping (resume)`);
        summaries.push(JSON.parse(fs.readFileSync(episodePath, 'utf-8')).summary);
        continue;
      }
      const jsonlPath = path.join(episodesDir, `${episodeId}.turns.jsonl`);
      if (fs.existsSync(jsonlPath)) fs.unlinkSync(jsonlPath); // fresh attempt
      const startedAt = Date.now();
      try {
        const result = await runEpisode({
          config,
          arm,
          episodeId,
          agents,
          overrides,
          jsonlPath,
          onEvent: (line) => console.log(line),
        });
        const payload = {
          episodeId,
          arm,
          runId,
          agents: agents.descriptor,
          durationMs: Date.now() - startedAt,
          summary: result.summary,
          transcript: result.transcript,
          turnRecords: result.turnRecords,
        };
        fs.writeFileSync(episodePath, JSON.stringify(payload, null, 2));
        summaries.push(result.summary);
        manifest.schedule.push({ episodeId, status: 'complete', durationMs: payload.durationMs });
        console.log(
          `[agon] ${episodeId} DONE in ${(payload.durationMs / 1000).toFixed(0)}s: ` +
            `demo=${result.summary.demonstrated} transfer=${result.summary.transferred} ` +
            `score=${result.summary.score} win=${result.summary.tutorWin}`,
        );
      } catch (err) {
        manifest.schedule.push({ episodeId, status: 'error', error: String(err.message || err) });
        fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(manifest, null, 2));
        console.error(`[agon] ${episodeId} FAILED: ${err.message}`);
        console.error('[agon] stopping run (checkpoints preserved — rerun with --resume --run-id ' + runId + ')');
        throw err;
      }
      fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(manifest, null, 2));
    }
  }

  manifest.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(manifest, null, 2));
  console.log(
    `[agon] run ${runId} complete: ${summaries.length} episodes. Report: node scripts/agon-report.js ${outDir}`,
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
