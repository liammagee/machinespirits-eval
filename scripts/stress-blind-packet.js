/**
 * Blind second-reader packet for stress-bench repairs (step 4 of
 * workplan/items/state-detection-without-word-lists.md).
 *
 * `build` takes the review JSON (`review-stress-bench.js --json`) and the
 * judge file (`judge-stress-repair.js --out`) and writes two files: a
 * markdown PACKET for a person, and a KEY the person never sees. The packet
 * shows each planted moment in a seeded shuffle with the same four questions
 * the judge answered; it hides the run label (so the detector arm), the gold
 * move, and every judge verdict. The key maps item numbers back to all of it.
 *
 * `compare` scores a filled submission against the key: per-question
 * agreement with the judge, and Cohen's kappa on repair HIT vs not-HIT,
 * where the reader's HIT is computed from their move tag against the same
 * gold the judge's was. The reader's ruling is a second reading, never
 * ground truth (feedback: dramatic aim is generative).
 *
 * Usage:
 *   node scripts/stress-blind-packet.js build --review review.json --judgments judge.json \
 *     --packet packet.md --key key.json [--seed 7]
 *   node scripts/stress-blind-packet.js compare --key key.json --submission filled.json
 *
 * Submission format: a JSON array [{"n":1,"realized":"yes","move":"backtrack","uptake":"yes","eased":"eased"}].
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MOVE_TAGS, STATE_GLOSS, repairVerdict } from './judge-stress-repair.js';

export const STRESS_BLIND_PACKET_SCHEMA = 'machinespirits.tutor-stub.stress-blind-packet.v1';

/** Small deterministic shuffle (mulberry32) so the packet order is reproducible from the seed. */
export function seededShuffle(list, seed = 7) {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildBlindPacket({ reviews, judgments, seed = 7 }) {
  const judgeByKey = new Map((judgments?.items || []).map((j) => [`${path.resolve(j.tracePath)}#${j.turn}`, j]));
  const moments = [];
  for (const r of reviews) {
    for (const p of r.plants) {
      const j = judgeByKey.get(`${path.resolve(r.tracePath)}#${p.turn}`) || null;
      moments.push({
        tracePath: r.tracePath,
        label: r.label,
        world: r.world,
        turn: p.turn,
        state: p.state,
        realize: j?.realize || null,
        gold: p.gold,
        alsoAcceptable: j?.alsoAcceptable || p.alsoRight || null,
        learner: p.learner,
        tutor: p.tutor,
        learnerNext: p.learnerNext ?? null,
        judge: j
          ? {
              realized: j.realized,
              move: j.move,
              secondary: j.secondary,
              repair: j.repair,
              uptake: j.uptake,
              eased: j.eased,
            }
          : null,
      });
    }
  }
  const shuffled = seededShuffle(moments, seed).map((m, i) => ({ n: i + 1, ...m }));
  const key = {
    schema: STRESS_BLIND_PACKET_SCHEMA,
    createdAt: new Date().toISOString(),
    seed,
    judge: judgments?.judge || null,
    items: shuffled,
  };
  const tags = Object.entries(MOVE_TAGS)
    .map(([tag, gloss]) => `- \`${tag}\` — ${gloss}`)
    .join('\n');
  const md = [
    '# Second-reader packet — stress-bench repairs',
    '',
    'You are reading planted moments from tutoring dialogues. The learner is a simulated pupil; at each moment below she was directed to be in one named condition. The tutor did not know the condition. Please rule four things per item and return them as the JSON array at the end. Do not look for the "right answer" — rule what you see.',
    '',
    '1. **realized** — did LEARNER (this turn) carry out the direction? `yes` | `partly` | `no`',
    '2. **move** — the ONE move the TUTOR REPLY mainly makes, as one tag from the list. Add `secondary` if a second move is clearly present.',
    '3. **uptake** — does LEARNER (next turn) work with what the tutor offered rather than ignore or refuse it? `yes` | `no` | `unclear` | `none` (no next line)',
    '4. **eased** — judging only from LEARNER (next turn), does the stated condition still show? `eased` | `persists` | `unclear` | `none`',
    '',
    '## Move tags',
    '',
    tags,
    '',
    `## Items (${shuffled.length})`,
  ];
  for (const m of shuffled) {
    md.push(
      '',
      `### Item ${m.n}`,
      '',
      `The learner at this moment is **${STATE_GLOSS[m.state] || m.state}**.`,
      m.realize ? `Direction given to the learner for this one line: "${m.realize.replace(/\s+/g, ' ')}"` : '',
      '',
      `**LEARNER (this turn):** ${m.learner}`,
      '',
      `**TUTOR REPLY:** ${m.tutor}`,
      '',
      `**LEARNER (next turn):** ${m.learnerNext === null ? '(dialogue ended — no next line)' : m.learnerNext}`,
    );
  }
  md.push(
    '',
    '## Your answers',
    '',
    'Fill one object per item and save the array as a .json file:',
    '',
    '```json',
    JSON.stringify(
      shuffled.map((m) => ({ n: m.n, realized: '', move: '', secondary: null, uptake: '', eased: '' })),
      null,
      1,
    ),
    '```',
  );
  return { packet: md.filter((line) => line !== undefined).join('\n'), key };
}

function agreement(pairs) {
  const scored = pairs.filter(([a, b]) => a !== null && a !== undefined && b !== null && b !== undefined);
  const agree = scored.filter(([a, b]) => a === b).length;
  return { n: scored.length, agree, pct: scored.length ? Math.round((1000 * agree) / scored.length) / 10 : null };
}

/** Cohen's kappa for two binary readings. */
export function cohenKappa(pairs) {
  const n = pairs.length;
  if (!n) return null;
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const pa = pairs.filter(([a]) => a).length / n;
  const pb = pairs.filter(([, b]) => b).length / n;
  const pe = pa * pb + (1 - pa) * (1 - pb);
  if (pe === 1) return 1;
  return Math.round(((po - pe) / (1 - pe)) * 1000) / 1000;
}

export function compareSubmission(key, submission) {
  const byN = new Map((Array.isArray(submission) ? submission : []).map((s) => [Number(s.n), s]));
  const rows = key.items.map((m) => {
    const s = byN.get(m.n) || {};
    const readerMove = MOVE_TAGS[s.move] ? s.move : null;
    const readerSecondary = MOVE_TAGS[s.secondary] ? s.secondary : null;
    return {
      n: m.n,
      label: m.label,
      turn: m.turn,
      state: m.state,
      gold: m.gold,
      reader: {
        realized: s.realized || null,
        move: readerMove,
        repair: repairVerdict(readerMove, readerSecondary, m),
        uptake: s.uptake || null,
        eased: s.eased || null,
      },
      judge: m.judge,
    };
  });
  const withJudge = rows.filter((r) => r.judge);
  const pair = (field) => withJudge.map((r) => [r.reader[field], r.judge[field]]);
  const repairPairs = withJudge
    .filter((r) => r.reader.repair !== null && r.judge.repair !== null)
    .map((r) => [r.reader.repair === 'HIT', r.judge.repair === 'HIT']);
  return {
    items: rows.length,
    judged: withJudge.length,
    agreement: {
      realized: agreement(pair('realized')),
      move: agreement(pair('move')),
      repair: agreement(pair('repair')),
      uptake: agreement(pair('uptake')),
      eased: agreement(pair('eased')),
    },
    repairKappaHitVsNot: cohenKappa(repairPairs),
    readerHit: rows.filter((r) => r.reader.repair === 'HIT').length,
    judgeHit: withJudge.filter((r) => r.judge.repair === 'HIT').length,
    rows,
  };
}

export function renderComparison(result, judgeName) {
  const a = result.agreement;
  const line = (name, x) => `| ${name} | ${x.agree}/${x.n} | ${x.pct === null ? '—' : `${x.pct}%`} |`;
  return [
    `# Second reader vs judge (${judgeName || 'judge'})`,
    '',
    `${result.items} items, ${result.judged} with a judge ruling. Reader HIT ${result.readerHit}, judge HIT ${result.judgeHit}.`,
    '',
    '| Question | agree | % |',
    '|---|---|---|',
    line('realized', a.realized),
    line('move (exact tag)', a.move),
    line('repair (HIT/PARTIAL/MISS from own tag vs gold)', a.repair),
    line('uptake', a.uptake),
    line('eased', a.eased),
    '',
    `Cohen's kappa, repair HIT vs not-HIT: ${result.repairKappaHitVsNot === null ? '—' : result.repairKappaHitVsNot}`,
    '',
    '| n | run | turn | state | gold | reader move → repair | judge move → repair | uptake (reader/judge) |',
    '|---|---|---|---|---|---|---|---|',
    ...result.rows.map(
      (r) =>
        `| ${r.n} | ${r.label} | ${r.turn} | ${r.state} | ${r.gold} | ${r.reader.move || '—'} → ${r.reader.repair || '—'} | ${r.judge?.move || '—'} → ${r.judge?.repair || '—'} | ${r.reader.uptake || '—'}/${r.judge?.uptake || '—'} |`,
    ),
  ].join('\n');
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const [command, ...rest] = process.argv.slice(2);
  const flag = (name, fallback = null) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : fallback;
  };
  const readJson = (p) => JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
  if (command === 'build') {
    const reviewPath = flag('--review');
    const judgmentsPath = flag('--judgments');
    const packetPath = flag('--packet');
    const keyPath = flag('--key');
    if (!reviewPath || !packetPath || !keyPath) {
      console.error(
        'usage: build --review review.json [--judgments judge.json] --packet packet.md --key key.json [--seed 7]',
      );
      process.exit(1);
    }
    const review = readJson(reviewPath);
    const judgments = judgmentsPath ? readJson(judgmentsPath) : null;
    const { packet, key } = buildBlindPacket({
      reviews: review.reviews,
      judgments,
      seed: Number(flag('--seed', 7)) || 7,
    });
    fs.writeFileSync(path.resolve(packetPath), `${packet}\n`);
    fs.writeFileSync(path.resolve(keyPath), `${JSON.stringify(key, null, 1)}\n`);
    console.log(`wrote ${packetPath} (${key.items.length} items) and ${keyPath} — give the reader the packet only`);
  } else if (command === 'compare') {
    const keyPath = flag('--key');
    const submissionPath = flag('--submission');
    if (!keyPath || !submissionPath) {
      console.error('usage: compare --key key.json --submission filled.json');
      process.exit(1);
    }
    const key = readJson(keyPath);
    console.log(renderComparison(compareSubmission(key, readJson(submissionPath)), key.judge));
  } else {
    console.error('usage: node scripts/stress-blind-packet.js build|compare ...');
    process.exit(1);
  }
}
