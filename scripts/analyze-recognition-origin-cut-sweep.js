#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const SWEEP_CUTS = [50, 55, 60, 65, 70, 75];

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function scoreValue(...values) {
  for (const value of values) {
    const n = asNumber(value);
    if (n != null) return n;
  }
  return 0;
}

function classifyAt(row, cut) {
  if (row.error) return { class: 'none', basis: 'score_error' };
  const roles = row.roleSymmetricScores || row.metadata?.role_symmetric_scores || {};
  const learnerSelf = roles.learner_self_reframe || {};
  const learnerAction = roles.learner_actional_breakthrough || {};
  const tutorMechanism = roles.tutor_adaptive_mechanism || roles.tutor_strategy_reversal || {};
  const mechanismQuality = roles.tutor_adaptive_mechanism_quality || {};
  const formClass = row.formClass || row.form_class || null;
  const recon = scoreValue(row.recontextualization, learnerSelf.score100);
  const statedInsight = scoreValue(row.statedInsight, row.stated_insight);
  const learnerActionScore = scoreValue(
    row.actionalBreakthrough,
    row.metadata?.actional_breakthrough,
    learnerAction.score100,
  );
  const tutorMechanismScore = scoreValue(
    row.tutorAdaptiveMechanism,
    row.tutorStrategicReversal,
    row.metadata?.tutor_adaptive_mechanism,
    row.metadata?.tutor_strategic_reversal,
    tutorMechanism.score100,
  );
  const mechanismQualityScore = scoreValue(
    row.adaptiveMechanismQuality,
    row.metadata?.adaptive_mechanism_quality,
    mechanismQuality.score100,
  );
  const complete = recon >= cut && learnerActionScore >= cut && tutorMechanismScore >= cut;
  if (formClass === 'trap' || (statedInsight >= cut && recon < cut)) {
    return { class: 'false_closure', complete };
  }
  if (formClass !== 'recognition' && recon < cut) {
    return { class: 'none', complete };
  }
  if (complete) return { class: 'peripeteia_induced', complete };
  if (tutorMechanismScore >= cut || mechanismQualityScore >= cut) {
    return { class: 'ambiguous', complete };
  }
  return { class: 'organic', complete };
}

function loadIterationScores(iterDir) {
  const scoresDir = path.join(iterDir, 'scores');
  if (!fs.existsSync(scoresDir)) return [];
  const files = fs.readdirSync(scoresDir).filter((f) => f.endsWith('.json'));
  const rows = [];
  for (const file of files) {
    const filePath = path.join(scoresDir, file);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      continue;
    }
    const arm = parsed.scored?.[0] ? deriveArmFromFile(file) : deriveArmFromFile(file);
    const critic = parsed.critic || deriveCriticFromFile(file);
    for (const item of parsed.scored || []) {
      rows.push({
        iter: path.basename(iterDir),
        arm,
        critic,
        itemId: item.id,
        formClass: item.formClass,
        statedInsight: item.statedInsight,
        recontextualization: item.recontextualization,
        actionalBreakthrough: item.actionalBreakthrough,
        tutorAdaptiveMechanism: item.tutorAdaptiveMechanism,
        tutorStrategicReversal: item.tutorStrategicReversal,
        adaptiveMechanismQuality: item.adaptiveMechanismQuality,
        roleSymmetricScores: item.roleSymmetricScores,
        error: item.error || null,
      });
    }
  }
  return rows;
}

function deriveArmFromFile(filename) {
  if (filename.includes('-peripeteia-only-')) return 'peripeteia-only';
  if (filename.includes('-routine-')) return 'routine';
  if (filename.includes('-none-')) return 'none';
  return null;
}

function deriveCriticFromFile(filename) {
  if (filename.includes('qwen')) return 'qwen';
  if (filename.includes('gemini')) return 'gemini';
  if (filename.includes('deepseek')) return 'deepseek';
  if (filename.includes('sonnet') || filename.includes('claude')) return 'sonnet';
  return 'unknown';
}

