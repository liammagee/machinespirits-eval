#!/usr/bin/env node
/**
 * QA gate — Oedipus guided-discovery ARM INVARIANTS (post-generation, pre-scoring).
 *
 * Motivation: the leaks in this arc are all the same shape — an isolation guarantee of
 * the three-arm design gets violated and is caught late, by eye, after spend. The worst
 * was a `none` (withhold-control) tutor that METERED the ledger anyway (surfaced accession
 * numbers, record codes, provenance) in all 3 repeats, because the scenario's persona baked
 * socratic behaviour into every arm. The existing checks missed it: `assessTranscriptQuality`
 * lints only the LEARNER's words; the omniscient critic judges the LEARNER's discovery — so a
 * leaking TUTOR whose learner happens not to finish slips through (exports/oedipus-d1-forced
 * run3). This gate closes that hole by judging each arm's TUTOR-side behaviour, and it
 * QUARANTINES violators (exit 1) rather than warning, so contaminated transcripts never reach
 * scoring silently.
 *
 * One SEMANTIC judge classifies the tutor's disclosure of the hidden conclusion S into a
 * 3-level scale, interpreted per arm (a deterministic lexical detector is NOT enough: a reveal
 * arm stated S in paraphrase that token-overlap missed — so the gate is fully semantic):
 *   - withheld : surfaced no premise/clue pointing at S (the no-help control).
 *   - metered  : surfaced premises so the learner could INFER S, but did not state S.
 *   - stated   : stated/conveyed the conclusion S directly (paraphrase counts).
 * Arm invariants:
 *   - none     (T1): tutor MUST be `withheld`. metered/stated ⇒ control contaminated.
 *   - socratic (T2): tutor MUST be `metered`. stated ⇒ accidental reveal; withheld ⇒ no discovery possible.
 *   - reveal   (T3): tutor MUST be `stated`. else the ceiling never revealed.
 * The `none` check (T1) is the genuinely additive one — the critic already judges T2/T3
 * semantically via by_reasoning/ceiling, but nothing else checks the control TUTOR.
 *
 * NOT covered here (other QA-layer stages): D1 pre-generation persona/design lint;
 * P1 shared-prefix neutrality; L1 secret-in-learner-prompt (assertSecretAbsent, already blocking).
 *
 * Usage:
 *   node scripts/qa-oedipus-arms.js --sample-root exports/oedipus-d1-forced/run2 \
 *        --spec config/poetics-calibration/oedipus-pilot-v2.yaml [--arms none,socratic,reveal] \
 *        [--panel gpt,deepseek/deepseek-v4-pro,...] [--consensus 3] [--out FILE] [--mock]
 *   # exit 0 = all invariants hold; exit 1 = a quarantine-worthy violation; 2 = error
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { callModel, parseJsonResponse, withScorerRetry } from './score-poetics-calibration.js';
import { parseTurns, loadSecretMap } from './critic-poetics-omniscient.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PANEL = ['gpt', 'deepseek/deepseek-v4-pro', 'qwen/qwen3.7-max', 'google/gemini-3.5-flash'];
const LEVELS = ['withheld', 'metered', 'stated'];
const REQUIRED = { none: 'withheld', socratic: 'metered', reveal: 'stated' };
const INVARIANT = { none: 'T1', socratic: 'T2', reveal: 'T3' };
const FAIL_STATUS = { none: 'CONTROL_CONTAMINATED', socratic: 'SOCRATIC_OFF', reveal: 'REVEAL_MISSING' };

function parseArgs(argv) {
  const a = {
    sampleRoot: null,
    spec: null,
    arms: ['none', 'socratic', 'reveal'],
    panel: [...DEFAULT_PANEL],
    consensus: null,
    out: null,
    mock: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--sample-root') a.sampleRoot = path.resolve(argv[++i]);
    else if (t === '--spec') a.spec = path.resolve(argv[++i]);
    else if (t === '--arms')
      a.arms = String(argv[++i])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (t === '--panel')
      a.panel = String(argv[++i])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (t === '--consensus') a.consensus = parseInt(argv[++i], 10);
    else if (t === '--out') a.out = path.resolve(argv[++i]);
    else if (t === '--mock') a.mock = true;
    else throw new Error(`unknown arg: ${t}`);
  }
  if (!a.sampleRoot) throw new Error('--sample-root is required');
  if (!a.spec) throw new Error('--spec is required');
  if (a.consensus == null) a.consensus = Math.max(1, Math.ceil(a.panel.length * 0.6));
  return a;
}

// (tid, dramaId, transcript) for an arm, from key-<arm>.yaml under the sample root plus the .txt.
function loadArmTranscript(sampleRoot, arm) {
  const armDir = path.join(sampleRoot, 'sample', arm);
  if (!fs.existsSync(armDir)) return null;
  const txts = fs.readdirSync(armDir).filter((f) => f.endsWith('.txt'));
  if (!txts.length) return null;
  let tid = null;
  let dramaId = null;
  const keyPath = path.join(sampleRoot, `key-${arm}.yaml`);
  if (fs.existsSync(keyPath)) {
    const key = yaml.parse(fs.readFileSync(keyPath, 'utf8')) || {};
    const items = Array.isArray(key.items) ? key.items : Array.isArray(key) ? key : [];
    const e = items.find((x) => x && (x.tid || x.id));
    if (e) {
      tid = e.tid || e.id;
      dramaId = e.drama_id || e.dramaId || e.drama;
    }
    if (!tid) {
      const flat = Object.entries(key).find(([k]) => /^T\d+/.test(k));
      if (flat) {
        [tid, dramaId] = flat;
      }
    }
  }
  if (!tid) tid = txts[0].replace(/\.txt$/, '');
  const txtPath = path.join(armDir, `${tid}.txt`);
  const transcript = fs.readFileSync(fs.existsSync(txtPath) ? txtPath : path.join(armDir, txts[0]), 'utf8');
  return { tid, dramaId, transcript };
}

const buildDisclosurePrompt = (
  secret,
  tutorTurns,
) => `A tutor is in a guided-discovery scene with a single HIDDEN CONCLUSION S that the tutor privately knows. From the tutor's ACTUAL turns, classify how the tutor handled S:
  - "withheld": surfaced NO premise, record, name, code, or clue that points at S — stayed on the learner's surface concern (the no-help control).
  - "metered": surfaced/pointed at the supporting premises so the learner could INFER S, but did NOT itself state the conclusion S.
  - "stated": stated or plainly conveyed the conclusion S to the learner (any wording; paraphrase counts).

HIDDEN CONCLUSION S:
"${secret.fact}"

SUPPORTING PREMISES (surfacing these = "metered"; asserting the conclusion above = "stated"):
${(secret.premise_ledger || []).map((p, i) => `  ${i + 1}. ${p}`).join('\n')}

THE TUTOR'S ACTUAL TURNS (public speech + stage directions):
${tutorTurns.map((t, i) => `  [T${i + 1}] ${t.text.replace(/\s+/g, ' ').trim()}`).join('\n')}

Reply ONLY JSON: {"level": "withheld"|"metered"|"stated", "evidence": "<most telling tutor quote, or ''>", "reason": "<one sentence>"}`;

async function judgeTutorDisclosure(secret, transcript, args, mockLevel) {
  const tutorTurns = parseTurns(transcript).filter((t) => t.role === 'TUTOR');
  if (args.mock)
    return {
      level: mockLevel,
      tally: { withheld: 0, metered: 0, stated: 0, [mockLevel]: args.panel.length },
      valid: args.panel.length,
      evidence: '',
    };
  const tally = { withheld: 0, metered: 0, stated: 0 };
  let valid = 0;
  let evidence = '';
  for (const m of args.panel) {
    try {
      const { value: v } = await withScorerRetry(async () =>
        parseJsonResponse(await callModel(buildDisclosurePrompt(secret, tutorTurns), m)),
      );
      const lvl = LEVELS.includes(v.level) ? v.level : null;
      if (lvl) {
        tally[lvl] += 1;
        valid += 1;
        if (v.evidence && !evidence) evidence = v.evidence;
      }
    } catch {
      /* count as no vote */
    }
  }
  const level = LEVELS.reduce((best, l) => (tally[l] > tally[best] ? l : best), 'withheld');
  return { level, tally, valid, evidence };
}

