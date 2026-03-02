#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const AUDIT_SCRIPT = path.join(ROOT, 'scripts', 'validate-provable-discourse.js');
const RECONSTRUCT_SCRIPT = path.join(ROOT, 'scripts', 'reconstruct-provable-paper.js');
const DEFAULT_CODEX_MODEL = 'gpt-5.2-codex';

function toLocalDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function usage() {
  console.log(`Usage:
  node scripts/paper-provable-discourse-chat.js [options] [-- <extra-audit-args>]

Options:
  --strict
  --smoke
  --refresh-snapshot
  --spec <path>               (default: config/provable-discourse.yaml)
  --audit-json <path>         (default: notes/provable-discourse.latest.json)
  --todo-md <path>            (default: notes/provable-discourse-todos-YYYY-MM-DD.md)
  --reconstruct-paper [path]  Build validatable-only reconstructed paper (optional out path)
  --reconstruct-diff <path>   Diff output path for reconstruction
  --no-reconstruct-paper      Disable reconstruction
  --augment-evidence          (ask Codex to propose/patch evidence/assertions)
  --no-augment-evidence       (analysis-only prompt; no augmentation tasking)
  --take-action               (opt-in action mode: implies --augment-evidence + --full-auto)
  --full-auto                 (pass --full-auto to Codex)
  --allow-paper-edits         (allow Codex to edit docs/research/paper-full.md)
  --no-paper-edits            (default; Codex must not edit paper text)
  --no-todo                   (do not write TODO markdown output)
  --prompt <text>             (override default Codex seed prompt)
  --model <id>                (default: gpt-5.2-codex)
  --codex-arg <arg>           (repeatable; extra Codex CLI arg)
  --no-full-auto              (do not pass --full-auto)
  --no-codex                  (run audit + write JSON, but do not launch Codex)
  --help

Examples:
  npm run paper:provable-discourse:chat
  npm run paper:provable-discourse:chat -- --smoke
  npm run paper:provable-discourse:chat -- --reconstruct-paper
  npm run paper:provable-discourse:chat -- --take-action
  npm run paper:provable-discourse:chat -- --strict --refresh-snapshot
  npm run paper:provable-discourse:chat -- --model gpt-5.2-codex
  npm run paper:provable-discourse:chat -- --spec config/provable-discourse.yaml --codex-arg "-m" --codex-arg "gpt-5"
`);
}

function takeValue(argv, i, flag) {
  const token = argv[i];
  if (token === flag) {
    if (i + 1 >= argv.length) {
      throw new Error(`Missing value for ${flag}`);
    }
    return { value: argv[i + 1], nextIndex: i + 1 };
  }
  if (token.startsWith(`${flag}=`)) {
    return { value: token.slice(flag.length + 1), nextIndex: i };
  }
  return null;
}

function parseArgs(argv) {
  const opts = {
    strict: false,
    smoke: false,
    refreshSnapshot: false,
    spec: 'config/provable-discourse.yaml',
    auditJson: path.join('notes', 'provable-discourse.latest.json'),
    todoMd: path.join('notes', `provable-discourse-todos-${toLocalDateStamp()}.md`),
    reconstructPaper: false,
    reconstructOutPath: null,
    reconstructDiffPath: null,
    augmentEvidence: false,
    allowPaperEdits: false,
    prompt: null,
    model: DEFAULT_CODEX_MODEL,
    codexArgs: [],
    fullAuto: false,
    takeAction: false,
    noCodex: false,
    auditPassthrough: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === '--') {
      opts.auditPassthrough.push(...argv.slice(i + 1));
      break;
    }
    if (token === '--help' || token === '-h') {
      opts.help = true;
      continue;
    }
    if (token === '--strict') {
      opts.strict = true;
      continue;
    }
    if (token === '--smoke') {
      opts.smoke = true;
      continue;
    }
    if (token === '--refresh-snapshot') {
      opts.refreshSnapshot = true;
      continue;
    }
    if (token === '--take-action') {
      opts.takeAction = true;
      opts.augmentEvidence = true;
      opts.fullAuto = true;
      continue;
    }
    if (token.startsWith('--reconstruct-paper=')) {
      opts.reconstructPaper = true;
      opts.reconstructOutPath = token.slice('--reconstruct-paper='.length) || null;
      continue;
    }
    if (token === '--reconstruct-paper') {
      opts.reconstructPaper = true;
      const next = argv[i + 1];
      if (next != null && !next.startsWith('--')) {
        opts.reconstructOutPath = next;
        i++;
      }
      continue;
    }
    if (token === '--no-reconstruct-paper') {
      opts.reconstructPaper = false;
      opts.reconstructOutPath = null;
      continue;
    }
    if (token === '--full-auto') {
      opts.fullAuto = true;
      continue;
    }
    if (token === '--allow-paper-edits') {
      opts.allowPaperEdits = true;
      continue;
    }
    if (token === '--no-paper-edits') {
      opts.allowPaperEdits = false;
      continue;
    }
    if (token === '--no-full-auto') {
      opts.fullAuto = false;
      continue;
    }
    if (token === '--augment-evidence') {
      opts.augmentEvidence = true;
      continue;
    }
    if (token === '--no-augment-evidence') {
      opts.augmentEvidence = false;
      continue;
    }
    if (token === '--no-todo') {
      opts.todoMd = null;
      continue;
    }
    if (token === '--no-codex') {
      opts.noCodex = true;
      continue;
    }

    const specValue = takeValue(argv, i, '--spec');
    if (specValue) {
      opts.spec = specValue.value;
      i = specValue.nextIndex;
      continue;
    }

    const auditJsonValue = takeValue(argv, i, '--audit-json');
    if (auditJsonValue) {
      opts.auditJson = auditJsonValue.value;
      i = auditJsonValue.nextIndex;
      continue;
    }
    const reconstructDiffValue = takeValue(argv, i, '--reconstruct-diff');
    if (reconstructDiffValue) {
      opts.reconstructDiffPath = reconstructDiffValue.value;
      i = reconstructDiffValue.nextIndex;
      continue;
    }
    const todoMdValue = takeValue(argv, i, '--todo-md');
    if (todoMdValue) {
      opts.todoMd = todoMdValue.value;
      i = todoMdValue.nextIndex;
      continue;
    }

    const promptValue = takeValue(argv, i, '--prompt');
    if (promptValue) {
      opts.prompt = promptValue.value;
      i = promptValue.nextIndex;
      continue;
    }

    const modelValue = takeValue(argv, i, '--model');
    if (modelValue) {
      opts.model = modelValue.value;
      i = modelValue.nextIndex;
      continue;
    }

    const codexArgValue = takeValue(argv, i, '--codex-arg');
    if (codexArgValue) {
      opts.codexArgs.push(codexArgValue.value);
      i = codexArgValue.nextIndex;
      continue;
    }

    opts.auditPassthrough.push(token);
  }

  return opts;
}

