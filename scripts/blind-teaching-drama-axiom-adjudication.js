#!/usr/bin/env node
/**
 * A19 deterministic blind adjudication scaffold.
 *
 * This is a fixture-only adapter over the A18 blind option matcher. It reads S0
 * and S1 public transcripts, performs mechanical post-hoc alias matching, and
 * emits the A19 card verdict. It does not call paid critics or license new
 * empirical claims.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { matchesAny } from './blind-option-adjudication.js';
import { classifyCardVerdict } from './validate-teaching-drama-axiom-protocol.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PROTOCOL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-protocol.yaml');
const CLI_TIMEOUT_MS = 240_000;
const CLI_ATTEMPTS = 3;

const REPAIR_TYPES = [
  'revoice_claim',
  'name_warrant',
  'preserve_struggle',
  'offer_diagnostic_options',
  'introduce_complication',
  'ask_scope_test',
  'repair_misalignment',
  'transfer_control',
  'validate_redirect',
  'repeat_explanation',
  'praise_close',
  'insist_effort',
  'restate_norm',
  'restate_rubric',
  'other',
  'unclear',
];

const BASIS_LABELS = [
  'named_relation',
  'ordinary_public_inference',
  'registered_relation_without_policy',
  'validation_redirect',
  'repeated_explanation',
  'surface_agreement',
  'no_commitment',
  'other',
  'unclear',
];

function usage() {
  return `Usage:
  node scripts/blind-teaching-drama-axiom-adjudication.js \\
    --s0 PATH --s1 PATH \\
    --target-aliases "repair rupture|name the target" \\
    --decoy-aliases "insist on effort|restate the rubric" \\
    [--option-space "repair A | repair B | repair C"] \\
    [--target-repair-type ask_scope_test] \\
    [--decoy-repair-types "validate_redirect|repeat_explanation"] \\
    [--protocol config/teaching-drama-axioms/a19-protocol.yaml] \\
    [--family-id ID] [--sibling-id ID] [--out PATH.json] [--run-id ID] \\
    [--mock | --free-text] [--critics N] [--model MODEL]

A19 fixture mode is --mock. Real mode is free-text blind extraction through the
Claude CLI; aliases and arm provenance remain withheld from the critic.`;
}

function splitAliases(value) {
  return String(value || '')
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    protocol: DEFAULT_PROTOCOL,
    targetAliases: [],
    decoyAliases: [],
    targetRepairType: null,
    decoyRepairTypes: [],
    mock: false,
    freeText: false,
    critics: 1,
    model: null,
    familyId: null,
    siblingId: null,
    runId: null,
    optionSpace: null,
    out: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--protocol') args.protocol = path.resolve(argv[++i]);
    else if (token === '--s0') args.s0 = path.resolve(argv[++i]);
    else if (token === '--s1') args.s1 = path.resolve(argv[++i]);
    else if (token === '--target-aliases') args.targetAliases = splitAliases(argv[++i]);
    else if (token === '--decoy-aliases') args.decoyAliases = splitAliases(argv[++i]);
    else if (token === '--target-repair-type') args.targetRepairType = normalizeRepairType(argv[++i]);
    else if (token === '--decoy-repair-types') args.decoyRepairTypes = splitAliases(argv[++i]).map(normalizeRepairType);
    else if (token === '--option-space') args.optionSpace = argv[++i];
    else if (token === '--family-id') args.familyId = argv[++i];
    else if (token === '--sibling-id') args.siblingId = argv[++i];
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--mock') args.mock = true;
    else if (token === '--free-text') args.freeText = true;
    else if (token === '--critics') args.critics = Number(argv[++i]);
    else if (token === '--model') args.model = argv[++i];
    else if (token === '--single-arm') args.singleArm = path.resolve(argv[++i]);
    else if (token === '--arm-label') args.armLabel = argv[++i];
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!args.mock) args.freeText = true;
  if (!Number.isInteger(args.critics) || args.critics < 1) throw new Error('--critics must be a positive integer');
  if (args.singleArm) {
    if (!fs.existsSync(args.singleArm)) throw new Error(`single-arm transcript not found: ${args.singleArm}`);
    args.armLabel = args.armLabel || 'single_arm';
  } else if (!args.s0 || !args.s1) {
    throw new Error(`--s0 and --s1 are required unless --single-arm is passed\n\n${usage()}`);
  }
  if (!args.targetAliases.length) throw new Error('--target-aliases is required');
  if (!args.decoyAliases.length) throw new Error('--decoy-aliases is required');
  if (!args.singleArm && !fs.existsSync(args.s0)) throw new Error(`S0 transcript not found: ${args.s0}`);
  if (!args.singleArm && !fs.existsSync(args.s1)) throw new Error(`S1 transcript not found: ${args.s1}`);
  args.runId = args.runId || `a19-blind-${Date.now()}`;
  return args;
}

function readProtocol(protocolPath) {
  return yaml.parse(fs.readFileSync(protocolPath, 'utf8'));
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function sha256Short(text) {
  return createHash('sha256')
    .update(String(text || ''))
    .digest('hex')
    .slice(0, 16);
}

function normalizeRepairType(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const aliases = {
    scope_test: 'ask_scope_test',
    scope_test_before_redirect: 'ask_scope_test',
    action_gate: 'transfer_control',
    action_gate_before_closure: 'transfer_control',
    concrete_test: 'transfer_control',
    validate_then_redirect: 'validate_redirect',
    explain_more_slowly: 'repeat_explanation',
    repeat_the_explanation: 'repeat_explanation',
    praise_and_close: 'praise_close',
    praise_the_concern: 'praise_close',
    restate_the_norm: 'restate_norm',
    restate_the_rubric: 'restate_rubric',
    insist_on_effort: 'insist_effort',
    insist_on_effort_before_clarifying: 'insist_effort',
    repair_rupture_before_next_step: 'repair_misalignment',
    claim_test_not_character_read: 'name_warrant',
  };
  return aliases[normalized] || normalized || null;
}

function finalTutorSegment(transcript) {
  const text = String(transcript || '');
  const matches = [...text.matchAll(/^TUTOR:\s*(.+)$/gim)];
  if (!matches.length) return text.slice(-800);
  return matches[matches.length - 1][1];
}

export function classifyTranscriptArm({ label, transcriptPath, targetAliases, decoyAliases }) {
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  const segment = finalTutorSegment(transcript);
  const targetHits = targetAliases.filter((alias) => matchesAny(segment, [alias]));
  const decoyHits = decoyAliases.filter((alias) => matchesAny(segment, [alias]));
  let committedOptionClass = 'neither';
  let basisLabel = 'no_commitment';
  const artifactFlags = [];
  if (targetHits.length && !decoyHits.length) {
    committedOptionClass = 'target';
    basisLabel = 'target_alias_posthoc_match';
  } else if (decoyHits.length && !targetHits.length) {
    committedOptionClass = 'decoy';
    basisLabel = 'decoy_alias_posthoc_match';
  } else if (targetHits.length && decoyHits.length) {
    committedOptionClass = 'neither';
    basisLabel = 'ambiguous_alias_match';
    artifactFlags.push('critic_split');
  }
  return {
    label,
    transcript_path: repoRel(transcriptPath),
    committed_option_class: committedOptionClass,
    basis_label: basisLabel,
    artifact_flags: artifactFlags,
    target_alias_hits: targetHits,
    decoy_alias_hits: decoyHits,
    inspected_public_segment: segment,
  };
}

function parseJsonLoose(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      /* fall through */
    }
  }
  return null;
}