// Pure verdict: given a panel tally for an arm, does the arm's invariant hold? The required
// level must BOTH be the plurality (j.level) AND clear consensus — a tie/low-confidence panel
// FAILS rather than passing on a bare plurality. Extracted for hermetic unit testing.
function armVerdict(arm, j, consensus) {
  const required = REQUIRED[arm];
  if (!required)
    return { arm, status: 'UNKNOWN_ARM', pass: false, level: j.level, detail: `no invariant for arm '${arm}'` };
  const pass = j.tally[required] >= consensus && j.level === required;
  const tallyStr = `withheld:${j.tally.withheld} metered:${j.tally.metered} stated:${j.tally.stated}`;
  return {
    arm,
    invariant: INVARIANT[arm],
    level: j.level,
    pass,
    status: pass ? `${required}_ok` : FAIL_STATUS[arm],
    detail: pass
      ? `tutor ${required} (${j.tally[required]}/${j.valid})`
      : `expected ${required}, got ${j.level} [${tallyStr}]`,
    evidence: pass ? '' : j.evidence,
  };
}

async function checkArm(arm, sampleRoot, secretMap, args) {
  const loaded = loadArmTranscript(sampleRoot, arm);
  if (!loaded) return { arm, status: 'MISSING', pass: false, detail: 'no transcript/key' };
  const secret = secretMap[loaded.dramaId] || Object.values(secretMap)[0];
  if (!secret) return { arm, status: 'NO_SECRET', pass: false, detail: `no secret for ${loaded.dramaId}` };
  if (!REQUIRED[arm]) return { arm, status: 'UNKNOWN_ARM', pass: false, detail: `no invariant for arm '${arm}'` };
  const j = await judgeTutorDisclosure(secret, loaded.transcript, args, REQUIRED[arm]);
  return armVerdict(arm, j, args.consensus);
}

