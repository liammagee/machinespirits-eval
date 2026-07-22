// Program-2 Phase 5d — hard-safety leak breakdown by turn and arm.
// Emits the per-turn leak anatomy the §6.21 fold cites (turn-9 concentration,
// arm symmetry, committee vs frontier authorship). Deterministic, zero-call:
// reads the sealed traces' tutorLeakAudit per turn. Mirrors the safety notion
// in services/tutorStubEvalIntegrity.js (leakCountForTurns).
//
// Usage: node scripts/program2-phase5d-safety-breakdown.mjs [<archive-root>] [--json <out>]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ROOT = path.resolve(positional[0] || path.join(os.homedir(), '.machinespirits-data/program-2/phase5d-live'));
const jsonIdx = process.argv.indexOf('--json');
const JSON_OUT = jsonIdx > -1 ? process.argv[jsonIdx + 1] : null;

function sealedFile(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => path.join(dir, f))
    .find((f) => {
      const t = fs.readFileSync(f, 'utf8');
      return t.includes('"type":"run_end"') || t.includes('"type": "run_end"');
    });
}

function scanArm(arm) {
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'launch-plan.json'), 'utf8')).plan;
  const leakTurns = {};
  let dialogues = 0;
  let leakyDialogues = 0;
  const authorship = { committee: 0, frontier: 0 };
  const perDialogue = [];
  for (const job of plan.jobs) {
    if (job.arm !== arm) continue;
    const dir = path.join(ROOT, 'traces', job.id);
    if (!fs.existsSync(dir)) continue;
    const file = sealedFile(dir);
    if (!file) continue;
    dialogues += 1;
    const lines = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.trim());
    // committee-authored turns (source composed or fallback_*)
    const committeeTurns = new Set();
    for (const line of lines) {
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.type === 'program2_committee_moment' && ev.moment) {
        const src = String(ev.moment.source || '');
        if (src === 'composed' || src.startsWith('fallback')) committeeTurns.add(ev.moment.turn);
      }
    }
    const dTurns = [];
    for (const line of lines) {
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.type !== 'turn_complete' || !ev.turnRecord) continue;
      const leaks = ev.turnRecord.tutorLeakAudit?.leaks;
      if (Array.isArray(leaks) && leaks.length) {
        const turn = ev.turnRecord.turn;
        leakTurns[turn] = (leakTurns[turn] || 0) + 1;
        authorship[committeeTurns.has(turn) ? 'committee' : 'frontier'] += 1;
        dTurns.push(turn);
      }
    }
    if (dTurns.length) leakyDialogues += 1;
    perDialogue.push({ job: job.id, leakTurns: dTurns });
  }
  const totalLeaks = Object.values(leakTurns).reduce((s, v) => s + v, 0);
  return {
    dialogues,
    leakyDialogues,
    totalLeaks,
    leakTurns,
    turn9: leakTurns[9] || 0,
    authorship,
    perDialogue,
  };
}

const committee = scanArm('committee');
const control = scanArm('silent_control');
const artifact = {
  schema: 'machinespirits.program2.phase5d-safety-breakdown.v1',
  generatedAt: new Date().toISOString(),
  source: 'sealed traces tutorLeakAudit per turn (services/tutorStubEvalIntegrity.js leak notion)',
  committee,
  control,
};

console.log(
  `[safety] committee: ${committee.totalLeaks} leaks over ${committee.leakyDialogues}/${committee.dialogues} dialogues; turn-9 ${committee.turn9}/${committee.totalLeaks}; by turn ${JSON.stringify(committee.leakTurns)}; authorship ${JSON.stringify(committee.authorship)}`,
);
console.log(
  `[safety] control:   ${control.totalLeaks} leaks over ${control.leakyDialogues}/${control.dialogues} dialogues; turn-9 ${control.turn9}/${control.totalLeaks}; by turn ${JSON.stringify(control.leakTurns)}`,
);
if (JSON_OUT) {
  fs.writeFileSync(path.resolve(JSON_OUT), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[safety] wrote ${JSON_OUT}`);
}