function majority(values) {
  const counts = new Map();
  for (const value of values) {
    const key = value === null || value === undefined || value === '' ? 'null' : String(value).trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bestKey = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  return {
    value: bestKey === 'null' ? null : bestKey,
    votes: bestCount,
    total: values.length,
    distribution: Object.fromEntries(counts),
  };
}

function freeTextPromptFor(transcript, args) {
  const lines = [
    'You are given ONE public tutoring dialogue. Read only the public dialogue.',
    'Your task is extraction, not grading: report what teaching repair the tutor finally commits to.',
    'You do not know whether this is a control or policy-memory arm. You do not know the target or decoy aliases.',
    'Do not infer the answer key. Do not compare against another transcript.',
    '',
    'DIALOGUE:',
    '"""',
    transcript.trim(),
    '"""',
    '',
  ];
  if (args.optionSpace) {
    lines.push(
      `Neutral option space shown for orientation only: ${args.optionSpace}.`,
      'This list does not identify the correct repair.',
      '',
    );
  }
  lines.push(
    'Repair-type guide for extraction:',
    '- transfer_control: the tutor requires the learner to apply a repaired rule/check to a fresh or concrete case before accepting closure. Use this even if the tutor also names the underlying warrant.',
    '- name_warrant: the tutor names the governing relation, rule, or warrant without requiring a fresh public application.',
    '- validate_redirect/repeat_explanation/praise_close: the tutor mainly accepts, repeats, redirects, or closes without a new action gate.',
    '',
    'Return exactly this JSON object, with no prose and no code fence:',
    '{',
    '  "committed_repair": "<short free-text description of the final tutor repair; null if none>",',
    '  "committing_quote": "<exact public quote that commits the repair; empty if none>",',
    `  "repair_type": "<ONE of: ${REPAIR_TYPES.join(' | ')}>",`,
    `  "basis_label": "<ONE of: ${BASIS_LABELS.join(' | ')}>",`,
    '  "public_evidence_summary": "<one sentence explaining what public evidence supports this extraction>"',
    '}',
  );
  return lines.join('\n');
}

const FREE_TEXT_SYSTEM_PROMPT = [
  'You are a careful blind extractor for teaching-drama repair commitments.',
  'You see only public dialogue and never see target aliases, decoy aliases, arm provenance, or policy-memory condition.',
  'Extract the final committed tutor repair as JSON. Do not decide whether it is correct.',
].join(' ');

function callClaudeCli(systemPrompt, userPrompt, model) {
  return new Promise((resolve, reject) => {
    const cmd = ['-p', '-', '--output-format', 'text', '--system-prompt', systemPrompt];
    if (model) cmd.push('--model', model);
    const env = { ...process.env };
    delete env.CLAUDE_CODE;
    delete env.CLAUDECODE;
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    const child = spawn('claude', cmd, { stdio: ['pipe', 'pipe', 'pipe'], env });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* gone */
      }
      reject(new Error(`claude CLI timed out after ${CLI_TIMEOUT_MS}ms`));
    }, CLI_TIMEOUT_MS);
    child.stdout.on('data', (data) => {
      out += data;
    });
    child.stderr.on('data', (data) => {
      err += data;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(err.trim() || out.trim() || `claude CLI exited ${code}`));
      else resolve(out.trim());
    });
    child.stdin.write(userPrompt);
    child.stdin.end();
  });
}

