#!/usr/bin/env node
/**
 * Manipulation check for the fixed-register arms of the edged-register
 * stub-DAG replication (workplan: edged-register-stub-dag-replication).
 *
 * Reads tutor-stub auto-eval summary JSONs and, for every tutor turn under a
 * `fixed_sarcastic` or `fixed_warm` policy, asks the validated manner-presence
 * question (services/registerMannerPresence.js, prompt manner-presence/1.0,
 * 10/10 twice on the hand-marked eyeball set). The question never names an
 * arm, a register, or an outcome, so the read is blind by construction.
 *
 * Two entry points on purpose:
 *   - sharp turns go through the GATED `readMannerPresence` — this is the
 *     arm-level floor (registered: >= 80% of sharp turns realized; below the
 *     floor the study reports NO VERDICT, not a null);
 *   - warm turns go through `readPresenceOfTurn` — a report-only leak check
 *     that states its gate bypass by calling the ungated function. It carries
 *     no floor and gates nothing.
 *
 * The same pass runs the parent block's harm scan report-only: the two
 * deterministic tutor-turn families (personAttackMatches, statusShameMatches)
 * on every target turn, and each match goes to the person-vs-work harm reader
 * (services/edgedRegisterHarmReader.js). Confirmed flags are listed for the
 * operator, who rules on them; the outcome channel never sees any of this.
 *
 * Verdict rules, fixed here and mirrored in the design note:
 *   - a sharp arm with zero turns: no_turns;
 *   - any pin violation (a fixed-policy turn whose selected register is not
 *     the pinned one): no_verdict_pin_violation — a harness defect, not data;
 *   - any sharp turn unread: incomplete — `reader_error:*` gaps heal on a
 *     re-run (failed calls are never cached), `parse_failed:*` gaps do not
 *     (cached on purpose) and need a person;
 *   - otherwise present/turns >= floor: compliant, else noncompliant (which
 *     is NO VERDICT for the study, never a null).
 *
 * Re-running is safe and cheap: every reading is cached by content hash, and
 * `--limit` reads a corpus in pieces the way
 * scripts/read-negative-register-manner-presence.js does.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import { readHarmVerdict } from '../services/edgedRegisterHarmReader.js';
import { MANNER_PRESENCE_PROMPT_VERSION } from '../services/registerMannerPresence.js';
import {
  DEFAULT_PRESENCE_READER,
  presenceReaderLabel,
  readMannerPresence,
  readPresenceOfTurn,
} from '../services/registerMannerPresenceReader.js';
import { personAttackMatches, statusShameMatches } from '../services/registerStanceFidelity.js';
import { TUTOR_STUB_FIXED_REGISTER_POLICIES } from '../services/tutorStubRegisterPolicyComposition.js';

export const FIDELITY_REPORT_SCHEMA = 'machinespirits.stub-fixed-register-fidelity.v1';
export const DEFAULT_PRESENCE_FLOOR = 0.8;

// Same discovery as scripts/analyze-tutor-stub-trajectories.js: files as-is,
// directories walked for auto-eval-*.json, skipping logs/traces/field-svg.
export function walkSummaries(entries) {
  const files = [];
  for (const entry of entries) {
    const full = path.resolve(entry);
    const stat = fs.statSync(full);
    if (stat.isFile()) {
      files.push(full);
      continue;
    }
    const stack = [full];
    while (stack.length) {
      const dir = stack.pop();
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const itemPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          if (!['logs', 'traces'].includes(item.name) && !item.name.endsWith('-field-svg')) stack.push(itemPath);
        } else if (/^auto-eval-.*\.json$/u.test(item.name)) {
          files.push(itemPath);
        }
      }
    }
  }
  return [...new Set(files)].sort();
}

/**
 * Every fixed-policy tutor turn in the given summaries, in a deterministic
 * order (file, run, turn) so `--limit` reads the same prefix every pass.
 * A turn whose selected register is not the policy's pinned register is a
 * pin violation: it is kept as a target (so the defect is counted and shown)
 * but never read — the selector was built to make this state unreachable.
 */