function toRepoRelative(p) {
  const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
  return path.relative(ROOT, abs);
}

function collectIdsByStatus(report, status) {
  const ids = [];
  const buckets = [report?.claims, report?.symmetry, report?.coverage];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      if (item?.status === status && item?.id) {
        ids.push(item.id);
      }
    }
  }
  return ids;
}

function summarizeAudit(parsed) {
  const summary = parsed?.summary || { pass: 0, warn: 0, fail: 0 };
  const failedChecks = collectIdsByStatus(parsed, 'fail');
  const warnedChecks = collectIdsByStatus(parsed, 'warn');
  return { summary, failedChecks, warnedChecks };
}

function buildSeedPrompt({
  auditPathRel,
  todoPathRel,
  auditExitCode,
  summary,
  failedChecks,
  warnedChecks,
  augmentEvidence,
  allowPaperEdits,
  reconstructionPathRel,
  reconstructionDiffPathRel,
  override,
}) {
  if (override && override.trim()) {
    return override.trim();
  }
  const lines = [
    'Analyze the latest provable-discourse audit and help me plan fixes.',
    `Audit JSON: ${auditPathRel}`,
    `TODO Markdown: ${todoPathRel || '(not written)'}`,
    `Audit exit code: ${auditExitCode}`,
    `Summary: pass=${summary.pass || 0}, warn=${summary.warn || 0}, fail=${summary.fail || 0}`,
    `Failed IDs: ${failedChecks.join(', ') || '(none)'}`,
    `Warn IDs: ${warnedChecks.join(', ') || '(none)'}`,
    `Reconstructed paper: ${reconstructionPathRel || '(not generated)'}`,
    `Reconstruction diff: ${reconstructionDiffPathRel || '(not generated)'}`,
    'Tasks:',
    '1) Group failures by stale claim, mapping gap, or evidence mismatch.',
    '2) Propose an ordered fix plan with concrete files/commands.',
    '3) Highlight which fixes are textual (paper/manifest) vs code-level (evidence adapters/tests).',
  ];

  if (augmentEvidence) {
    lines.push(
      '4) Implement augmentation directly: update/add evidence + assertions for failing claims in provable-discourse configs.',
    );
    lines.push(
      '5) Prioritize edits in config/provable-discourse.manual.yaml and config/provable-discourse.yaml; regenerate deterministic mappings only via bootstrap script.',
    );
    lines.push(
      '6) Re-run `npm run paper:provable-discourse` and iterate until fail count decreases; summarize exact residual failures.',
    );
  } else {
    lines.push('4) Review mode: focus on TODO quality and next-step recommendations.');
    lines.push('Then wait for my follow-up questions.');
  }

  if (!allowPaperEdits) {
    lines.push('Constraint: Do not modify docs/research/paper-full.md in this session.');
  } else {
    lines.push('Constraint relaxed: paper edits are allowed if explicitly needed.');
  }

  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    process.exit(0);
  }

  if (!fs.existsSync(AUDIT_SCRIPT)) {
    console.error(`Audit script not found: ${AUDIT_SCRIPT}`);
    process.exit(1);
  }
  if (opts.reconstructPaper && !fs.existsSync(RECONSTRUCT_SCRIPT)) {
    console.error(`Reconstruct script not found: ${RECONSTRUCT_SCRIPT}`);
    process.exit(1);
  }

  const auditArgs = [AUDIT_SCRIPT, '--json', '--spec', opts.spec];
  if (opts.strict) auditArgs.push('--strict');
  if (opts.smoke) auditArgs.push('--smoke');
  if (opts.refreshSnapshot) auditArgs.push('--refresh-snapshot');
  if (opts.todoMd) auditArgs.push('--write-todo', opts.todoMd);
  if (opts.auditPassthrough.length > 0) {
    auditArgs.push(...opts.auditPassthrough);
  }

  console.log('Running provable-discourse audit...');
  const audit = spawnSync(process.execPath, auditArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (audit.error) {
    console.error(`Audit execution failed: ${audit.error.message}`);
    process.exit(1);
  }

  const stdout = (audit.stdout || '').trim();
  const stderr = (audit.stderr || '').trim();

  if (!stdout) {
    if (stderr) {
      console.error(stderr);
    }
    console.error('Audit produced no JSON output.');
    process.exit(audit.status ?? 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    if (stderr) {
      console.error(stderr);
    }
    console.error(`Could not parse audit JSON: ${error.message}`);
    process.exit(audit.status ?? 1);
  }

  const auditPathRel = toRepoRelative(opts.auditJson);
  const auditPathAbs = path.join(ROOT, auditPathRel);
  fs.mkdirSync(path.dirname(auditPathAbs), { recursive: true });
  fs.writeFileSync(auditPathAbs, JSON.stringify(parsed, null, 2), 'utf8');
  const todoPathRel = parsed.todo_written ? toRepoRelative(parsed.todo_written) : null;

  const { summary, failedChecks, warnedChecks } = summarizeAudit(parsed);
  const auditExitCode = audit.status ?? 1;
  let reconstructionSummary = null;

  if (opts.reconstructPaper) {
    const reconstructArgs = [RECONSTRUCT_SCRIPT, '--spec', opts.spec, '--json'];
    if (opts.reconstructOutPath) reconstructArgs.push('--out', opts.reconstructOutPath);
    if (opts.reconstructDiffPath) reconstructArgs.push('--diff-out', opts.reconstructDiffPath);
    const reconstruct = spawnSync(process.execPath, reconstructArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    if (reconstruct.error) {
      console.error(`Reconstruction failed: ${reconstruct.error.message}`);
      process.exit(1);
    }
    const reconStdout = (reconstruct.stdout || '').trim();
    if (!reconStdout) {
      const reconErr = (reconstruct.stderr || '').trim();
      console.error(reconErr || 'Reconstruction produced no output.');
      process.exit(1);
    }
    try {
      reconstructionSummary = JSON.parse(reconStdout);
    } catch (error) {
      const reconErr = (reconstruct.stderr || '').trim();
      if (reconErr) console.error(reconErr);
      console.error(`Could not parse reconstruction JSON: ${error.message}`);
      process.exit(1);
    }
  }

  console.log(
    `Audit complete (exit=${auditExitCode}) :: pass=${summary.pass || 0} warn=${summary.warn || 0} fail=${summary.fail || 0}`,
  );
  console.log(`Saved audit JSON: ${auditPathRel}`);
  if (parsed.todo_written) {
    console.log(`Saved TODO markdown: ${parsed.todo_written}`);
  }
  if (reconstructionSummary?.out_path) {
    console.log(`Saved reconstructed paper: ${reconstructionSummary.out_path}`);
  }
  if (reconstructionSummary?.diff_out_path) {
    console.log(`Saved reconstruction diff: ${reconstructionSummary.diff_out_path}`);
  }
  if (stderr) {
    console.log('Audit stderr:');
    console.log(stderr);
  }

  if (opts.noCodex) {
    process.exit(auditExitCode);
  }

  const codexArgsHasModel = opts.codexArgs.some(
    (arg) => arg === '-m' || arg === '--model' || arg.startsWith('--model='),
  );
  const codexArgs = [];
  if (opts.fullAuto) codexArgs.push('--full-auto');
  if (!codexArgsHasModel && opts.model) {
    codexArgs.push('-m', opts.model);
  }
  codexArgs.push(...opts.codexArgs);
  codexArgs.push(
    buildSeedPrompt({
      auditPathRel,
      todoPathRel,
      auditExitCode,
      summary,
      failedChecks,
      warnedChecks,
      augmentEvidence: opts.augmentEvidence,
      allowPaperEdits: opts.allowPaperEdits,
      reconstructionPathRel: reconstructionSummary?.out_path || null,
      reconstructionDiffPathRel: reconstructionSummary?.diff_out_path || null,
      override: opts.prompt,
    }),
  );

  console.log('Launching Codex interactive session...');
  const codex = spawn('codex', codexArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  codex.on('error', (error) => {
    console.error(`Could not launch codex: ${error.message}`);
    process.exit(1);
  });

  codex.on('exit', (code, signal) => {
    if (signal) {
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
}

main();