async function run() {
  const args = parseArgs(process.argv);
  const secretMap = loadSecretMap(args.spec);
  const results = [];
  for (const arm of args.arms) results.push(await checkArm(arm, args.sampleRoot, secretMap, args));

  const allPass = results.every((r) => r.pass);
  console.log(`\n== QA arm-invariants (${path.relative(ROOT, args.sampleRoot)}${args.mock ? ', mock' : ''}) ==`);
  for (const r of results) {
    console.log(
      `  ${(r.arm || '?').padEnd(9)} ${(r.invariant || '--').padEnd(3)} ${r.pass ? 'PASS' : 'FAIL'}  ${r.status}  — ${r.detail}`,
    );
    if (r.evidence) console.log(`              evidence: "${String(r.evidence).slice(0, 160)}"`);
  }
  console.log(
    `\n  ${allPass ? 'ALL INVARIANTS HOLD — transcripts admissible' : 'VIOLATION — quarantine before scoring'}`,
  );

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(
      args.out,
      `${JSON.stringify({ sampleRoot: path.relative(ROOT, args.sampleRoot), allPass, results }, null, 2)}\n`,
      'utf8',
    );
  }
  process.exit(allPass ? 0 : 1);
}
if (path.resolve(process.argv[1] || '') === __filename) {
  run().catch((e) => {
    console.error(e?.stack || String(e));
    process.exit(2);
  });
}

export { parseArgs, loadArmTranscript, judgeTutorDisclosure, armVerdict, checkArm };
