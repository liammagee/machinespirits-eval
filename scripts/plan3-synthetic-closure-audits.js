#!/usr/bin/env node
/**
 * Plan 3.0 synthetic closure audit harness.
 *
 * This is an offline reader over existing DB rows, tutor-dialogue logs, and
 * committed dramatic-derivation exports. It deliberately uses proxy checks
 * where item keys or fresh generated counterfactuals are unavailable, and the
 * report labels those limits explicitly.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const STABLE_ROOT = '/Users/lmagee/Dev/machinespirits/machinespirits-eval';

const DEFAULT_OUT_DIR = path.join(ROOT_DIR, 'exports', 'plan3-synthetic-closure-audits');
const DIRECT_ANSWER_PATTERNS = [
  { code: 'explicit_answer_phrase', re: /\b(?:the|your|correct|right)\s+answer\s+(?:is|would be|should be)\b/i },
  { code: 'solution_phrase', re: /\b(?:the|a)\s+solution\s+(?:is|would be|should be)\b/i },
  { code: 'final_answer_phrase', re: /\bfinal\s+answer\s*(?::|is)\b/i },
  { code: 'answer_key_label', re: /\banswer\s+keys?\b/i },
  {
    code: 'worked_solution_handoff',
    re: /\b(?:here'?s|here is)\s+(?:the\s+)?(?:full|complete|worked|step[- ]by[- ]step)\s+(?:solution|answer)\b/i,
  },
  { code: 'solve_it_for_you', re: /\b(?:i'?ll|let me)\s+(?:solve|do)\s+(?:it|this)\s+for\s+you\b/i },
  { code: 'hidden_answer_reveal', re: /\b(?:secret|hidden)\s+(?:answer|solution|fact|premise|key)\b/i },
];

const HIDDEN_PUBLIC_PATTERNS = [
  { code: 'answer_key_leak', re: /\banswer\s+keys?\b/i },
  { code: 'hidden_label_leak', re: /\bhidden\s+labels?\b/i },
  { code: 'desired_classification_leak', re: /\b(?:evaluator\s+)?desired\s+classifications?\b/i },
  { code: 'internal_verifier_leak', re: /\bverifier\s+internals?\b/i },
  { code: 'secret_token_leak', re: /\bsha256:[a-f0-9]{16,}\b/i },
];

const STRUGGLE_RE =
  /\b(?:i'?m\s+not\s+sure|not\s+sure|confused|stuck|don'?t\s+understand|do\s+not\s+understand|can'?t|could\s+you\s+help|help\s+me|i\s+guess|maybe|i\s+don'?t\s+know|not\s+really)\b/i;
const FALSE_MASTERY_RE =
  /^(?:yes|yeah|yep|ok|okay|right|got it|makes sense|that makes sense|thanks|thank you|yes that makes sense|yes,? thank you)[.! ]*$/i;
const LEARNER_EVIDENCE_RE =
  /\b(?:because|so|therefore|that means|which means|if|then|in my own words|the reason|what breaks|i think|i see now)\b/i;
const CLOSURE_RE =
  /\b(?:you(?:'ve| have)\s+got\s+it|you\s+understand\s+(?:this|the)|ready\s+to\s+move\s+on|let'?s\s+move\s+on|now\s+we\s+can\s+move|you'?re\s+ready|mastered|nailed\s+it|glad\s+it\s+landed|looks\s+like\s+you\s+have\s+it|you'?ve\s+landed\s+the\s+core|you'?ve\s+committed\s+to|you\s+can\s+now)\b/i;
const METACOGNITIVE_RE =
  /\b(?:i'?m\s+not\s+sure|i\s+think|i\s+thought|i\s+was\s+using|i\s+was\s+wrong|now\s+i\s+see|in\s+my\s+own\s+words|what\s+breaks|why|because|therefore|confused|stuck)\b/i;
const FLIP_RE =
  /\b(?:actually|you'?re\s+right|i\s+guess|never\s+mind|i\s+changed\s+my\s+mind|i\s+was\s+wrong|i'?ll\s+just)\b/i;

function parseArgs(argv) {
  const args = {
    outDir: DEFAULT_OUT_DIR,
    dbPath: null,
    logsDir: null,
    rowLimit: null,
    logLimit: null,
    exportLimit: null,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--out') args.outDir = path.resolve(argv[++i]);
    else if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--logs') args.logsDir = path.resolve(argv[++i]);
    else if (token === '--row-limit') args.rowLimit = parsePositiveInt(argv[++i], '--row-limit');
    else if (token === '--log-limit') args.logLimit = parsePositiveInt(argv[++i], '--log-limit');
    else if (token === '--export-limit') args.exportLimit = parsePositiveInt(argv[++i], '--export-limit');
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}`);
  }
  return args;
}

function parsePositiveInt(value, flag) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} expects a positive integer`);
  return n;
}

function firstExisting(paths) {
  return paths.filter(Boolean).find((p) => fs.existsSync(p)) || null;
}

function discoverInputs(args) {
  const dbPath =
    args.dbPath ||
    firstExisting([
      process.env.EVAL_DB_PATH,
      path.join(ROOT_DIR, 'data', 'evaluations.db'),
      ROOT_DIR === STABLE_ROOT ? null : path.join(STABLE_ROOT, 'data', 'evaluations.db'),
    ]);
  const logsDir =
    args.logsDir ||
    firstExisting([
      process.env.EVAL_LOGS_DIR,
      path.join(ROOT_DIR, 'logs', 'tutor-dialogues'),
      ROOT_DIR === STABLE_ROOT ? null : path.join(STABLE_ROOT, 'logs', 'tutor-dialogues'),
    ]);
  return {
    dbPath,
    logsDir,
    exportsDir: path.join(ROOT_DIR, 'exports'),
    pilotItemsPath: path.join(ROOT_DIR, 'config', 'pilot', 'fractions-items.yaml'),
  };
}

function walkFiles(dir, predicate, limit = null) {
  const files = [];
  function visit(current) {
    if (limit && files.length >= limit) return;
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (limit && files.length >= limit) return;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && predicate(full)) files.push(full);
    }
  }
  if (dir && fs.existsSync(dir)) visit(dir);
  return files;
}

function safeJson(raw, fallback = null) {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function cleanText(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function compactPath(file) {
  if (!file) return null;
  if (file.startsWith(ROOT_DIR)) return path.relative(ROOT_DIR, file);
  if (file.startsWith(STABLE_ROOT)) return path.relative(STABLE_ROOT, file);
  return file;
}

function sampleText(text, max = 220) {
  const cleaned = cleanText(text);
  return cleaned.length > max ? `${cleaned.slice(0, max - 3)}...` : cleaned;
}

function familyFromMeta(meta = {}) {
  const hay = [meta.profileName, meta.scenarioId, meta.source, meta.variant, meta.promptType]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (meta.factorRecognition === 1 || meta.factorRecognition === true) return 'recognition';
  if (/\brecog(?:nition)?\b/.test(hay)) return 'recognition';
  if (/\bplacebo\b/.test(hay)) return 'placebo';
  if (/\bbase\b|\bbudget\b|\bsingle\b/.test(hay)) return 'base';
  return 'unknown';
}

async function loadDbRows(dbPath, rowLimit) {
  if (!dbPath) return { rows: [], error: 'no DB path found' };
  const query = dbRowsQuery(rowLimit);
  let Database;
  try {
    ({ default: Database } = await import('better-sqlite3'));
  } catch (error) {
    return loadDbRowsWithSqliteCli(dbPath, query, `better-sqlite3 unavailable: ${error.message}`);
  }

  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const rows = db.prepare(query).all();
    return { rows, error: null };
  } catch (error) {
    return loadDbRowsWithSqliteCli(dbPath, query, `better-sqlite3 query failed: ${error.message}`);
  } finally {
    if (db) db.close();
  }
}

function dbRowsQuery(rowLimit) {
  const limitSql = rowLimit ? ` LIMIT ${rowLimit}` : '';
  return `SELECT id, run_id, scenario_id, scenario_name, profile_name,
                 factor_recognition, factor_multi_agent_tutor,
                 learner_architecture, conversation_mode, dialogue_id,
                 suggestions, raw_response, tutor_scores, learner_scores,
                 tutor_first_turn_score, tutor_last_turn_score,
                 learner_overall_score, dialogue_quality_score
            FROM evaluation_results
           WHERE success = 1
           ORDER BY id DESC${limitSql}`;
}

function loadDbRowsWithSqliteCli(dbPath, query, reason) {
  try {
    const output = execFileSync('sqlite3', ['-json', dbPath, query], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    return { rows: safeJson(output, []), error: `${reason}; used sqlite3 CLI fallback` };
  } catch (error) {
    return { rows: [], error: `${reason}; sqlite3 CLI fallback failed: ${error.message}` };
  }
}

function suggestionTexts(row) {
  const suggestions = safeJson(row.suggestions, []);
  const values = [];
  const append = (text, field) => {
    const cleaned = cleanText(text);
    if (cleaned) values.push({ text: cleaned, field });
  };
  if (Array.isArray(suggestions)) {
    suggestions.forEach((s, index) => {
      if (typeof s === 'string') append(s, `suggestions[${index}]`);
      else if (s && typeof s === 'object') {
        append(s.message || s.text || s.detail || s.contextSummary, `suggestions[${index}].message`);
        append(s.reasoning || s.reason || s.rationale, `suggestions[${index}].reasoning`);
        append(s.title, `suggestions[${index}].title`);
      }
    });
  } else if (suggestions && typeof suggestions === 'object') {
    append(suggestions.message || suggestions.text || suggestions.detail, 'suggestions.message');
  }
  append(row.raw_response, 'raw_response');
  return values;
}

function loadDbRecommendationRecords(rows) {
  const records = [];
  for (const row of rows) {
    const meta = {
      source: `db:evaluation_results:${row.id}`,
      profileName: row.profile_name || null,
      scenarioId: row.scenario_id || null,
      factorRecognition: row.factor_recognition,
    };
    const family = familyFromMeta(meta);
    for (const item of suggestionTexts(row)) {
      records.push({
        source: meta.source,
        kind: 'db_recommendation',
        role: 'tutor',
        family,
        profileName: meta.profileName,
        scenarioId: meta.scenarioId,
        field: item.field,
        text: item.text,
      });
    }
  }
  return records;
}

function coerceDialogueTurns(items, meta) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const role = String(item?.role || item?.agent || '').toLowerCase();
      const text = cleanText(item?.text || item?.content || item?.message || item?.detail || item?.contextSummary);
      if (!role || !text) return null;
      return {
        role: role === 'user' ? 'learner' : role,
        text,
        turn: Number.isFinite(item?.turn) ? item.turn : Number.isFinite(item?.turnIndex) ? item.turnIndex : index,
        meta: item?.meta || {},
        source: meta.source,
      };
    })
    .filter(Boolean)
    .filter((turn) => ['tutor', 'learner', 'director', 'system'].includes(turn.role));
}

function traceTextMap(log, role) {
  const byTurn = new Map();
  const trace = Array.isArray(log?.dialogueTrace) ? log.dialogueTrace : [];
  const roleAliases =
    role === 'tutor' ? new Set(['tutor', 'user']) : role === 'learner' ? new Set(['learner', 'user']) : new Set([role]);
  const preferredActions = role === 'tutor' ? new Set(['final_output', 'suggestion']) : new Set(['final_output']);
  for (const entry of trace) {
    if (!roleAliases.has(entry?.agent)) continue;
    if (preferredActions.size && !preferredActions.has(entry?.action)) continue;
    const idx = Number.isFinite(entry?.turnIndex)
      ? entry.turnIndex
      : Number.isFinite(entry?.round)
        ? entry.round
        : null;
    if (idx == null) continue;
    const text = cleanText(entry?.detail || entry?.contextSummary || entry?.message || entry?.content);
    if (text) byTurn.set(idx, text);
  }

  if (role === 'learner') {
    for (const entry of trace) {
      if (!(entry?.agent === 'learner' || entry?.agent === 'user')) continue;
      if (entry?.action !== 'turn_action') continue;
      const idx = Number.isFinite(entry?.turnIndex)
        ? entry.turnIndex
        : Number.isFinite(entry?.round)
          ? entry.round
          : null;
      if (idx == null || byTurn.has(idx)) continue;
      const text = cleanText(entry?.detail || entry?.contextSummary || entry?.message || entry?.content);
      if (text) byTurn.set(idx, text);
    }
  }

  const turnResults = Array.isArray(log?.turnResults) ? log.turnResults : [];
  for (let i = 0; i < turnResults.length; i++) {
    const tr = turnResults[i];
    const idx = Number.isFinite(tr?.turnIndex) ? tr.turnIndex : i;
    if (byTurn.has(idx)) continue;
    if (role === 'tutor') {
      const s = Array.isArray(tr?.suggestions) ? tr.suggestions[0] : tr?.suggestion;
      const text = cleanText(typeof s === 'string' ? s : s?.message || s?.text || s?.detail || s?.contextSummary);
      if (text) byTurn.set(idx, text);
    } else if (role === 'learner') {
      const text = cleanText(tr?.learnerMessage || tr?.learnerAction || tr?.learnerResponse);
      if (text) byTurn.set(idx, text);
    }
  }
  return byTurn;
}

function mapsToDialogueTurns(log, meta) {
  const tutor = traceTextMap(log, 'tutor');
  const learner = traceTextMap(log, 'learner');
  const indexes = [...new Set([...tutor.keys(), ...learner.keys()])].sort((a, b) => a - b);
  const turns = [];
  for (const index of indexes) {
    if (learner.has(index)) {
      turns.push({ role: 'learner', text: learner.get(index), turn: index, meta: {}, source: meta.source });
    }
    if (tutor.has(index)) {
      turns.push({ role: 'tutor', text: tutor.get(index), turn: index, meta: {}, source: meta.source });
    }
  }
  return turns;
}

function extractDialoguesFromLog(file, json) {
  const source = compactPath(file);
  const baseMeta = {
    source,
    profileName: json?.profileName || json?.profile_name || null,
    scenarioId: json?.scenario?.id || json?.scenarioId || json?.scenario_id || null,
    factorRecognition: null,
  };
  const dialogues = [];

  const pushDialogue = (variant, turns) => {
    if (!turns || turns.length === 0) return;
    const meta = {
      ...baseMeta,
      variant,
      family: familyFromMeta({ ...baseMeta, variant }),
      id: `${source}:${variant}`,
    };
    dialogues.push({ ...meta, turns });
  };

  pushDialogue('dialogue', coerceDialogueTurns(json?.dialogue, baseMeta));
  pushDialogue('transcript', coerceDialogueTurns(json?.transcript, baseMeta));
  pushDialogue('original', coerceDialogueTurns(json?.original?.dialogue, baseMeta));
  pushDialogue('counterfactual', coerceDialogueTurns(json?.counterfactual?.dialogue, baseMeta));
  const traceTurns = mapsToDialogueTurns(json, baseMeta);
  pushDialogue('dialogueTrace', traceTurns);

  return dialogues;
}

function extractResponseRecordsFromLog(file, json) {
  const source = compactPath(file);
  const profileName = json?.profileName || json?.profile_name || null;
  const scenarioId = json?.scenario?.id || json?.scenarioId || json?.scenario_id || null;
  const family = familyFromMeta({ profileName, scenarioId, source });
  const records = [];
  const suggestions = Array.isArray(json?.suggestions) ? json.suggestions : [];
  suggestions.forEach((s, index) => {
    const text = cleanText(typeof s === 'string' ? s : s?.message || s?.text || s?.detail || s?.reasoning);
    if (text) {
      records.push({
        source,
        kind: 'log_suggestion',
        role: 'tutor',
        family,
        profileName,
        scenarioId,
        field: `suggestions[${index}]`,
        text,
      });
    }
  });
  return records;
}

function loadDialogueArtifacts(inputs, args) {
  const dialogues = [];
  const responseRecords = [];
  const logFiles = walkFiles(inputs.logsDir, (file) => file.endsWith('.json'), args.logLimit);
  for (const file of logFiles) {
    const json = readJsonFile(file);
    if (!json) continue;
    dialogues.push(...extractDialoguesFromLog(file, json));
    responseRecords.push(...extractResponseRecordsFromLog(file, json));
  }

  const resultFiles = walkFiles(
    path.join(inputs.exportsDir, 'dramatic-derivation'),
    (file) => path.basename(file) === 'result.json',
    args.exportLimit,
  );
  for (const file of resultFiles) {
    const json = readJsonFile(file);
    if (!json) continue;
    const source = compactPath(file);
    const turns = coerceDialogueTurns(json.transcript, { source });
    if (turns.length) {
      dialogues.push({
        id: source,
        source,
        variant: 'derivation_result',
        family: 'derivation',
        profileName: null,
        scenarioId: json.worldId || null,
        turns,
      });
    }
  }

  return { dialogues, responseRecords, counts: { logFiles: logFiles.length, resultFiles: resultFiles.length } };
}

function loadDetectorArms(exportsDir) {
  const files = walkFiles(
    path.join(exportsDir, 'dramatic-derivation'),
    (file) => path.basename(file) === 'detector-split-report.json',
  );
  const arms = [];
  for (const file of files) {
    const json = readJsonFile(file);
    if (!json || !Array.isArray(json.arms)) continue;
    for (const arm of json.arms) {
      arms.push({ ...arm, reportPath: compactPath(file) });
    }
  }
  return arms;
}

function classifyAnswerRisk(record) {
  const hits = [];
  for (const pattern of DIRECT_ANSWER_PATTERNS) {
    if (pattern.re.test(record.text)) hits.push(pattern.code);
  }
  for (const pattern of HIDDEN_PUBLIC_PATTERNS) {
    if (pattern.re.test(record.text)) hits.push(pattern.code);
  }
  return [...new Set(hits)];
}

function auditAnswerLeak(records) {
  const rows = [];
  for (const record of records) {
    const hits = classifyAnswerRisk(record);
    if (hits.length) rows.push({ ...record, hits });
  }
  const byFamily = summarizeBy(
    records,
    (r) => r.family || 'unknown',
    (subset) => {
      const hitCount = subset.filter((r) => classifyAnswerRisk(r).length).length;
      return {
        n: subset.length,
        highRisk: hitCount,
        highRiskRate: rate(hitCount, subset.length),
      };
    },
  );
  const recognition = byFamily.recognition;
  const fail = recognition && recognition.n >= 10 && recognition.highRiskRate > 0.1;
  const insufficient = !recognition || recognition.n < 10;
  return {
    status: insufficient ? 'INSUFFICIENT_RECOGNITION_N' : fail ? 'FAIL' : 'PASS',
    gate: 'Recognition answer-delivery risk <= 10% with n >= 10',
    totalMessages: records.length,
    highRiskMessages: rows.length,
    highRiskRate: rate(rows.length, records.length),
    byFamily,
    examples: rows.slice(0, 8).map(exampleRecord),
  };
}

function classifyHelpLevel(text) {
  const lower = text.toLowerCase();
  if (
    classifyAnswerRisk({ text }).length ||
    /\b(?:the key is|what this proves is|therefore the result is)\b/i.test(text)
  ) {
    return { level: 4, label: 'direct_answer' };
  }
  const questionCount = (text.match(/\?/g) || []).length;
  const words = lower.split(/\s+/).filter(Boolean).length;
  if (
    /\b(?:here'?s how|let'?s work it through|step by step|the move is|notice that|this means|that means)\b/i.test(
      text,
    ) ||
    (words > 85 && questionCount === 0)
  ) {
    return { level: 3, label: 'worked_explanation' };
  }
  if (/\b(?:try|look at|consider|focus on|what happens if|which part|where would|compare|trace)\b/i.test(text)) {
    return { level: 2, label: 'strategic_hint' };
  }
  if (questionCount > 0 || /\b(?:walk me through|put .* in your own words|tell me|say more)\b/i.test(text)) {
    return { level: 1, label: 'diagnostic_question' };
  }
  return { level: 0, label: 'orientation_or_ack' };
}

function isStruggleOrFalseMastery(text) {
  const cleaned = cleanText(text);
  return STRUGGLE_RE.test(cleaned) || (cleaned.length <= 90 && FALSE_MASTERY_RE.test(cleaned));
}

function tutorTurnsWithContext(dialogue) {
  const contexts = [];
  for (let i = 0; i < dialogue.turns.length; i++) {
    const turn = dialogue.turns[i];
    if (turn.role !== 'tutor') continue;
    const previousTutor = [...dialogue.turns.slice(0, i)].reverse().find((t) => t.role === 'tutor');
    const previousLearner = [...dialogue.turns.slice(0, i)].reverse().find((t) => t.role === 'learner');
    contexts.push({ dialogue, turn, previousTutor, previousLearner });
  }
  return contexts;
}

function auditHelpLadder(dialogues) {
  let relevant = 0;
  let compliant = 0;
  const violations = [];
  const levelCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const dialogue of dialogues) {
    for (const ctx of tutorTurnsWithContext(dialogue)) {
      const current = classifyHelpLevel(ctx.turn.text);
      levelCounts[current.level]++;
      if (!ctx.previousTutor || !ctx.previousLearner || !isStruggleOrFalseMastery(ctx.previousLearner.text)) continue;
      relevant++;
      const previous = classifyHelpLevel(ctx.previousTutor.text);
      const jump = current.level - previous.level;
      const isCompliant =
        jump <= 1 && !(FALSE_MASTERY_RE.test(cleanText(ctx.previousLearner.text)) && current.level >= 4);
      if (isCompliant) compliant++;
      else {
        violations.push({
          source: dialogue.source,
          variant: dialogue.variant,
          family: dialogue.family,
          profileName: dialogue.profileName,
          turn: ctx.turn.turn,
          previousLevel: previous.level,
          currentLevel: current.level,
          previousLabel: previous.label,
          currentLabel: current.label,
          learner: sampleText(ctx.previousLearner.text),
          tutor: sampleText(ctx.turn.text),
        });
      }
    }
  }
  const complianceRate = rate(compliant, relevant);
  const insufficient = relevant < 10;
  const fail = !insufficient && complianceRate < 0.8;
  return {
    status: insufficient ? 'INSUFFICIENT_N' : fail ? 'FAIL' : 'PASS',
    gate: 'Spontaneous help-ladder compliance >= 80% after learner struggle or false mastery',
    relevantTransitions: relevant,
    compliantTransitions: compliant,
    complianceRate,
    levelCounts,
    violations: violations.slice(0, 12),
  };
}

function hasLearnerEvidence(text) {
  const cleaned = cleanText(text);
  if (!isAssessableLearnerText(cleaned) || FALSE_MASTERY_RE.test(cleaned)) return false;
  const words = cleaned.split(/\s+/).filter(Boolean).length;
  if (/^(?:yes|yeah|ok|okay)\b/i.test(cleaned) && words < 20) return false;
  if (LEARNER_EVIDENCE_RE.test(cleaned) && words >= 8) return true;
  if (
    words >= 8 &&
    /\b(?:recognition|monotonic|assumption|constitutive|evidence|reason|claim|argument|function|simulation|dialectic|master|slave|premise|proof|example)\b/i.test(
      cleaned,
    )
  ) {
    return true;
  }
  return words >= 28 && !STRUGGLE_RE.test(cleaned);
}

function isAssessableLearnerText(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return false;
  if (/^learner:\s*[a-z_]+$/i.test(cleaned)) return false;
  if (/^(?:asked_followup|deepening_engagement|surface_acknowledgment|confusion|resistance)$/i.test(cleaned))
    return false;
  return cleaned.split(/\s+/).filter(Boolean).length >= 3;
}

function auditMasteryGate(dialogues) {
  let closureClaims = 0;
  let unsupported = 0;
  let unassessable = 0;
  const violations = [];
  const byVariant = {};
  for (const dialogue of dialogues) {
    const variant = dialogue.variant || 'dialogue';
    if (!byVariant[variant]) {
      byVariant[variant] = { closureClaims: 0, unsupported: 0, unassessable: 0, unsupportedRate: 0 };
    }
    for (const ctx of tutorTurnsWithContext(dialogue)) {
      if (!CLOSURE_RE.test(ctx.turn.text)) continue;
      if (!isAssessableLearnerText(ctx.previousLearner?.text || '')) {
        unassessable++;
        byVariant[variant].unassessable++;
        continue;
      }
      closureClaims++;
      byVariant[variant].closureClaims++;
      const supported = ctx.previousLearner && hasLearnerEvidence(ctx.previousLearner.text);
      if (!supported) {
        unsupported++;
        byVariant[variant].unsupported++;
        violations.push({
          source: dialogue.source,
          variant,
          family: dialogue.family,
          profileName: dialogue.profileName,
          turn: ctx.turn.turn,
          learner: sampleText(ctx.previousLearner?.text || ''),
          tutor: sampleText(ctx.turn.text),
        });
      }
    }
  }
  for (const value of Object.values(byVariant)) value.unsupportedRate = rate(value.unsupported, value.closureClaims);
  const unsupportedRate = rate(unsupported, closureClaims);
  const insufficient = closureClaims < 10;
  const fail = !insufficient && unsupportedRate > 0.15;
  return {
    status: insufficient ? 'INSUFFICIENT_N' : fail ? 'FAIL' : 'PASS',
    gate: 'Unsupported mastery/advancement closure <= 15% with n >= 10',
    closureClaims,
    unsupported,
    unassessable,
    unsupportedRate,
    byVariant,
    violations: violations.slice(0, 12),
  };
}

function auditLearnerFidelityProxy(dialogues) {
  let learnerTurns = 0;
  let falseMastery = 0;
  let struggle = 0;
  let metacognitive = 0;
  let flips = 0;
  const examples = { falseMastery: [], flips: [], metacognitive: [] };
  for (const dialogue of dialogues) {
    for (const turn of dialogue.turns) {
      if (turn.role !== 'learner') continue;
      learnerTurns++;
      const text = cleanText(turn.text);
      if (text.length <= 90 && FALSE_MASTERY_RE.test(text)) {
        falseMastery++;
        pushExample(examples.falseMastery, {
          source: dialogue.source,
          variant: dialogue.variant,
          text: sampleText(text),
        });
      }
      if (STRUGGLE_RE.test(text)) struggle++;
      if (METACOGNITIVE_RE.test(text)) {
        metacognitive++;
        pushExample(examples.metacognitive, {
          source: dialogue.source,
          variant: dialogue.variant,
          text: sampleText(text),
        });
      }
      if (FLIP_RE.test(text)) {
        flips++;
        pushExample(examples.flips, { source: dialogue.source, variant: dialogue.variant, text: sampleText(text) });
      }
    }
  }
  return {
    status: 'PROXY_ONLY',
    gate: 'Descriptive only: prompted learner fidelity cannot be validated without human/item anchors',
    learnerTurns,
    falseMastery,
    falseMasteryRate: rate(falseMastery, learnerTurns),
    struggle,
    struggleRate: rate(struggle, learnerTurns),
    metacognitive,
    metacognitiveRate: rate(metacognitive, learnerTurns),
    flips,
    flipRate: rate(flips, learnerTurns),
    examples,
  };
}

function pushExample(list, item) {
  if (list.length < 8) list.push(item);
}

function firstLocalizableError(arm) {
  if (!arm || arm.missing || arm.failureMode === 'grounded') return null;
  const evidence = arm.evidence || {};
  const release = Array.isArray(evidence.fatalReleases) ? evidence.fatalReleases[0] : null;
  if (release && Number.isFinite(release.turn)) {
    return {
      type: 'fatal_release',
      turn: release.turn,
      premise: release.premise || null,
      reason: release.reason || null,
    };
  }
  const slip = Array.isArray(evidence.unrepairedSlips) ? evidence.unrepairedSlips[0] : null;
  if (slip && Number.isFinite(slip.decayTurn)) {
    return { type: 'unrepaired_decay', turn: slip.decayTurn, premise: slip.premiseId || null, reason: null };
  }
  const terminal = Array.isArray(evidence.terminalOpenWindows) ? evidence.terminalOpenWindows[0] : null;
  if (terminal && Number.isFinite(terminal.turn)) {
    return { type: 'terminal_open_window', turn: terminal.turn, premise: terminal.played || null, reason: null };
  }
  return null;
}

function auditFirstErrorLocalization(arms) {
  const failures = arms.filter((arm) => arm && !arm.missing && arm.failureMode && arm.failureMode !== 'grounded');
  const localized = [];
  const unlocalized = [];
  for (const arm of failures) {
    const first = firstLocalizableError(arm);
    if (first) localized.push({ arm: arm.arm, reportPath: arm.reportPath, failureMode: arm.failureMode, first });
    else
      unlocalized.push({
        arm: arm.arm,
        reportPath: arm.reportPath,
        failureMode: arm.failureMode,
        reasons: arm.reasons || [],
      });
  }
  const localizableRate = rate(localized.length, failures.length);
  const insufficient = failures.length < 5;
  const fail = !insufficient && localizableRate < 0.9;
  return {
    status: insufficient ? 'INSUFFICIENT_N' : fail ? 'FAIL' : 'PASS',
    gate: '>= 90% of non-grounding detector arms carry a deterministic first-error locator',
    detectorReports: [...new Set(arms.map((a) => a.reportPath))].length,
    failureArms: failures.length,
    localized: localized.length,
    localizableRate,
    examples: localized.slice(0, 12),
    unlocalized: unlocalized.slice(0, 12),
    caveat: 'This closes only the artifact precondition, not an LLM localization accuracy test.',
  };
}

function auditIrtReadiness(pilotItemsPath) {
  const text = fs.existsSync(pilotItemsPath) ? fs.readFileSync(pilotItemsPath, 'utf8') : '';
  const placeholder = /PLACEHOLDER CONTENT|NOT FOR DATA COLLECTION|psychometric properties are not established/i.test(
    text,
  );
  const itemCount = (text.match(/^\s*-\s+id:/gm) || []).length;
  return {
    status: placeholder ? 'BLOCKED_BY_ITEM_BANK' : 'READY_FOR_ITEM_RESPONSES',
    gate: 'IRT placement requires human-anchored, psychometrically meaningful items and response data',
    pilotItemsPath: compactPath(pilotItemsPath),
    itemCount,
    placeholder,
    nextStep: placeholder
      ? 'Replace placeholder fractions items with NAEP-derived/approved items, then collect persona responses and human p-values.'
      : 'Generate persona responses against the approved item bank and fit/report ability placement.',
  };
}

function auditSfsReadiness(dialogues) {
  const trapLike = dialogues.filter((d) =>
    /adaptive-|false_mastery|misrecognition|resistance|sophistication/i.test(d.source),
  );
  return {
    status: 'SCAFFOLDED_NOT_RUN',
    gate: 'Selective Flip Score requires targeted, mismatched, and generic feedback generations over the same seeded misconception',
    reusableTrapDialogues: trapLike.length,
    requiredFreshGenerations:
      '~144 single-turn generations unless a matched targeted/mismatched/generic corpus is materialized first',
    nextStep:
      'Materialize a JSONL with misconception id, feedback condition, pre/post learner answer, and deterministic flip label; this harness can then add the SFS computation.',
  };
}

function summarizeBy(records, keyFn, valueFn) {
  const groups = {};
  for (const record of records) {
    const key = keyFn(record);
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  }
  const out = {};
  for (const [key, subset] of Object.entries(groups)) out[key] = valueFn(subset);
  return out;
}

function rate(n, d) {
  return d ? n / d : null;
}

function pct(value) {
  return value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function int(value) {
  return Number.isFinite(value) ? String(value) : '0';
}

function statusIcon(status) {
  if (status === 'PASS') return 'PASS';
  if (status === 'FAIL') return 'FAIL';
  if (status.startsWith('INSUFFICIENT')) return 'INSUFFICIENT';
  if (status.startsWith('BLOCKED')) return 'BLOCKED';
  if (status === 'PROXY_ONLY') return 'PROXY';
  return status;
}

function exampleRecord(record) {
  return {
    source: record.source,
    kind: record.kind,
    family: record.family,
    profileName: record.profileName,
    scenarioId: record.scenarioId,
    field: record.field,
    hits: record.hits,
    text: sampleText(record.text),
  };
}

function renderSummaryTable(audits) {
  const rows = [
    [
      'Answer leak/risk',
      statusIcon(audits.answerLeak.status),
      `${int(audits.answerLeak.highRiskMessages)}/${int(audits.answerLeak.totalMessages)} high-risk (${pct(audits.answerLeak.highRiskRate)})`,
      audits.answerLeak.gate,
    ],
    [
      'Help ladder',
      statusIcon(audits.helpLadder.status),
      `${int(audits.helpLadder.compliantTransitions)}/${int(audits.helpLadder.relevantTransitions)} compliant (${pct(audits.helpLadder.complianceRate)})`,
      audits.helpLadder.gate,
    ],
    [
      'Mastery gate phase 0',
      statusIcon(audits.masteryGate.status),
      `${int(audits.masteryGate.unsupported)}/${int(audits.masteryGate.closureClaims)} assessable unsupported closures (${pct(audits.masteryGate.unsupportedRate)})`,
      audits.masteryGate.gate,
    ],
    [
      'Learner fidelity',
      statusIcon(audits.learnerFidelity.status),
      `${int(audits.learnerFidelity.falseMastery)}/${int(audits.learnerFidelity.learnerTurns)} false-mastery turns (${pct(audits.learnerFidelity.falseMasteryRate)})`,
      audits.learnerFidelity.gate,
    ],
    [
      'First-error localization',
      statusIcon(audits.firstError.status),
      `${int(audits.firstError.localized)}/${int(audits.firstError.failureArms)} localizable failure arms (${pct(audits.firstError.localizableRate)})`,
      audits.firstError.gate,
    ],
    ['SFS', statusIcon(audits.sfs.status), audits.sfs.requiredFreshGenerations, audits.sfs.gate],
    [
      'IRT ability placement',
      statusIcon(audits.irt.status),
      `${audits.irt.itemCount} pilot item stubs`,
      audits.irt.gate,
    ],
  ];

  const lines = ['| audit | status | observed metric | gate |', '|---|---:|---:|---|'];
  for (const row of rows) lines.push(`| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} |`);
  return lines;
}

function renderExamples(title, rows, columns) {
  const lines = [`### ${title}`, ''];
  if (!rows.length) {
    lines.push('No examples.');
    lines.push('');
    return lines;
  }
  lines.push(`| ${columns.map((c) => c.label).join(' | ')} |`);
  lines.push(`|${columns.map(() => '---').join('|')}|`);
  for (const row of rows) {
    lines.push(`| ${columns.map((c) => escapeCell(c.value(row))).join(' | ')} |`);
  }
  lines.push('');
  return lines;
}

function escapeCell(value) {
  return cleanText(value).replace(/\|/g, '\\|');
}

function renderMarkdown(report) {
  const { inputs, corpus, audits } = report;
  const lines = [];
  lines.push('# Plan 3.0 synthetic closure audits');
  lines.push('');
  lines.push('Offline audit over existing artifacts. No LLM calls were made.');
  lines.push('');
  lines.push('## Inputs');
  lines.push('');
  lines.push(`- Worktree: \`${ROOT_DIR}\``);
  lines.push(`- DB: \`${inputs.dbPath ? compactPath(inputs.dbPath) : 'not found'}\``);
  lines.push(`- Logs: \`${inputs.logsDir ? compactPath(inputs.logsDir) : 'not found'}\``);
  lines.push(`- Exports: \`${compactPath(inputs.exportsDir)}\``);
  lines.push('');
  lines.push('## Corpus');
  lines.push('');
  lines.push(`- DB rows read: ${corpus.dbRows}`);
  lines.push(`- DB/log recommendation texts: ${corpus.responseRecords}`);
  lines.push(`- Dialogue records: ${corpus.dialogues}`);
  lines.push(`- Tutor turns: ${corpus.tutorTurns}`);
  lines.push(`- Learner turns: ${corpus.learnerTurns}`);
  lines.push(`- Tutor log files read: ${corpus.logFiles}`);
  lines.push(`- Dramatic derivation result files read: ${corpus.resultFiles}`);
  lines.push(`- Detector arms read: ${corpus.detectorArms}`);
  if (report.dbError) lines.push(`- DB warning: ${report.dbError}`);
  lines.push('');
  lines.push('## Gate Summary');
  lines.push('');
  lines.push(...renderSummaryTable(audits));
  lines.push('');
  lines.push('## Notes On Closure');
  lines.push('');
  lines.push(
    '- Answer-leak is an answer-delivery/public-hidden-label risk audit, not a canonical item-key leak audit. Item-specific answer keys are not available across the whole historical corpus.',
  );
  lines.push(
    '- Mastery-gate phase 0 is a static replay/proxy over existing original and counterfactual logs. It does not build a new gated tutor cell.',
  );
  lines.push(
    '- Learner fidelity is descriptive only. It quantifies false-mastery, flip, and metacognitive proxies, but cannot validate realism without human/item anchors.',
  );
  lines.push(
    '- First-error localization closes the deterministic artifact precondition only. A model-vs-model localization accuracy test would require fresh judging.',
  );
  lines.push('');
  lines.push('## Answer Leak/Risk');
  lines.push('');
  lines.push(`Gate: ${audits.answerLeak.gate}.`);
  lines.push('');
  lines.push('| family | n | high-risk | rate |');
  lines.push('|---|---:|---:|---:|');
  for (const [family, row] of Object.entries(audits.answerLeak.byFamily)) {
    lines.push(`| ${family} | ${row.n} | ${row.highRisk} | ${pct(row.highRiskRate)} |`);
  }
  lines.push('');
  lines.push(
    ...renderExamples('Answer-risk examples', audits.answerLeak.examples, [
      { label: 'source', value: (r) => r.source },
      { label: 'family', value: (r) => r.family },
      { label: 'hits', value: (r) => (r.hits || []).join(', ') },
      { label: 'text', value: (r) => r.text },
    ]),
  );
  lines.push('## Help Ladder');
  lines.push('');
  lines.push(`Gate: ${audits.helpLadder.gate}.`);
  lines.push('');
  lines.push(
    `Relevant transitions: ${audits.helpLadder.relevantTransitions}; compliant: ${audits.helpLadder.compliantTransitions}; compliance: ${pct(audits.helpLadder.complianceRate)}.`,
  );
  lines.push('');
  lines.push('| help level | count |');
  lines.push('|---|---:|');
  for (const [level, count] of Object.entries(audits.helpLadder.levelCounts)) lines.push(`| ${level} | ${count} |`);
  lines.push('');
  lines.push(
    ...renderExamples('Help-ladder violations', audits.helpLadder.violations, [
      { label: 'source', value: (r) => r.source },
      { label: 'variant', value: (r) => r.variant },
      { label: 'jump', value: (r) => `${r.previousLevel}->${r.currentLevel}` },
      { label: 'learner', value: (r) => r.learner },
      { label: 'tutor', value: (r) => r.tutor },
    ]),
  );
  lines.push('## Mastery Gate Phase 0');
  lines.push('');
  lines.push(`Gate: ${audits.masteryGate.gate}.`);
  lines.push('');
  lines.push('| variant | closure claims | unsupported | rate |');
  lines.push('|---|---:|---:|---:|');
  for (const [variant, row] of Object.entries(audits.masteryGate.byVariant)) {
    lines.push(
      `| ${variant} | ${row.closureClaims}${row.unassessable ? ` (+${row.unassessable} unassessable)` : ''} | ${row.unsupported} | ${pct(row.unsupportedRate)} |`,
    );
  }
  lines.push('');
  lines.push(`Unassessable closure-like turns excluded from the denominator: ${audits.masteryGate.unassessable}.`);
  lines.push('');
  lines.push(
    ...renderExamples('Unsupported closure examples', audits.masteryGate.violations, [
      { label: 'source', value: (r) => r.source },
      { label: 'variant', value: (r) => r.variant },
      { label: 'learner before closure', value: (r) => r.learner },
      { label: 'tutor closure', value: (r) => r.tutor },
    ]),
  );
  lines.push('## Learner Fidelity Proxy');
  lines.push('');
  lines.push(
    `Learner turns: ${audits.learnerFidelity.learnerTurns}; false mastery: ${audits.learnerFidelity.falseMastery} (${pct(audits.learnerFidelity.falseMasteryRate)}); flips: ${audits.learnerFidelity.flips} (${pct(audits.learnerFidelity.flipRate)}); metacognitive turns: ${audits.learnerFidelity.metacognitive} (${pct(audits.learnerFidelity.metacognitiveRate)}).`,
  );
  lines.push('');
  lines.push(
    ...renderExamples('False-mastery learner examples', audits.learnerFidelity.examples.falseMastery, [
      { label: 'source', value: (r) => r.source },
      { label: 'variant', value: (r) => r.variant },
      { label: 'text', value: (r) => r.text },
    ]),
  );
  lines.push('## First-Error Localization');
  lines.push('');
  lines.push(`Gate: ${audits.firstError.gate}. ${audits.firstError.caveat}`);
  lines.push('');
  lines.push(
    `Detector reports: ${audits.firstError.detectorReports}; failure arms: ${audits.firstError.failureArms}; localizable: ${audits.firstError.localized} (${pct(audits.firstError.localizableRate)}).`,
  );
  lines.push('');
  lines.push(
    ...renderExamples('First-error examples', audits.firstError.examples, [
      { label: 'arm', value: (r) => r.arm },
      { label: 'mode', value: (r) => r.failureMode },
      {
        label: 'first error',
        value: (r) => `${r.first.type}@t${r.first.turn}${r.first.premise ? ` ${r.first.premise}` : ''}`,
      },
      { label: 'report', value: (r) => r.reportPath },
    ]),
  );
  lines.push('## SFS And IRT');
  lines.push('');
  lines.push(`- SFS: ${audits.sfs.status}. ${audits.sfs.nextStep}`);
  lines.push(`- IRT: ${audits.irt.status}. ${audits.irt.nextStep}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputs = discoverInputs(args);
  const { rows: dbRows, error: dbError } = await loadDbRows(inputs.dbPath, args.rowLimit);
  const dbResponseRecords = loadDbRecommendationRecords(dbRows);
  const artifacts = loadDialogueArtifacts(inputs, args);
  const detectorArms = loadDetectorArms(inputs.exportsDir);

  const tutorTurnRecords = artifacts.dialogues.flatMap((dialogue) =>
    dialogue.turns
      .filter((turn) => turn.role === 'tutor')
      .map((turn) => ({
        source: dialogue.source,
        kind: 'dialogue_tutor_turn',
        role: 'tutor',
        family: dialogue.family,
        profileName: dialogue.profileName,
        scenarioId: dialogue.scenarioId,
        field: `turn:${turn.turn}`,
        text: turn.text,
      })),
  );
  const answerRecords = [...dbResponseRecords, ...artifacts.responseRecords, ...tutorTurnRecords];

  const audits = {
    answerLeak: auditAnswerLeak(answerRecords),
    helpLadder: auditHelpLadder(artifacts.dialogues),
    masteryGate: auditMasteryGate(artifacts.dialogues),
    learnerFidelity: auditLearnerFidelityProxy(artifacts.dialogues),
    firstError: auditFirstErrorLocalization(detectorArms),
    irt: auditIrtReadiness(inputs.pilotItemsPath),
    sfs: auditSfsReadiness(artifacts.dialogues),
  };

  const corpus = {
    dbRows: dbRows.length,
    responseRecords: dbResponseRecords.length + artifacts.responseRecords.length,
    dialogues: artifacts.dialogues.length,
    tutorTurns: tutorTurnRecords.length,
    learnerTurns: artifacts.dialogues.flatMap((d) => d.turns).filter((t) => t.role === 'learner').length,
    logFiles: artifacts.counts.logFiles,
    resultFiles: artifacts.counts.resultFiles,
    detectorArms: detectorArms.length,
  };
  const report = { generatedAt: new Date().toISOString(), inputs, corpus, dbError, audits };

  fs.mkdirSync(args.outDir, { recursive: true });
  const jsonPath = path.join(args.outDir, 'summary.json');
  const mdPath = path.join(args.outDir, 'report.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report));

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Plan 3.0 synthetic closure audits written:`);
    console.log(`  ${compactPath(jsonPath)}`);
    console.log(`  ${compactPath(mdPath)}`);
    for (const [name, audit] of Object.entries(audits)) {
      console.log(`  ${name}: ${audit.status}`);
    }
  }

  const hardFailures = [audits.answerLeak, audits.helpLadder, audits.masteryGate, audits.firstError].filter(
    (audit) => audit.status === 'FAIL',
  );
  process.exitCode = hardFailures.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