export function collectFixedRegisterTargets(files, { readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  const targets = [];
  for (const file of files) {
    const summary = JSON.parse(readFile(file));
    const profile = summary.config?.autoLearnerProfileId || summary.config?.autoLearnerProfile || 'unknown';
    for (const row of summary.rows || []) {
      for (const example of row.trainingExamples?.examples || []) {
        const policy = example.action?.registerPolicy || example.policy || null;
        const pinnedRegister = TUTOR_STUB_FIXED_REGISTER_POLICIES[policy];
        if (!pinnedRegister) continue;
        const tutorText = String(example.action?.tutorText || '').trim();
        if (!tutorText) continue;
        const selectedRegister = example.action?.selectedRegister || null;
        targets.push({
          file: path.basename(file),
          profile,
          policy,
          pinnedRegister,
          runIndex: row.runIndex ?? null,
          turn: example.turn ?? null,
          selectedRegister,
          pinViolation: selectedRegister !== pinnedRegister,
          tutorText,
          learnerText: String(example.stateBeforeAction?.learnerText || ''),
        });
      }
    }
  }
  targets.sort(
    (a, b) => a.file.localeCompare(b.file) || (a.runIndex ?? 0) - (b.runIndex ?? 0) || (a.turn ?? 0) - (b.turn ?? 0),
  );
  return targets;
}

function unreadClass(reason) {
  const text = String(reason || '');
  if (text.startsWith('reader_error')) return 'reader_error';
  if (text.startsWith('parse_failed')) return 'parse_failed';
  return text || 'unknown';
}

/**
 * One arm's registered verdict. Only the sharp arm carries a floor; the warm
 * arm is always report_only. Every rule here restates the design note — the
 * note is the registration, this is its executable copy.
 */
export function armVerdict({ arm, floor }) {
  if (!arm.turns) return 'no_turns';
  if (arm.pinViolations > 0) return 'no_verdict_pin_violation';
  if (arm.floor === null) return 'report_only';
  if (arm.unread > 0) return 'incomplete';
  return arm.presenceRate >= floor ? 'compliant' : 'noncompliant_no_verdict';
}

export function aggregateArm({ policy, pinnedRegister, results, floor }) {
  const turns = results.length;
  const pinViolations = results.filter((r) => r.pinViolation).length;
  const present = results.filter((r) => r.reading?.status === 'present').length;
  const absent = results.filter((r) => r.reading?.status === 'absent').length;
  const unreadResults = results.filter(
    (r) => !r.pinViolation && r.reading?.status !== 'present' && r.reading?.status !== 'absent',
  );
  const unreadReasons = {};
  for (const r of unreadResults) {
    const cls = unreadClass(r.reading?.reason);
    unreadReasons[cls] = (unreadReasons[cls] || 0) + 1;
  }
  const evidenceMismatches = results.filter((r) => r.reading?.evidenceFoundInTurn === false).length;
  const arm = {
    policy,
    pinnedRegister,
    floor: policy === 'fixed_sarcastic' ? floor : null,
    turns,
    pinViolations,
    present,
    absent,
    unread: unreadResults.length,
    unreadReasons,
    fromCache: results.filter((r) => r.fromCache).length,
    evidenceMismatches,
    presenceRate: turns ? Number((present / turns).toFixed(4)) : null,
  };
  arm.verdict = armVerdict({ arm, floor });
  return arm;
}

function mockPresenceCall(target) {
  // Plumbing-only stand-in: it restates the arm, so it can confirm nothing
  // about the delivery. It exists so the whole pass runs at zero spend. The
  // evidence quotes the turn's own opening words so a mock run does not raise
  // a phantom evidence-mismatch flag and teach the operator to ignore one.
  return async () =>
    target.policy === 'fixed_sarcastic'
      ? `VERDICT: yes\nEVIDENCE: "${target.tutorText.split(/\s+/u).slice(0, 4).join(' ')}"`
      : 'VERDICT: no\nEVIDENCE: none';
}

export async function runFidelityPass({
  files,
  floor = DEFAULT_PRESENCE_FLOOR,
  limit = Infinity,
  mock = false,
  provider = DEFAULT_PRESENCE_READER.provider,
  model = DEFAULT_PRESENCE_READER.model,
  timeoutMs,
  env = process.env,
  log = () => {},
} = {}) {
  const targets = collectFixedRegisterTargets(files);
  const selected = targets.slice(0, limit);
  const skipped = targets.length - selected.length;

  const results = [];
  for (const [index, target] of selected.entries()) {
    if (target.pinViolation) {
      results.push({ ...target, reading: null, fromCache: false });
      log(`[${index + 1}/${selected.length}] PIN VIOLATION ${target.file}#run${target.runIndex} turn ${target.turn}`);
      continue;
    }
    const readerArgs = {
      learnerMessage: target.learnerText,
      tutorMessage: target.tutorText,
      provider,
      model,
      timeoutMs,
      env,
      // Mock answers must never enter the shared cache under the real
      // reader's key, so mock mode reads and writes no cache at all.
      cache: !mock,
      ...(mock ? { callText: mockPresenceCall(target) } : {}),
    };
    const { reading, fromCache } =
      target.policy === 'fixed_sarcastic'
        ? await readMannerPresence({ registerName: target.pinnedRegister, ...readerArgs })
        : await readPresenceOfTurn(readerArgs); // warm leak check: deliberate report-only gate bypass
    results.push({ ...target, reading, fromCache });
    log(
      `[${index + 1}/${selected.length}] ${target.policy} ${target.file}#run${target.runIndex} turn ${target.turn}: ` +
        `${reading.status}${fromCache ? ' (cache)' : ''}`,
    );
  }

  // Harm scan, both arms, report-only. The deterministic families select the
  // turns; the reader answers person-vs-work; the operator rules on confirmed
  // flags. A failed harm read is an unresolved flag, never a dropped one.
  const harmFlags = [];
  for (const target of selected) {
    const families = [
      ['person_attack', personAttackMatches(target.tutorText)],
      ['status_shame', statusShameMatches(target.tutorText)],
    ];
    for (const [family, matches] of families) {
      for (const match of matches) {
        const flag = {
          family,
          match,
          policy: target.policy,
          profile: target.profile,
          file: target.file,
          runIndex: target.runIndex,
          turn: target.turn,
        };
        try {
          flag.verdict = await readHarmVerdict(
            {
              learnerBefore: target.learnerText,
              tutorMessage: target.tutorText,
              match,
              rowId: `${target.file}#run${target.runIndex}`,
              turnIndex: target.turn,
            },
            { model, mock },
          );
        } catch (error) {
          flag.error = error.message;
        }
        harmFlags.push(flag);
      }
    }
  }

  const arms = {};
  for (const [policy, pinnedRegister] of Object.entries(TUTOR_STUB_FIXED_REGISTER_POLICIES)) {
    arms[policy] = aggregateArm({
      policy,
      pinnedRegister,
      results: results.filter((r) => r.policy === policy),
      floor,
    });
  }

  return {
    schema: FIDELITY_REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    promptVersion: MANNER_PRESENCE_PROMPT_VERSION,
    reader: presenceReaderLabel({ provider, model }),
    mock,
    floor,
    files: files.map((file) => path.basename(file)),
    targetCount: targets.length,
    readCount: selected.length,
    skippedByLimit: skipped,
    arms,
    harm: {
      scanned: selected.length,
      flagged: harmFlags.length,
      confirmed: harmFlags.filter((flag) => flag.verdict?.attacksPerson).length,
      unresolved: harmFlags.filter((flag) => flag.error).length,
      flags: harmFlags,
    },
    turns: results.map(({ tutorText: _tutorText, learnerText: _learnerText, ...rest }) => ({
      ...rest,
      reading: rest.reading
        ? {
            status: rest.reading.status,
            reason: rest.reading.reason,
            evidence: rest.reading.evidence,
            evidenceFoundInTurn: rest.reading.evidenceFoundInTurn,
          }
        : null,
    })),
  };
}

export function renderMarkdown(report) {
  const lines = [
    '# Fixed-register fidelity read',
    '',
    `- Schema: ${report.schema}`,
    `- Question: ${report.promptVersion} (validated instrument; blind to arms and outcomes)`,
    `- Reader: ${report.reader}${report.mock ? ' — MOCK MODE, plumbing only, no claim about the delivery' : ''}`,
    `- Registered sharp-arm floor: ${report.floor}`,
    `- Targets: ${report.targetCount} fixed-policy tutor turns in ${report.files.length} summary file(s); read ${report.readCount}, deferred by --limit ${report.skippedByLimit}`,
    '',
    '| Arm | Pinned | Turns | Present | Absent | Unread | Pin violations | Presence rate | Verdict |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const arm of Object.values(report.arms)) {
    lines.push(
      `| ${arm.policy} | ${arm.pinnedRegister} | ${arm.turns} | ${arm.present} | ${arm.absent} | ${arm.unread} | ${arm.pinViolations} | ${arm.presenceRate ?? '—'} | ${arm.verdict} |`,
    );
  }
  lines.push('');
  const sharp = report.arms.fixed_sarcastic;
  if (sharp?.verdict === 'incomplete') {
    const sticky = sharp.unreadReasons.parse_failed || 0;
    lines.push(
      `**Incomplete: ${sharp.unread} sharp turn(s) unread — no verdict.** ` +
        (sticky
          ? `${sticky} are cached parse failures a re-run will NOT heal; a person must look at those turns. `
          : '') +
        'Re-run this pass to retry the rest (failed calls are never cached).',
      '',
    );
  }
  if (sharp?.verdict === 'noncompliant_no_verdict') {
    lines.push(
      `**Sharp arm below the registered floor (${sharp.presenceRate} < ${report.floor}): the arm is noncompliant and the study reports NO VERDICT, not a null.**`,
      '',
    );
  }
  if (sharp?.verdict === 'no_verdict_pin_violation') {
    lines.push(
      `**${sharp.pinViolations} pin violation(s): a fixed-policy turn carried the wrong register. Harness defect — no verdict until it is explained.**`,
      '',
    );
  }
  const warm = report.arms.fixed_warm;
  if (warm?.present > 0) {
    lines.push(`**Leak check: ${warm.present} warm-arm turn(s) read as edged (report-only).**`, '');
  }
  lines.push(
    '## Harm scan (report-only, operator rules on confirmed flags)',
    '',
    `- Turns scanned: ${report.harm.scanned}; word-list matches: ${report.harm.flagged}; confirmed person-attacks: ${report.harm.confirmed}; unresolved reads: ${report.harm.unresolved}`,
  );
  for (const flag of report.harm.flags) {
    const status = flag.error
      ? `UNRESOLVED (${flag.error})`
      : flag.verdict.attacksPerson
        ? `CONFIRMED — ${flag.verdict.reason}`
        : `cleared — ${flag.verdict.reason}`;
    lines.push(
      `- ${flag.policy} ${flag.file}#run${flag.runIndex} turn ${flag.turn} [${flag.family}: "${flag.match}"]: ${status}`,
    );
  }
  if (sharp?.evidenceMismatches || warm?.evidenceMismatches) {
    lines.push(
      '',
      `Evidence-quote mismatches (recorded, not enforced — for a person to look at): sharp ${sharp?.evidenceMismatches || 0}, warm ${warm?.evidenceMismatches || 0}.`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function usage() {
  console.log(`Usage:
  node scripts/read-stub-fixed-register-fidelity.js <summary.json|dir>... [options]

Options:
  --floor <fraction>  registered sharp-arm presence floor (default: ${DEFAULT_PRESENCE_FLOOR})
  --limit <n>         read only the first n targets this pass (safe re-run; cached reads are free)
  --mock              deterministic stand-ins for both readers; zero spend, no cache writes, no claim
  --model <name>      reader model (default: ${DEFAULT_PRESENCE_READER.model} on ${DEFAULT_PRESENCE_READER.provider})
  --timeout-ms <n>    per-call timeout override
  --out <path>        write the report (markdown, or JSON with --json)
  --json              emit JSON instead of markdown
`);
}

async function main() {
  const { values: args, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      floor: { type: 'string', default: String(DEFAULT_PRESENCE_FLOOR) },
      limit: { type: 'string', default: '' },
      mock: { type: 'boolean', default: false },
      model: { type: 'string', default: DEFAULT_PRESENCE_READER.model },
      'timeout-ms': { type: 'string', default: '' },
      out: { type: 'string', default: '' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (args.help || !positionals.length) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const floor = Number(args.floor);
  if (!Number.isFinite(floor) || floor <= 0 || floor > 1) throw new Error('--floor must be in (0, 1]');
  const limit = args.limit ? Number(args.limit) : Infinity;
  if (args.limit && (!Number.isFinite(limit) || limit < 1)) throw new Error('--limit must be a positive number');

  const files = walkSummaries(positionals);
  if (!files.length) throw new Error('no auto-eval summary JSONs found in the given paths');

  const report = await runFidelityPass({
    files,
    floor,
    limit,
    mock: args.mock,
    model: args.model,
    timeoutMs: args['timeout-ms'] ? Number(args['timeout-ms']) : undefined,
    log: (line) => console.error(line),
  });

  const rendered = args.json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), rendered);
    console.error(`wrote ${args.out}`);
  }
  console.log(rendered);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