async function callClaudeCliWithRetry(systemPrompt, userPrompt, model, attempts = CLI_ATTEMPTS) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await callClaudeCli(systemPrompt, userPrompt, model);
    } catch (error) {
      lastError = error;
      const message = String(error?.message || error);
      if (/session limit|usage limit|rate limit|quota/i.test(message)) throw error;
      process.stderr.write(`  [retry] attempt ${attempt}/${attempts} failed: ${message.slice(0, 140)}\n`);
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
    }
  }
  throw lastError;
}

function mockRepairExtraction(transcript) {
  const text = String(transcript || '').toLowerCase();
  const finalTutor = finalTutorSegment(transcript).toLowerCase();
  const finalRegion = `${text.slice(-1600)}\n${finalTutor}`;
  if (
    /scope|boundary|exception|hold .*fixed|usual condition.*exception|compare .*case|blocks? it|blocks? the result/.test(
      finalRegion,
    )
  ) {
    return {
      committed_repair: 'change the task into a scope test over the exception boundary',
      committing_quote: finalTutorSegment(transcript),
      repair_type: 'ask_scope_test',
      basis_label: 'ordinary_public_inference',
      public_evidence_summary: 'mock extraction found exception-boundary comparison language',
    };
  }
  if (
    /action gate|apply the new rule|concrete test|try it on|next example|show me|fresh case|new case|discriminating test|public check/.test(
      finalRegion,
    )
  ) {
    return {
      committed_repair: 'require a concrete action gate before closure',
      committing_quote: finalTutorSegment(transcript),
      repair_type: 'transfer_control',
      basis_label: 'ordinary_public_inference',
      public_evidence_summary: 'mock extraction found action-gate language',
    };
  }
  if (/repair|rupture|target|bounded next step|which part|inconsistent|comments/.test(finalRegion)) {
    return {
      committed_repair: 'repair the rupture and name one bounded next step',
      committing_quote: finalTutorSegment(transcript),
      repair_type: 'repair_misalignment',
      basis_label: 'ordinary_public_inference',
      public_evidence_summary: 'mock extraction found rupture-repair language',
    };
  }
  if (/validate|redirect|return to|same distinction|same rule/.test(finalRegion)) {
    return {
      committed_repair: 'validate then redirect to the original explanation',
      committing_quote: finalTutorSegment(transcript),
      repair_type: 'validate_redirect',
      basis_label: 'validation_redirect',
      public_evidence_summary: 'mock extraction found validation/redirect language',
    };
  }
  if (/repeat|again|more slowly|explain/.test(finalRegion)) {
    return {
      committed_repair: 'repeat the explanation',
      committing_quote: finalTutorSegment(transcript),
      repair_type: 'repeat_explanation',
      basis_label: 'repeated_explanation',
      public_evidence_summary: 'mock extraction found repetition language',
    };
  }
  return {
    committed_repair: null,
    committing_quote: '',
    repair_type: 'unclear',
    basis_label: 'no_commitment',
    public_evidence_summary: 'mock extraction found no stable repair commitment',
  };
}

