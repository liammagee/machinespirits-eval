#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const AUDIT_SCRIPT = path.join(ROOT, 'scripts', 'validate-bug-claims.js');
const DEFAULT_CODEX_MODEL = 'gpt-5.2-codex';

function usage() {
  console.log(`Usage:
  node scripts/paper-bug-audit-chat.js [options] [-- <extra-audit-args>]

Options:
  --strict
  --include-all-runs
  --skip-command-checks
  --no-skip-command-checks
  --skip-claims-suite
  --claim-report <path>        (default: notes/paper-claim-audit.json)
  --audit-json <path>          (default: notes/paper-bug-audit.latest.json)
  --prompt <text>              (override default Codex seed prompt)
  --model <id>                 (default: gpt-5.2-codex)
  --codex-arg <arg>            (repeatable; extra Codex CLI arg)
  --no-full-auto               (do not add --full-auto)
  --no-codex                   (run audit + write JSON, but do not launch Codex)
  --help

Examples:
  npm run paper:bug-audit:chat
  npm run paper:bug-audit:chat -- --include-all-runs
  npm run paper:bug-audit:chat -- --model gpt-5.2-codex
  npm run paper:bug-audit:chat -- --strict --codex-arg "-m" --codex-arg "gpt-5"
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
    includeAllRuns: false,
    skipCommandChecks: true,
    skipClaimsSuite: false,
    claimReport: path.join('notes', 'paper-claim-audit.json'),
    auditJson: path.join('notes', 'paper-bug-audit.latest.json'),
    prompt: null,
    model: DEFAULT_CODEX_MODEL,
    codexArgs: [],
    fullAuto: true,
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
    if (token === '--include-all-runs') {
      opts.includeAllRuns = true;
      continue;
    }
    if (token === '--skip-command-checks') {
      opts.skipCommandChecks = true;
      continue;
    }
    if (token === '--no-skip-command-checks') {
      opts.skipCommandChecks = false;
      continue;
    }
    if (token === '--skip-claims-suite') {
      opts.skipClaimsSuite = true;
      continue;
    }
    if (token === '--no-full-auto') {
      opts.fullAuto = false;
      continue;
    }
    if (token === '--no-codex') {
      opts.noCodex = true;
      continue;
    }

    const claimReportValue = takeValue(argv, i, '--claim-report');
    if (claimReportValue) {
      opts.claimReport = claimReportValue.value;
      i = claimReportValue.nextIndex;
      continue;
    }

    const auditJsonValue = takeValue(argv, i, '--audit-json');
    if (auditJsonValue) {
      opts.auditJson = auditJsonValue.value;
      i = auditJsonValue.nextIndex;
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

function summarizeAudit(parsed) {
  const checks = Array.isArray(parsed?.checks) ? parsed.checks : [];
  const failedChecks = checks.filter((check) => check.status === 'fail').map((check) => check.id);
  const warnedChecks = checks.filter((check) => check.status === 'warn').map((check) => check.id);
  const summary = parsed?.summary || { pass: 0, warn: 0, fail: 0 };
  return { summary, failedChecks, warnedChecks };
}

function toRepoRelative(p) {
  const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
  return path.relative(ROOT, abs);
}

function buildSeedPrompt({ auditPathRel, claimReportRel, auditExitCode, summary, failedChecks, warnedChecks, override }) {
  if (override && override.trim()) {
    return override.trim();
  }
  return [
    'Analyze the latest paper bug audit and help me plan fixes.',
    `Audit JSON: ${auditPathRel}`,
    `Claim report JSON: ${claimReportRel}`,
    `Audit exit code: ${auditExitCode}`,
    `Summary: pass=${summary.pass || 0}, warn=${summary.warn || 0}, fail=${summary.fail || 0}`,
    `Failed checks: ${failedChecks.join(', ') || '(none)'}`,
    `Warn checks: ${warnedChecks.join(', ') || '(none)'}`,
    'Tasks:',
    '1) Summarize failures by severity and likely root cause.',
    '2) Propose an ordered fix plan with concrete commands/files.',
    '3) Identify which fixes would most change paper conclusions.',
    'Then wait for my follow-up questions.',
  ].join('\n');
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

  const auditArgs = [AUDIT_SCRIPT, '--json'];
  if (opts.strict) auditArgs.push('--strict');
  if (opts.includeAllRuns) auditArgs.push('--include-all-runs');
  if (opts.skipCommandChecks) auditArgs.push('--skip-command-checks');
  if (opts.skipClaimsSuite) auditArgs.push('--skip-claims-suite');
  if (opts.claimReport) auditArgs.push('--claim-report', opts.claimReport);
  if (opts.auditPassthrough.length > 0) {
    auditArgs.push(...opts.auditPassthrough);
  }

  console.log('Running paper bug audit...');
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

  const claimReportRel = toRepoRelative(opts.claimReport);
  const { summary, failedChecks, warnedChecks } = summarizeAudit(parsed);
  const auditExitCode = audit.status ?? 1;

  console.log(
    `Audit complete (exit=${auditExitCode}) :: pass=${summary.pass || 0} warn=${summary.warn || 0} fail=${summary.fail || 0}`,
  );
  console.log(`Saved audit JSON: ${auditPathRel}`);
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
      claimReportRel,
      auditExitCode,
      summary,
      failedChecks,
      warnedChecks,
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