function dramaIdFromItemId(itemId, iterDir) {
  const planPath = path.join(iterDir, 'batch-plan.json');
  if (!fs.existsSync(planPath)) return null;
  try {
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    for (const unit of plan.units || []) {
      for (const drama of unit.dramas || []) {
        if (drama.tid === itemId) return drama.drama_id;
      }
    }
  } catch (err) {
    return null;
  }
  return null;
}

function buildItemTable(rows, iterDir, cut) {
  const items = new Map();
  for (const row of rows) {
    const drama = dramaIdFromItemId(row.itemId, iterDir);
    const key = `${drama}::${row.arm}::${row.itemId}`;
    if (!items.has(key)) {
      items.set(key, {
        drama,
        arm: row.arm,
        itemId: row.itemId,
        critics: [],
        recognitionVotes: 0,
        actionVotes: 0,
        peripeteiaInducedVotes: 0,
        organicVotes: 0,
        ambiguousVotes: 0,
        noneVotes: 0,
        falseClosureVotes: 0,
      });
    }
    const entry = items.get(key);
    const classification = classifyAt(row, cut);
    entry.critics.push({ critic: row.critic, formClass: row.formClass, class: classification.class });
    if (row.formClass === 'recognition') entry.recognitionVotes += 1;
    if (scoreValue(row.actionalBreakthrough) >= 75) entry.actionVotes += 1;
    entry[
      `${classification.class.replace(/_/g, '')}Votes` === 'peripeteiainducedVotes' ? 'peripeteiaInducedVotes' : null
    ];
    if (classification.class === 'peripeteia_induced') entry.peripeteiaInducedVotes += 1;
    else if (classification.class === 'organic') entry.organicVotes += 1;
    else if (classification.class === 'ambiguous') entry.ambiguousVotes += 1;
    else if (classification.class === 'none') entry.noneVotes += 1;
    else if (classification.class === 'false_closure') entry.falseClosureVotes += 1;
  }
  return [...items.values()];
}

function applyGate(item, gateConfig) {
  const failures = [];
  const isControl = ['routine', 'none'].includes(item.arm);
  const isPeripeteia = item.arm === 'peripeteia-only';
  if (isControl) {
    if (item.recognitionVotes > gateConfig.controlMaxRecognitionVotes) failures.push('control_leak');
  }
  if (isPeripeteia) {
    if (item.recognitionVotes < gateConfig.recognitionVoteCut) failures.push('recognition_not_produced');
    if (item.actionVotes < gateConfig.actionVoteCut) failures.push('action_gap');
    if (item.peripeteiaInducedVotes < gateConfig.originVoteCut) failures.push('organic_or_ambiguous_recognition');
  }
  return { pass: failures.length === 0, failures };
}