function normalizeExtraction(parsed) {
  const repairType = normalizeRepairType(parsed?.repair_type);
  const basis = BASIS_LABELS.includes(parsed?.basis_label) ? parsed.basis_label : 'unclear';
  return {
    committed_repair: parsed?.committed_repair ? String(parsed.committed_repair) : null,
    committing_quote: parsed?.committing_quote ? String(parsed.committing_quote) : '',
    repair_type: REPAIR_TYPES.includes(repairType) ? repairType : repairType || 'unclear',
    basis_label: basis,
    public_evidence_summary: parsed?.public_evidence_summary ? String(parsed.public_evidence_summary) : '',
  };
}

function isS0ArmLabel(label) {
  return /^s0(?:$|[_-])/i.test(String(label || ''));
}

const TRANSFER_CONTROL_PUBLIC_TEST_RE =
  /\b(?:(?:fresh|new|next|transfer|discriminating|public|concrete)\s+(?:case|example|test|check)|apply(?:ing)?\b[\s\S]{0,80}\b(?:fresh|new|next|case|example|test|check)|use\b[\s\S]{0,80}\b(?:check|test)\b[\s\S]{0,80}\bon)\b/i;
const TRANSFER_CONTROL_TUTOR_PROMPT_RE =
  /\b(?:try|apply|use|show|test|check)\b[\s\S]{0,140}\b(?:fresh|new|next|case|example|expression|problem|scenario|item|log\s*\(|\d+\s*(?:\+|\*|x|×|\/|-)\s*\d+)/i;
const TRANSFER_CONTROL_LEARNER_APPLICATION_RE =
  /\b(?:log\s*\(|\d+\s*(?:\+|\*|x|×|\/|-)\s*\d+|because|so|therefore|would|should|does not|doesn't|recombine|compare|same|different|survives|fails)\b/i;
const DIAGNOSTIC_OPTIONS_RE =
  /\b(?:diagnostic|menu|option|choose|choice|where (?:you are|you're)?\s*stuck|where the (?:problem|difficulty|error) is|which (?:part|step|location)|setup|starting point|operation|checking step|a\/b\/c|a,\s*b,\s*(?:or\s*)?c)\b/i;
const ANSWER_REVEAL_RE =
  /\b(?:the answer is|final answer|full worked solution|show you the answer|tell you the answer|solution is)\b/i;
const NEGATED_DECOY_MARKERS = [
  'rather than',
  'instead of',
  'not',
  'do not',
  "don't",
  'avoid',
  'avoids',
  'avoided',
  'reject',
  'rejected',
  'replace',
  'replaces',
  'replaced',
  'abandon',
  'abandons',
  'abandoned',
  'cannot',
  "can't",
];
const FAILED_DECOY_MARKERS = [
  'fail',
  'fails',
  'failed',
  'failure',
  'break',
  'breaks',
  'broke',
  'broken',
  'changes',
  'changed',
  'changing',
  'cannot tell',
  "can't tell",
];

function roleTurns(transcript) {
  const turns = [];
  for (const line of String(transcript || '').split(/\r?\n/u)) {
    const match = line.match(/^\s*(TUTOR|LEARNER)\s*:\s*(.+)$/iu);
    if (match) turns.push({ role: match[1].toUpperCase(), text: match[2].trim() });
  }
  return turns;
}

function transcriptHasTransferControlPublicTest(transcript) {
  const turns = roleTurns(transcript);
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    if (turn.role !== 'TUTOR' || !TRANSFER_CONTROL_TUTOR_PROMPT_RE.test(turn.text)) continue;
    const nextLearner = turns.slice(index + 1).find((candidate) => candidate.role === 'LEARNER');
    if (nextLearner && TRANSFER_CONTROL_LEARNER_APPLICATION_RE.test(nextLearner.text)) return true;
  }
  return false;
}

function regexIndex(text, regex) {
  const match = regex.exec(String(text || ''));
  regex.lastIndex = 0;
  return match ? match.index : -1;
}

function targetObligationAudit(transcript, { targetRepairType, extractedRepairType }) {
  const target = normalizeRepairType(targetRepairType);
  const extracted = normalizeRepairType(extractedRepairType);
  const governed = target === 'offer_diagnostic_options' || target === 'transfer_control';
  if (!governed) {
    return {
      governed: false,
      target_repair_type: target || null,
      extracted_repair_type: extracted || null,
    };
  }
  const text = String(transcript || '').toLowerCase();
  const diagnosticIndex = regexIndex(text, DIAGNOSTIC_OPTIONS_RE);
  const answerIndex = regexIndex(text, ANSWER_REVEAL_RE);
  const diagnosticOptionsPresent = diagnosticIndex >= 0;
  const answerRevealBeforeDiagnosticChoice = answerIndex >= 0 && (diagnosticIndex < 0 || answerIndex < diagnosticIndex);
  const transferControlPublicTestPresent = transcriptHasTransferControlPublicTest(transcript);
  if (target === 'offer_diagnostic_options') {
    return {
      governed: true,
      target_repair_type: target,
      extracted_repair_type: extracted || null,
      diagnostic_options_present: diagnosticOptionsPresent,
      answer_reveal_before_diagnostic_choice: answerRevealBeforeDiagnosticChoice,
      competing_transfer_control_signal: transferControlPublicTestPresent,
      extracted_repair_type_mismatch: extracted ? extracted !== target : true,
      target_granularity_risk:
        diagnosticOptionsPresent && (extracted === 'transfer_control' || transferControlPublicTestPresent),
    };
  }
  return {
    governed: true,
    target_repair_type: target,
    extracted_repair_type: extracted || null,
    transfer_control_public_test_present: transferControlPublicTestPresent,
    competing_diagnostic_options_signal: diagnosticOptionsPresent,
    extracted_repair_type_mismatch: extracted ? extracted !== target : true,
    target_granularity_risk: transferControlPublicTestPresent && extracted === 'offer_diagnostic_options',
  };
}

function calibratedTargetHit(repairText, repairType, args) {
  const targetRepairType = normalizeRepairType(args.targetRepairType);
  if (!targetRepairType) return false;
  if (repairType === targetRepairType) return true;
  if (targetRepairType === 'transfer_control' && TRANSFER_CONTROL_PUBLIC_TEST_RE.test(repairText)) return true;
  if (targetRepairType === 'transfer_control' && transcriptHasTransferControlPublicTest(args.transcript)) return true;
  return false;
}

function stemToken(token) {
  return String(token || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/(?:ing|ed|s)$/u, '');
}

function significantTokens(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map(stemToken)
    .filter((token) => token && !['the', 'a', 'an', 'and', 'or', 'to', 'of', 'again'].includes(token));
}

function allAliasTokensInWindow(alias, windowText) {
  const aliasTokens = significantTokens(alias);
  const windowTokens = new Set(significantTokens(windowText));
  return aliasTokens.length > 0 && aliasTokens.every((token) => windowTokens.has(token));
}

function isNegatedDecoyMention(repairText, alias) {
  const text = String(repairText || '').toLowerCase();
  for (const marker of NEGATED_DECOY_MARKERS) {
    let index = text.indexOf(marker);
    while (index >= 0) {
      const window = text.slice(index, index + 180);
      if (allAliasTokensInWindow(alias, window)) return true;
      index = text.indexOf(marker, index + marker.length);
    }
  }
  for (const marker of FAILED_DECOY_MARKERS) {
    let index = text.indexOf(marker);
    while (index >= 0) {
      const window = text.slice(Math.max(0, index - 120), index + 180);
      if (allAliasTokensInWindow(alias, window)) return true;
      index = text.indexOf(marker, index + marker.length);
    }
  }
  return false;
}

export function classForExtraction(extraction, args) {
  const repairText = [
    extraction.committed_repair,
    extraction.committing_quote,
    extraction.repair_type,
    extraction.public_evidence_summary,
  ]
    .filter(Boolean)
    .join(' ');
  const repairType = normalizeRepairType(extraction.repair_type);
  const targetHit = matchesAny(repairText, args.targetAliases) || calibratedTargetHit(repairText, repairType, args);
  const decoyHit =
    (args.decoyAliases || []).some(
      (alias) => matchesAny(repairText, [alias]) && !isNegatedDecoyMention(repairText, alias),
    ) || (args.decoyRepairTypes || []).map(normalizeRepairType).includes(repairType);
  if (targetHit && !decoyHit) return 'target';
  if (decoyHit && !targetHit) return 'decoy';
  return 'neither';
}

async function classifyFreeTextArm({ label, transcriptPath, args }) {
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  const prompt = freeTextPromptFor(transcript, args);
  const armArgs = { ...args, transcript };
  const extractions = [];
  for (let criticIndex = 0; criticIndex < args.critics; criticIndex += 1) {
    let raw;
    let parsed;
    if (args.mock) {
      parsed = mockRepairExtraction(transcript);
      raw = JSON.stringify(parsed);
    } else {
      raw = await callClaudeCliWithRetry(FREE_TEXT_SYSTEM_PROMPT, prompt, args.model);
      parsed = parseJsonLoose(raw);
    }
    const extraction = normalizeExtraction(parsed);
    const matchedClass = classForExtraction(extraction, armArgs);
    extractions.push({
      critic_index: criticIndex,
      ...extraction,
      matched_class: matchedClass,
      hits_target: matchedClass === 'target',
      hits_decoy: matchedClass === 'decoy',
      parse_ok: Boolean(parsed),
      raw: args.mock ? undefined : raw,
    });
    process.stderr.write(
      `  [${label}] critic ${criticIndex + 1}/${args.critics}: class=${matchedClass} repair_type=${extraction.repair_type}\n`,
    );
  }
  const matchedClass = majority(extractions.map((extraction) => extraction.matched_class));
  const basis = majority(extractions.map((extraction) => extraction.basis_label));
  const repairType = majority(extractions.map((extraction) => extraction.repair_type));
  const artifactFlags = [];
  const classCounts = matchedClass.distribution || {};
  const nonZeroClasses = Object.entries(classCounts).filter(([, count]) => count > 0).length;
  if (nonZeroClasses > 1 && matchedClass.votes < matchedClass.total) artifactFlags.push('critic_split');
  const committedOptionClass =
    matchedClass.value === 'target' || matchedClass.value === 'decoy' ? matchedClass.value : 'neither';
  return {
    label,
    transcript_path: repoRel(transcriptPath),
    committed_option_class: committedOptionClass,
    basis_label: basis.value || 'unclear',
    artifact_flags: artifactFlags,
    repair_type: repairType.value || 'unclear',
    committed_repair: majority(extractions.map((extraction) => extraction.committed_repair)).value,
    critic_vote: {
      matched_class: matchedClass,
      basis_label: basis,
      repair_type: repairType,
    },
    extractions,
    prompt_audit: {
      system_prompt_sha256: sha256Short(FREE_TEXT_SYSTEM_PROMPT),
      user_prompt_sha256: sha256Short(prompt),
    },
    target_obligation_audit: targetObligationAudit(transcript, {
      targetRepairType: args.targetRepairType,
      extractedRepairType: repairType.value || 'unclear',
    }),
  };
}

export async function adjudicateTeachingDramaAxiomCardFreeText({
  protocolPath = DEFAULT_PROTOCOL,
  s0,
  s1,
  singleArm = null,
  armLabel = 'single_arm',
  targetAliases,
  decoyAliases,
  targetRepairType = null,
  decoyRepairTypes = [],
  optionSpace = null,
  familyId = null,
  siblingId = null,
  runId = `a19-blind-${Date.now()}`,
  mock = false,
  critics = 1,
  model = null,
} = {}) {
  const protocol = readProtocol(protocolPath);
  const args = {
    targetAliases,
    decoyAliases,
    targetRepairType: normalizeRepairType(targetRepairType),
    decoyRepairTypes: decoyRepairTypes.map(normalizeRepairType),
    optionSpace,
    mock,
    critics,
    model,
  };
  if (singleArm) {
    const arm = await classifyFreeTextArm({ label: armLabel, transcriptPath: singleArm, args });
    return {
      schema_version: 'a19-blind-single-arm-v0.1',
      run_id: runId,
      created_at: new Date().toISOString(),
      channel: mock ? 'free_text_repair_extraction_mock' : 'free_text_blind_repair_extraction',
      critic_backend: mock ? 'deterministic_free_text_mock' : 'claude_cli',
      critic_model: model || (mock ? 'mock' : 'claude_cli_default'),
      critics_per_arm: critics,
      claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
      family_id: familyId,
      sibling_id: siblingId,
      neutral_option_space: optionSpace,
      critic_prompt_audit: {
        target_aliases_visible_to_critic: false,
        decoy_aliases_visible_to_critic: false,
        target_repair_type_visible_to_critic: false,
        decoy_repair_types_visible_to_critic: false,
        arm_provenance_visible_to_critic: false,
        policy_memory_condition_visible_to_critic: false,
      },
      posthoc_mapping: {
        target_aliases: targetAliases,
        decoy_aliases: decoyAliases,
        target_repair_type: args.targetRepairType,
        decoy_repair_types: args.decoyRepairTypes,
      },
      arm,
      headroom_screen: {
        s0_has_observable_headroom: isS0ArmLabel(arm.label) && arm.committed_option_class !== 'target',
        s0_class: arm.committed_option_class,
      },
      non_claims: [
        'human_learning',
        'deployed_adaptive_tutor',
        'model_weight_learning',
        'main_harness_rate_effect',
        'paid_blind_panel_result',
      ],
    };
  }
  const s0Arm = await classifyFreeTextArm({ label: 'S0_no_policy', transcriptPath: s0, args });
  const s1Arm = await classifyFreeTextArm({ label: 'S1_policy_memory', transcriptPath: s1, args });
  const card = {
    fixture_adjudication: {
      s0: {
        committed_option_class: s0Arm.committed_option_class,
        basis_label: s0Arm.basis_label,
        artifact_flags: s0Arm.artifact_flags,
      },
      s1: {
        committed_option_class: s1Arm.committed_option_class,
        basis_label: s1Arm.basis_label,
        artifact_flags: s1Arm.artifact_flags,
      },
    },
  };
  const cardVerdict = classifyCardVerdict(card, protocol);
  return {
    schema_version: 'a19-blind-adjudication-v0.2',
    run_id: runId,
    created_at: new Date().toISOString(),
    channel: mock ? 'free_text_repair_extraction_mock' : 'free_text_blind_repair_extraction',
    critic_backend: mock ? 'deterministic_free_text_mock' : 'claude_cli',
    critic_model: model || (mock ? 'mock' : 'claude_cli_default'),
    critics_per_arm: critics,
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    family_id: familyId,
    sibling_id: siblingId,
    neutral_option_space: optionSpace,
    critic_prompt_audit: {
      target_aliases_visible_to_critic: false,
      decoy_aliases_visible_to_critic: false,
      target_repair_type_visible_to_critic: false,
      decoy_repair_types_visible_to_critic: false,
      arm_provenance_visible_to_critic: false,
      policy_memory_condition_visible_to_critic: false,
    },
    posthoc_mapping: {
      target_aliases: targetAliases,
      decoy_aliases: decoyAliases,
      target_repair_type: args.targetRepairType,
      decoy_repair_types: args.decoyRepairTypes,
    },
    arms: {
      s0: s0Arm,
      s1: s1Arm,
    },
    card_verdict: cardVerdict,
    non_claims: [
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
      'paid_blind_panel_result',
    ],
  };
}

export function adjudicateTeachingDramaAxiomCard({
  protocolPath = DEFAULT_PROTOCOL,
  s0,
  s1,
  targetAliases,
  decoyAliases,
  optionSpace = null,
  familyId = null,
  siblingId = null,
  runId = `a19-blind-${Date.now()}`,
} = {}) {
  const protocol = readProtocol(protocolPath);
  const s0Arm = classifyTranscriptArm({
    label: 'S0_no_policy',
    transcriptPath: s0,
    targetAliases,
    decoyAliases,
  });
  const s1Arm = classifyTranscriptArm({
    label: 'S1_policy_memory',
    transcriptPath: s1,
    targetAliases,
    decoyAliases,
  });
  const card = {
    fixture_adjudication: {
      s0: {
        committed_option_class: s0Arm.committed_option_class,
        basis_label: s0Arm.basis_label,
        artifact_flags: s0Arm.artifact_flags,
      },
      s1: {
        committed_option_class: s1Arm.committed_option_class,
        basis_label: s1Arm.basis_label,
        artifact_flags: s1Arm.artifact_flags,
      },
    },
  };
  const cardVerdict = classifyCardVerdict(card, protocol);
  return {
    schema_version: 'a19-blind-adjudication-v0.1',
    run_id: runId,
    created_at: new Date().toISOString(),
    channel: 'fixture_blind_mechanical_mock',
    critic_backend: 'deterministic_mock_alias_reader',
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    family_id: familyId,
    sibling_id: siblingId,
    neutral_option_space: optionSpace,
    critic_prompt_audit: {
      target_aliases_visible_to_critic: false,
      decoy_aliases_visible_to_critic: false,
      arm_provenance_visible_to_critic: false,
      policy_memory_condition_visible_to_critic: false,
    },
    posthoc_mapping: {
      target_aliases: targetAliases,
      decoy_aliases: decoyAliases,
    },
    arms: {
      s0: s0Arm,
      s1: s1Arm,
    },
    card_verdict: cardVerdict,
    non_claims: [
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
      'paid_blind_panel_result',
    ],
  };
}

export async function runBlindAdjudication(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs)
    ? parseArgs(rawArgs)
    : {
        protocol: DEFAULT_PROTOCOL,
        targetAliases: [],
        decoyAliases: [],
        targetRepairType: null,
        decoyRepairTypes: [],
        mock: true,
        freeText: false,
        critics: 1,
        model: null,
        familyId: null,
        siblingId: null,
        runId: null,
        optionSpace: null,
        out: null,
        help: false,
        ...rawArgs,
      };
  if (args.help) return { help: usage() };
  const report = args.freeText
    ? await adjudicateTeachingDramaAxiomCardFreeText({
        protocolPath: args.protocol,
        s0: args.s0,
        s1: args.s1,
        singleArm: args.singleArm,
        armLabel: args.armLabel,
        targetAliases: args.targetAliases,
        decoyAliases: args.decoyAliases,
        targetRepairType: args.targetRepairType,
        decoyRepairTypes: args.decoyRepairTypes,
        optionSpace: args.optionSpace,
        familyId: args.familyId,
        siblingId: args.siblingId,
        runId: args.runId,
        mock: args.mock,
        critics: args.critics,
        model: args.model,
      })
    : adjudicateTeachingDramaAxiomCard({
        protocolPath: args.protocol,
        s0: args.s0,
        s1: args.s1,
        targetAliases: args.targetAliases,
        decoyAliases: args.decoyAliases,
        optionSpace: args.optionSpace,
        familyId: args.familyId,
        siblingId: args.siblingId,
        runId: args.runId,
      });
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return report;
}

async function main() {
  const report = await runBlindAdjudication();
  if (report.help) {
    process.stdout.write(`${report.help}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}
