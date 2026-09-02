/**
 * Judge stress-bench repairs with a model from another family than the
 * tutor (step 4 of workplan/items/state-detection-without-word-lists.md).
 *
 * For every planted turn in the given trace roots the judge sees the planted
 * state (named, as §6.24 disclosure requires), the direction the learner-sim
 * was given, her line, the tutor's reply and her NEXT line. It rules four
 * things per plant; the gold is never shown to it:
 *
 *   realized — did her line carry out the planted direction? yes|partly|no
 *   move     — the ONE move the reply mainly makes (MOVE_TAGS), plus an
 *              optional second move. The script, not the judge, compares
 *              the move with the schedule's gold: HIT when the main move is
 *              the gold or the also-acceptable move, PARTIAL when only the
 *              second move is, else MISS.
 *   uptake   — does her next line work with what the tutor offered?
 *              yes|no|unclear|none (no next line)
 *   eased    — does the planted condition still show in her next line?
 *              eased|persists|unclear|none
 *
 * CAVEAT on uptake/eased: the learner-sim returns to its standing brief the
 * turn after a plant by design (tutorStubStressSchedule.js), so easing is
 * expected whatever the tutor did. Uptake — whether she picks up the move —
 * is the stronger of the two; read them together, and let the blind second
 * reader (scripts/stress-blind-packet.js) rule the same items.
 *
 * Rails: the judge must be from another provider than the tutor seat the
 * trace recorded (no self-judging; --allow-same-family to override, stated
 * in the output). One pass, three retries per batch on transport failure
 * only, no resampling of a parsed verdict. Unparseable output leaves the
 * batch UNJUDGED — indeterminate, so the sheet says stop and look.
 *
 * Usage:
 *   node scripts/judge-stress-repair.js <traceDirOrParent> [more...] \
 *     --schedules config/drama-derivation/stress/world-036-stress-schedule.yaml[,...] \
 *     [--judge codex.gpt-5.6-sol] [--out exports/.../judge.json] [--batch 6]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { loadTutorStubStressSchedule } from '../services/tutorStubStressSchedule.js';
import { findStressTraces, reviewStressTrace } from './review-stress-bench.js';

export const STRESS_JUDGE_SCHEMA = 'machinespirits.tutor-stub.stress-repair-judgment.v1';

export const STATE_GLOSS = Object.freeze({
  jumping_ahead: 'jumping ahead — demanding the conclusion before the evidence supports it',
  irritated: 'irritated — rubbed wrong by how the exchange sounds, mocking or challenging its register',
  bored: 'bored — attention drifting, going flat',
  lost: 'lost — sincerely confused about where the inquiry stands',
  confused: 'confused — sincerely unsure what was meant',
  frustrated: 'frustrated — feeling their effort is not paying off',
  forgetting: 'forgetting — asserting a false memory as settled',
  opposed: 'opposed — defending a position for personal stakes',
});

/** The conduct vocabulary used since the crossed run (exports/crossed-effects/conduct-tags.json). */
export const MOVE_TAGS = Object.freeze({
  backtrack: 'goes back to the record or an earlier step and re-checks it, letting the record disagree',
  off_track_probe: 'steps off the current track with one oblique question that separates two tangled things',
  reinforce_and_test: 'credits what the learner did that stands, then sets one small check to run',
  change_tone: 'changes the voice or register (plainer, warmer, less procedural); content the same',
  simplify: 'same content in fewer parts or plainer structure',
  slow_down: 'holds the tempo back; asks for a step before going on',
  speed_up: 'gives the tempo asked for; moves to the conclusion or the next step',
  continue: 'presses on with the current line of inquiry as before',
  more_words: 'explains at greater length',
  fewer_words: 'a markedly shorter reply',
  humor: 'lightness or a joke carries the turn',
  capitulate: 'hands the answer over or gives up the line under pressure',
});

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

export function loadSchedules(paths) {
  const byId = {};
  for (const p of paths) {
    const schedule = loadTutorStubStressSchedule(path.resolve(p));
    byId[schedule.scheduleId] = schedule;
  }
  return byId;
}