function main() {
  const { values } = parseArgs({
    options: {
      'run-prefix': { type: 'string' },
      out: { type: 'string', default: 'exports/recognition-origin-cut-sweep.md' },
    },
    allowPositionals: true,
  });
  const runPrefix =
    values['run-prefix'] || 'config/poetics-calibration/phase2-adaptation-recognition-loop-20260528T022408Z';
  const iterDirs = fs
    .readdirSync(path.dirname(runPrefix))
    .filter((d) => d.startsWith(path.basename(runPrefix)) && /-i0\d$/.test(d))
    .sort()
    .map((d) => path.join(path.dirname(runPrefix), d));

  if (!iterDirs.length) {
    console.error(`no iterations found for prefix ${runPrefix}`);
    process.exit(1);
  }

  const gateConfig = {
    controlMaxRecognitionVotes: 1,
    recognitionVoteCut: 3,
    actionVoteCut: 3,
    originVoteCut: 3,
  };

  const lines = [];
  lines.push('# Recognition-Origin CUT Sweep');
  lines.push('');
  lines.push(`Run: \`${path.basename(runPrefix)}\``);
  lines.push(`Iterations: ${iterDirs.map((d) => path.basename(d)).join(', ')}`);
  lines.push(
    `Gate config: controls <= ${gateConfig.controlMaxRecognitionVotes} recognition vote(s); peripeteia recognition/action/origin >= ${gateConfig.recognitionVoteCut}/${gateConfig.actionVoteCut}/${gateConfig.originVoteCut}`,
  );
  lines.push('');
  lines.push('## Per-CUT summary');
  lines.push('');
  lines.push('| CUT | iter | peripeteia passes | control_leak items | total failures | failure classes |');
  lines.push('|---:|---|---:|---:|---:|---|');

  const detailed = [];
  for (const cut of SWEEP_CUTS) {
    for (const iterDir of iterDirs) {
      const rows = loadIterationScores(iterDir);
      const items = buildItemTable(rows, iterDir, cut);
      const failureCounts = {};
      let periPasses = 0;
      let periItems = 0;
      let controlLeaks = 0;
      let totalFailures = 0;
      for (const item of items) {
        const { pass, failures } = applyGate(item, gateConfig);
        if (item.arm === 'peripeteia-only') {
          periItems += 1;
          if (pass) periPasses += 1;
        }
        if (failures.includes('control_leak')) controlLeaks += 1;
        if (!pass) totalFailures += 1;
        for (const f of failures) failureCounts[f] = (failureCounts[f] || 0) + 1;
        detailed.push({ cut, iter: path.basename(iterDir), ...item, pass, failures });
      }
      const failStr =
        Object.entries(failureCounts)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ') || '-';
      lines.push(
        `| ${cut} | ${path.basename(iterDir).replace(/^.*-(i\d+)$/, '$1')} | ${periPasses}/${periItems} | ${controlLeaks} | ${totalFailures} | ${failStr} |`,
      );
    }
  }
  lines.push('');
  lines.push('## Per-item per-CUT (peripeteia-only arm)');
  lines.push('');
  lines.push('| CUT | iter | drama | item | recog votes | action votes | peri_induced | organic | ambiguous | gate |');
  lines.push('|---:|---|---|---|---:|---:|---:|---:|---:|---|');
  for (const row of detailed) {
    if (row.arm !== 'peripeteia-only') continue;
    lines.push(
      `| ${row.cut} | ${row.iter.replace(/^.*-(i\d+)$/, '$1')} | ${row.drama} | ${row.itemId} | ${row.recognitionVotes} | ${row.actionVotes} | ${row.peripeteiaInducedVotes} | ${row.organicVotes} | ${row.ambiguousVotes} | ${row.pass ? 'PASS' : row.failures.join(',')} |`,
    );
  }
  lines.push('');
  lines.push('## Per-item per-CUT (control arms)');
  lines.push('');
  lines.push('| CUT | iter | drama | arm | item | recog votes | peri_induced (false positive risk) | gate |');
  lines.push('|---:|---|---|---|---|---:|---:|---|');
  for (const row of detailed) {
    if (row.arm === 'peripeteia-only') continue;
    lines.push(
      `| ${row.cut} | ${row.iter.replace(/^.*-(i\d+)$/, '$1')} | ${row.drama} | ${row.arm} | ${row.itemId} | ${row.recognitionVotes} | ${row.peripeteiaInducedVotes} | ${row.pass ? 'PASS' : row.failures.join(',')} |`,
    );
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push(
    '- `recognitionVotes` is the count of critics with `formClass=recognition` (invariant under CUT changes).',
  );
  lines.push('- `peripeteiaInducedVotes` depends on CUT via the classifier in `scripts/lib/recognitionOrigin.js`.');
  lines.push(
    '- `control_leak` is triggered by `recognitionVotes > 1` on routine/none arms — CUT changes do NOT fix it.',
  );
  lines.push(
    '- The relevant question is whether lowering CUT increases peripeteia-only passes without falsely promoting control items to `peripeteia_induced`.',
  );

  const out = values.out;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(`wrote ${out}`);
}

main();
