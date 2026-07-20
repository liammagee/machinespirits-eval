// Program-2 — extract live-pilot committee moments as an iterated-exhaust
// dataset delta (remedy 3 PREP; no training is licensed by this script).
//
// For every warrant_skip moment in sealed committee-arm dialogues of a live
// pilot root: emit the mini's actual live request (system prompt + messages,
// incl. the activation block — the deployment interface), the delivered
// text, the mini/composed texts and battery record, and the frozen
// compliance verdict with components. Compliant moments are SFT-eligible
// targets; all moments carry KTO-style boolean labels. Fail-closed: refuses
// traces whose detector version or arm stamps mismatch.
//
// Usage:
//   node scripts/program2-extract-live-moments.mjs [--pilot-root <dir>...] [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DETECTOR_VERSION = 'step4-frozen-2026-07-14.v1';

const { values: args } = parseArgs({
  options: {
    'pilot-root': {
      type: 'string',
      multiple: true,
      default: [path.resolve(REPO_ROOT, '../ms-phase5-pinned/exports/program2-live-pilot')],
    },
    out: {
      type: 'string',
      default: path.join(os.homedir(), '.machinespirits-data/program-2/datasets/phase5-live-v1'),
    },
  },
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const rows = [];
for (const root of args['pilot-root']) {
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'launch-plan.json'), 'utf8')).plan;
  for (const job of plan.jobs) {
    if (job.arm !== 'committee') continue;
    const dir = path.join(root, 'traces', job.id);
    if (!fs.existsSync(dir)) continue;
    const sealedFile = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(dir, f))
      .find((f) => {
        const text = fs.readFileSync(f, 'utf8');
        return text.includes('"type":"run_end"') || text.includes('"type": "run_end"');
      });
    if (!sealedFile) continue;
    const miniRequests = new Map();
    const moments = new Map();
    const compliance = new Map();
    const tutorTexts = new Map();
    let provenanceSha = null;
    for (const line of fs.readFileSync(sealedFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'run_start') provenanceSha = event.metadata?.provenance?.git?.sha || null;
      else if (event.type === 'model_call' && String(event.role || '').endsWith('_committee_mini'))
        miniRequests.set(Number(event.turn), event.request || null);
      else if (event.type === 'program2_committee_moment') moments.set(Number(event.turn), event.moment || {});
      else if (event.type === 'point_of_action_compliance' && event.compliance?.trigger === 'warrant_skip') {
        if (event.compliance.detector_version !== DETECTOR_VERSION)
          throw new Error(`${job.id}: detector ${event.compliance.detector_version}`);
        if (event.compliance.arm !== job.arm) throw new Error(`${job.id}: arm stamp mismatch`);
        compliance.set(Number(event.compliance.turn), event.compliance);
      } else if (event.type === 'turn_complete' && event.turnRecord)
        tutorTexts.set(Number(event.turnRecord.turn), String(event.turnRecord.tutor || ''));
    }
    for (const [turn, verdict] of compliance) {
      const moment = moments.get(turn) || null;
      rows.push({
        schema: 'machinespirits.program2.live-moment.v1',
        pilotRoot: path.basename(root),
        job: job.id,
        profile: job.profile,
        turn,
        provenanceSha,
        request: miniRequests.get(turn) || null,
        deliveredText: tutorTexts.get(turn) || null,
        committeeMoment: moment
          ? {
              source: moment.source,
              miniText: moment.miniText,
              span: moment.span,
              composedText: moment.composedText,
              battery: moment.battery,
              fallback: moment.fallback || null,
            }
          : null,
        compliant: verdict.compliant === true,
        components: verdict.components,
        sftEligible: verdict.compliant === true && Boolean(tutorTexts.get(turn)),
        ktoLabel: verdict.compliant === true,
      });
    }
  }
}

fs.mkdirSync(path.resolve(args.out), { recursive: true });
const outFile = path.join(path.resolve(args.out), 'live-moments.jsonl');
const payload = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
fs.writeFileSync(outFile, payload);
const summary = {
  schema: 'machinespirits.program2.live-moments-summary.v1',
  generatedAt: new Date().toISOString(),
  roots: args['pilot-root'],
  moments: rows.length,
  sftEligible: rows.filter((r) => r.sftEligible).length,
  ktoTrue: rows.filter((r) => r.ktoLabel).length,
  ktoFalse: rows.filter((r) => !r.ktoLabel).length,
  withMiniRequest: rows.filter((r) => r.request).length,
  bySource: rows.reduce((acc, r) => {
    const key = r.committeeMoment?.source || 'none';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}),
  sha256: sha256(payload),
};
fs.writeFileSync(path.join(path.resolve(args.out), 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