/** Judge items from reviewed traces; the schedule supplies the direction and the gold. */
export function buildStressRepairItems(reviews, schedulesById) {
  const items = [];
  for (const r of reviews) {
    const schedule = schedulesById[r.scheduleId];
    if (!schedule) throw new Error(`no schedule loaded for ${r.scheduleId} (${r.label}); pass it with --schedules`);
    for (const p of r.plants) {
      const plant = schedule.plants.find((x) => x.turn === p.turn);
      if (!plant) throw new Error(`schedule ${r.scheduleId} has no plant at turn ${p.turn} (${r.label})`);
      items.push({
        tracePath: r.tracePath,
        label: r.label,
        world: r.world,
        models: r.models || {},
        turn: p.turn,
        state: p.state,
        realize: plant.realize,
        gold: plant.rightRepair,
        alsoAcceptable: plant.alsoAcceptable || plant.alsoRight || null,
        repairGloss: plant.repairGloss || '',
        learner: p.learner,
        tutor: p.tutor,
        learnerNext: p.learnerNext,
      });
    }
  }
  return items;
}

export function providerOf(ref) {
  return String(ref || '').split('.')[0] || null;
}

/** No self-judging: the judge's provider must differ from every tutor seat judged. */
export function assertJudgeFamilyDiffers(judgeRef, items, { allowSameFamily = false } = {}) {
  const tutorProviders = new Set(items.map((it) => providerOf(it.models?.tutor)).filter(Boolean));
  if (tutorProviders.has(judgeRef.provider) && !allowSameFamily) {
    throw new Error(
      `judge ${judgeRef.provider}.${judgeRef.model} shares a family with the tutor seat (${[...tutorProviders].join(', ')}); pick another family or pass --allow-same-family`,
    );
  }
  return [...tutorProviders];
}

export function repairVerdict(move, secondary, item) {
  if (!move) return null;
  const right = new Set([item.gold, item.alsoAcceptable].filter(Boolean));
  if (right.has(move)) return 'HIT';
  if (secondary && right.has(secondary)) return 'PARTIAL';
  return 'MISS';
}

export function parseJudgeJson(text) {
  const raw = String(text || '');
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function renderItem(it, n) {
  return [
    `${n}. The learner at this moment is ${STATE_GLOSS[it.state] || it.state}.`,
    `   The learner-simulator was directed, for this one line: "${it.realize.replace(/\s+/g, ' ')}"`,
    `   LEARNER (this turn): ${it.learner}`,
    `   TUTOR REPLY: ${it.tutor}`,
    `   LEARNER (next turn): ${it.learnerNext === null ? '(dialogue ended — no next line)' : it.learnerNext}`,
  ].join('\n');
}

export function buildPrompt(batch) {
  const tags = Object.entries(MOVE_TAGS)
    .map(([tag, gloss]) => `  - ${tag}: ${gloss}`)
    .join('\n');
  return [
    'You are reading moments from tutoring dialogues. For each numbered item rule four things.',
    '',
    'realized: did LEARNER (this turn) carry out the direction the simulator was given? "yes" | "partly" | "no".',
    'move: the ONE move the TUTOR REPLY mainly makes, as a tag from this list. secondary: a second tag if a second move is clearly present, else null.',
    tags,
    'uptake: does LEARNER (next turn) take up what the tutor offered — work with the move rather than ignore or refuse it? "yes" | "no" | "unclear" | "none" (no next line).',
    'eased: judging only from LEARNER (next turn), does the stated condition still show? "eased" | "persists" | "unclear" | "none".',
    'why: one short sentence.',
    '',
    'Return ONLY a JSON array, one object per item, e.g.',
    '[{"n":1,"realized":"yes","move":"backtrack","secondary":null,"uptake":"yes","eased":"eased","why":"..."}]',
    '',
    ...batch.map((it, j) => renderItem(it, j + 1)),
  ].join('\n');
}

const REALIZED = new Set(['yes', 'partly', 'no']);
const UPTAKE = new Set(['yes', 'no', 'unclear', 'none']);
const EASED = new Set(['eased', 'persists', 'unclear', 'none']);

/** Merge one parsed judge array onto its batch; anything off-vocabulary reads as unjudged (null). */
export function applyVerdicts(batch, parsed) {
  return batch.map((it, j) => {
    const v = Array.isArray(parsed) ? parsed.find((x) => Number(x?.n) === j + 1) : null;
    const move = v && MOVE_TAGS[v.move] ? v.move : null;
    const secondary = v && MOVE_TAGS[v.secondary] ? v.secondary : null;
    const noNext = it.learnerNext === null;
    return {
      ...it,
      realized: v && REALIZED.has(v.realized) ? v.realized : null,
      move,
      secondary,
      repair: repairVerdict(move, secondary, it),
      uptake: noNext ? 'none' : v && UPTAKE.has(v.uptake) ? v.uptake : null,
      eased: noNext ? 'none' : v && EASED.has(v.eased) ? v.eased : null,
      why: v && typeof v.why === 'string' ? v.why.slice(0, 300) : null,
    };
  });
}

async function judgeBatch(judgeRef, batch, label) {
  let res = null;
  for (let attempt = 0; attempt < 3 && !res; attempt++) {
    try {
      res = await callAIWithCliBridge(judgeRef, '', buildPrompt(batch), label, { timeoutMs: 240000 });
    } catch (err) {
      console.error(`${label}: transport retry ${attempt + 1}: ${String(err).slice(0, 120)}`);
    }
  }
  return applyVerdicts(batch, res ? parseJudgeJson(res.text) : null);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const valueFlags = ['--schedules', '--judge', '--out', '--batch'];
  const valueIndexes = new Set(
    valueFlags
      .map((f) => args.indexOf(f))
      .filter((i) => i >= 0)
      .map((i) => i + 1),
  );
  const roots = args.filter((a, i) => !valueFlags.includes(a) && a !== '--allow-same-family' && !valueIndexes.has(i));
  const schedulePaths = String(flag('--schedules', '')).split(',').filter(Boolean);
  if (!roots.length || !schedulePaths.length) {
    console.error(
      'usage: node scripts/judge-stress-repair.js <traceDirOrParent> [more...] --schedules a.yaml[,b.yaml] [--judge codex.gpt-5.6-sol] [--out file.json] [--batch 6] [--allow-same-family]',
    );
    process.exit(1);
  }
  const JUDGE = flag('--judge', 'codex.gpt-5.6-sol');
  const [provider, ...modelParts] = JUDGE.split('.');
  const judgeRef = { provider, model: modelParts.join('.') };
  const allowSameFamily = args.includes('--allow-same-family');
  const batchSize = Math.max(1, Number(flag('--batch', 6)) || 6);

  const reviews = [];
  for (const root of roots) {
    const labelRoot = path.resolve(root);
    for (const tracePath of findStressTraces(labelRoot)) {
      const review = reviewStressTrace(tracePath, { labelRoot });
      if (review) reviews.push(review);
    }
  }
  const items = buildStressRepairItems(reviews, loadSchedules(schedulePaths));
  if (!items.length) {
    console.error('no planted turns found under the given roots');
    process.exit(1);
  }
  const tutorFamilies = assertJudgeFamilyDiffers(judgeRef, items, { allowSameFamily });

  const judged = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    judged.push(...(await judgeBatch(judgeRef, batch, `judge-stress-repair-${i}`)));
    console.error(`judged ${Math.min(i + batchSize, items.length)}/${items.length}`);
  }
  const unjudged = judged.filter((j) => j.repair === null).length;
  const out = {
    schema: STRESS_JUDGE_SCHEMA,
    createdAt: new Date().toISOString(),
    judge: JUDGE,
    judgeSeesGold: false,
    tutorFamilies,
    allowSameFamily,
    counts: {
      items: judged.length,
      unjudged,
      hit: judged.filter((j) => j.repair === 'HIT').length,
      partial: judged.filter((j) => j.repair === 'PARTIAL').length,
      miss: judged.filter((j) => j.repair === 'MISS').length,
    },
    items: judged,
  };
  const body = JSON.stringify(out, null, 1);
  const outPath = flag('--out');
  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outPath), `${body}\n`);
    console.log(
      `wrote ${outPath}: ${out.counts.items} plants, HIT ${out.counts.hit}, PARTIAL ${out.counts.partial}, MISS ${out.counts.miss}, UNJUDGED ${unjudged}`,
    );
  } else {
    console.log(body);
  }
  if (unjudged) {
    console.error(`${unjudged} plant(s) UNJUDGED — indeterminate; do not resample, look at the judge output`);
    process.exit(2);
  }
}
