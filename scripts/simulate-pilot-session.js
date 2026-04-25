#!/usr/bin/env node
/**
 * simulate-pilot-session — generate sample A1 pilot data for review
 *
 * Walks N synthetic participants through the full pilot flow end-to-end:
 *   enroll → consent → intake → pretest → tutoring → posttest → exit
 *
 * The TUTOR side is real (hits /api/chat/turn against actual OpenRouter
 * models per cell config). The LEARNER side is simulated by a persona-shaped
 * LLM call that produces 1-2 sentence replies in character. Pre/post
 * answers are probabilistic with a condition-modulated boost (cell_5 gets
 * a larger pretest→posttest improvement than cell_1, encoding the paper's
 * H1 so the analyst preview shows a plausible signal).
 *
 * Writes to `data/pilot-simulation.db` by default (NOT prod evaluations.db),
 * so reruns don't pollute the real pilot table.
 *
 * Usage:
 *   node scripts/simulate-pilot-session.js                           # 2 sessions, one per condition
 *   node scripts/simulate-pilot-session.js --participants 4          # 4 sessions, balanced random
 *   node scripts/simulate-pilot-session.js --condition cell_5_...    # force a condition
 *   node scripts/simulate-pilot-session.js --persona eager_novice    # pick persona
 *   node scripts/simulate-pilot-session.js --turns 7                 # tutor exchanges per session
 *   node scripts/simulate-pilot-session.js --report-file out.md      # write report to disk
 *   node scripts/simulate-pilot-session.js --no-report               # skip stdout report
 *   node scripts/simulate-pilot-session.js --db <path>               # custom DB
 *
 * Cost: ~$0.005-0.015 per session (nemotron is cheap).
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ─── CLI parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {
    participants: null,           // resolves to 2 if not set
    condition: null,
    persona: 'eager_novice',
    turns: 5,
    reportFile: null,
    noReport: false,
    db: null,
    seed: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--participants') out.participants = parseInt(argv[++i], 10);
    else if (a === '--condition') out.condition = argv[++i];
    else if (a === '--persona') out.persona = argv[++i];
    else if (a === '--turns') out.turns = parseInt(argv[++i], 10);
    else if (a === '--report-file') out.reportFile = argv[++i];
    else if (a === '--no-report') out.noReport = true;
    else if (a === '--db') out.db = argv[++i];
    else if (a === '--seed') out.seed = parseInt(argv[++i], 10);
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(__filename, 'utf-8').slice(0, 1500));
      process.exit(0);
    }
  }
  return out;
}

// ─── Personas ─────────────────────────────────────────────────────────────

const PERSONAS = {
  eager_novice: {
    name: 'Sam',
    blurb: 'a curious adult learner who is a little nervous about math but trying',
    intake: { age_band: '25–34', prior_math: 'high_school', comfort_self: 2 },
    pretestProb: 0.35,
    posttestBoost: { cell_1_base_single_unified: 0.05, cell_5_recog_single_unified: 0.20 },
    starter: "hi i'm trying to get my head around fractions again. adding them is the part that always confuses me — like what does 1/2 + 1/3 even equal?",
    systemPromptExtras:
      'You are nervous about math but eager to learn. Type 1-2 sentences. Use lower-case, casual punctuation. Sometimes say "ohhh" or "wait" when something clicks.',
  },
  confused_novice: {
    name: 'Alex',
    blurb: 'an adult learner who finds math overwhelming and asks a lot of clarifying questions',
    intake: { age_band: '35–44', prior_math: 'some_high_school', comfort_self: 1 },
    pretestProb: 0.28,
    posttestBoost: { cell_1_base_single_unified: 0.04, cell_5_recog_single_unified: 0.16 },
    starter: 'fractions confuse me. i never really got why the bottom number matters. can you start simple?',
    systemPromptExtras:
      'You feel overwhelmed quickly and ask the tutor to slow down or repeat. 1-2 sentences. Casual tone.',
  },
  focused_achiever: {
    name: 'Jordan',
    blurb: 'an adult learner who studied math a while ago and wants quick efficient explanations',
    intake: { age_band: '25–34', prior_math: 'some_college', comfort_self: 4 },
    pretestProb: 0.65,
    posttestBoost: { cell_1_base_single_unified: 0.03, cell_5_recog_single_unified: 0.10 },
    starter: 'I remember most fraction operations but I want to make sure I really understand why common denominators are needed. Can you walk me through it?',
    systemPromptExtras:
      'You are direct, focused, and want efficient explanations. 1-2 sentences. Standard punctuation.',
  },
};

// ─── HTTP helper ─────────────────────────────────────────────────────────

function request(baseUrl, method, route, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}${route}`);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        if (res.statusCode >= 400) {
          return reject(new Error(`${method} ${route} → ${res.statusCode}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`));
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Simulated learner ────────────────────────────────────────────────────

// Use a strong instruction-following model for the learner so chain-of-thought
// doesn't leak into the typed message. Haiku 4.5 is cheap and reliably stays
// in character.
const LEARNER_MODEL = process.env.SIM_LEARNER_MODEL || 'anthropic/claude-haiku-4.5';

async function generateLearnerReply({ persona, history, apiKey }) {
  const sys = `You are role-playing as ${persona.name}, ${persona.blurb}.
${persona.systemPromptExtras}

You are texting with an AI tutor about adding fractions. Output ONLY ${persona.name}'s next reply — nothing else.

STRICT OUTPUT RULES:
- One or two short sentences maximum.
- No preamble, no thinking, no narration, no role labels, no quotes.
- Do NOT say "Let me think" or "I should respond" or describe what you're doing — just say it.
- If a step makes sense, say so naturally in character.
- Do NOT pretend to be the tutor or repeat what the tutor said.
- If you don't understand, say so simply and ask one short question.`;

  // Chat-format: tutor messages as 'user' (incoming), prior learner messages as
  // 'assistant' (model's own outputs). The next assistant message IS the next
  // learner reply. This is the natural shape for the API and produces clean
  // output without CoT leakage.
  const messages = [];
  for (const t of history) {
    messages.push({
      role: t.role === 'tutor' ? 'user' : 'assistant',
      content: t.content,
    });
  }

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 45_000);
  let res;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost/sim',
        'X-Title': 'pilot-simulator',
      },
      body: JSON.stringify({
        model: LEARNER_MODEL,
        messages: [{ role: 'system', content: sys }, ...messages],
        temperature: 0.8,
        max_tokens: 120,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`learner LLM ${res.status}: ${text.slice(0, 200)}`);
  }
  const payload = await res.json();
  let content = payload.choices?.[0]?.message?.content?.trim() || '';
  // Defensive strips in case any leakage slips through
  content = content.replace(new RegExp(`^${persona.name}:\\s*`, 'i'), '').trim();
  content = content.replace(/^["']|["']$/g, '').trim();
  // If the reply starts with a meta-reasoning lead-in, keep only the last
  // sentence (a fallback for weaker models)
  if (/^(we need to|i should|let me think|the user|sam should)/i.test(content)) {
    const sentences = content.split(/(?<=[.!?])\s+/);
    content = sentences[sentences.length - 1] || content;
  }
  return content || '(silence)';
}

// ─── Probabilistic test answers ──────────────────────────────────────────

function pickResponse(item, pCorrect) {
  if (Math.random() < pCorrect) return item.correct;
  const wrong = item.choices.filter((c) => c.value !== item.correct);
  return wrong[Math.floor(Math.random() * wrong.length)].value;
}

function buildResponses(items, pCorrect) {
  return items.map((it, i) => ({
    item_id: it.id,
    item_position: i,
    response_value: pickResponse({ ...it, correct: ITEM_CORRECT_BY_ID.get(it.id) }, pCorrect),
    response_ms: Math.floor(2000 + Math.random() * 6000),
  }));
}

// We need the answer key client-side for the simulator. Load it directly.
const ITEM_CORRECT_BY_ID = new Map();
async function loadAnswerKey() {
  const yaml = await import('yaml');
  const itemsPath = path.join(ROOT_DIR, 'config', 'pilot', 'fractions-items.yaml');
  const raw = fs.readFileSync(itemsPath, 'utf-8');
  const parsed = yaml.parse(raw);
  for (const form of ['A', 'B']) {
    for (const it of parsed.forms[form]) {
      ITEM_CORRECT_BY_ID.set(it.id, it.correct);
    }
  }
}

// ─── Exit survey synthesis ───────────────────────────────────────────────

function plausibleExitSurvey(persona, condition, deltaItems) {
  const recog = condition.includes('recog');
  const base = (lo, hi) => Math.floor(lo + Math.random() * (hi - lo + 1));
  return {
    nasa_tlx: {
      mental: base(2, 4),
      physical: 1,
      temporal: base(1, 2),
      performance: deltaItems > 0 ? base(3, 5) : base(2, 3),
      effort: persona.pretestProb < 0.4 ? base(3, 5) : base(2, 3),
      frustration: recog ? base(1, 2) : base(2, 4),
    },
    engagement_likert: {
      understood: recog ? base(4, 5) : base(2, 4),
      would_use_again: recog ? base(4, 5) : base(2, 4),
      learned_something: deltaItems > 0 ? base(3, 5) : base(2, 4),
    },
    open_ended: {
      tutor_got_right: recog
        ? 'It used a pizza analogy that finally made the common-denominator thing click.'
        : 'It explained the steps clearly enough.',
      felt_misunderstood: recog
        ? ''
        : 'It moved on before I really understood why the bottom number stays.',
    },
  };
}

// ─── Simulate one session ────────────────────────────────────────────────

async function simulateSession({ baseUrl, condition, personaId, turns, apiKey, adminToken }) {
  const persona = PERSONAS[personaId];
  if (!persona) throw new Error(`unknown persona: ${personaId}`);

  // 1. enroll
  const enroll = await request(baseUrl, 'POST', '/api/pilot/enroll',
    condition ? { force_condition: condition } : {});
  const sessionId = enroll.session.id;

  // 2. consent
  await request(baseUrl, 'POST', `/api/pilot/session/${sessionId}/consent`, { consented: true });

  // 3. intake
  await request(baseUrl, 'POST', `/api/pilot/session/${sessionId}/intake`, persona.intake);

  // 4. pretest
  await request(baseUrl, 'POST', `/api/pilot/session/${sessionId}/pretest/start`);
  const preItems = await request(baseUrl, 'GET', `/api/pilot/session/${sessionId}/items?phase=pretest`);
  const preResponses = buildResponses(preItems.items, persona.pretestProb);
  await request(baseUrl, 'POST', `/api/pilot/session/${sessionId}/pretest/submit`, { responses: preResponses });

  // 5. tutoring
  await request(baseUrl, 'POST', `/api/pilot/session/${sessionId}/tutoring/start`);

  const conversation = [];
  let learnerMessage = persona.starter;
  for (let turnIdx = 0; turnIdx < turns; turnIdx++) {
    const tutorResp = await request(baseUrl, 'POST', '/api/chat/turn', {
      sessionId,
      learnerMessage,
    });
    conversation.push({ role: 'learner', content: learnerMessage });
    conversation.push({ role: 'tutor', content: tutorResp.finalMessage });
    if (turnIdx < turns - 1) {
      // generate next learner message
      learnerMessage = await generateLearnerReply({
        persona, history: conversation, apiKey,
      });
    }
  }
  await request(baseUrl, 'POST', `/api/pilot/session/${sessionId}/tutoring/complete`);

  // 6. posttest — boost over pretest based on condition
  await request(baseUrl, 'POST', `/api/pilot/session/${sessionId}/posttest/start`);
  const postItems = await request(baseUrl, 'GET', `/api/pilot/session/${sessionId}/items?phase=posttest`);
  const postProb = Math.min(0.95,
    persona.pretestProb + (persona.posttestBoost[condition] || 0));
  const postResponses = buildResponses(postItems.items, postProb);
  await request(baseUrl, 'POST', `/api/pilot/session/${sessionId}/posttest/submit`, { responses: postResponses });

  // compute deltas for plausible exit survey
  const preCorrect = preResponses.filter((r) => r.response_value === ITEM_CORRECT_BY_ID.get(r.item_id)).length;
  const postCorrect = postResponses.filter((r) => r.response_value === ITEM_CORRECT_BY_ID.get(r.item_id)).length;

  // 7. exit
  const exitPayload = plausibleExitSurvey(persona, condition, postCorrect - preCorrect);
  await request(baseUrl, 'POST', `/api/pilot/session/${sessionId}/exit`, exitPayload);

  // 8. fetch full unblinded view for the report
  const adminView = await request(baseUrl, 'GET', `/api/pilot/admin/session/${sessionId}`,
    null, { 'x-pilot-admin-token': adminToken });
  return { ...adminView, persona: personaId, exitPayload };
}

// ─── Markdown report ─────────────────────────────────────────────────────

function fmt(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function renderReport(data) {
  const s = data.session;
  const turns = data.turns;
  const tests = data.tests;
  const exit = data.exitPayload;
  const personaId = data.persona;

  const pre = tests.filter((t) => t.phase === 'pretest');
  const post = tests.filter((t) => t.phase === 'posttest');
  const preCorrect = pre.filter((t) => t.is_correct).length;
  const postCorrect = post.filter((t) => t.is_correct).length;
  const tutoringMs = s.total_tutoring_ms;

  const lines = [];
  lines.push(`## Session ${s.id}`);
  lines.push('');
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| **Condition (unblinded)** | \`${s.condition_cell}\` |`);
  lines.push(`| **Persona** | ${personaId} |`);
  lines.push(`| **Status** | ${s.status} |`);
  lines.push(`| **Scenario** | ${s.scenario_lecture_ref} |`);
  lines.push(`| **Tutoring duration** | ${fmt(tutoringMs)} |`);
  lines.push(`| **Total turns** | ${turns.length} (${turns.filter(t=>t.role==='tutor').length} tutor, ${turns.filter(t=>t.role==='learner').length} learner) |`);
  lines.push('');

  // Intake
  lines.push('### Intake');
  lines.push('');
  const intake = typeof s.intake_data === 'string' ? JSON.parse(s.intake_data) : (s.intake_data || {});
  for (const [k, v] of Object.entries(intake)) {
    lines.push(`- **${k}**: ${v}`);
  }
  lines.push('');

  // Pretest
  lines.push(`### Pretest — ${preCorrect}/${pre.length} correct (${pre.length ? Math.round(100 * preCorrect / pre.length) : 0}%)`);
  lines.push('');
  lines.push('| # | item | response | correct? | rt |');
  lines.push('|---|---|---|---|---|');
  for (const t of pre) {
    const mark = t.is_correct ? '✓' : '✗';
    lines.push(`| ${t.item_position + 1} | \`${t.item_id}\` | \`${t.response_value}\` | ${mark} | ${fmt(t.response_ms)} |`);
  }
  lines.push('');

  // Tutoring transcript
  lines.push('### Tutoring transcript');
  lines.push('');
  for (const t of turns) {
    const tag = t.role === 'tutor' ? '**Tutor**' : '**Learner**';
    const meta = t.role === 'tutor'
      ? ` _(${fmt(t.latency_ms)}, in:${t.input_tokens} out:${t.output_tokens})_`
      : '';
    lines.push(`#### Turn ${t.turn_index} — ${tag}${meta}`);
    lines.push('');
    // Indent multi-line content as a quote
    const lines2 = (t.content || '').split('\n').map((l) => `> ${l}`);
    lines.push(...lines2);
    lines.push('');
  }

  // Posttest
  const delta = postCorrect - preCorrect;
  const deltaSign = delta > 0 ? `+${delta}` : `${delta}`;
  lines.push(`### Posttest — ${postCorrect}/${post.length} correct (${post.length ? Math.round(100 * postCorrect / post.length) : 0}%)  · Δ ${deltaSign}`);
  lines.push('');
  lines.push('| # | item | response | correct? | rt |');
  lines.push('|---|---|---|---|---|');
  for (const t of post) {
    const mark = t.is_correct ? '✓' : '✗';
    lines.push(`| ${t.item_position + 1} | \`${t.item_id}\` | \`${t.response_value}\` | ${mark} | ${fmt(t.response_ms)} |`);
  }
  lines.push('');

  // Exit
  lines.push('### Exit survey');
  lines.push('');
  lines.push('**NASA-TLX** (1 = low, 5 = high)');
  lines.push('');
  for (const [k, v] of Object.entries(exit.nasa_tlx)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push('');
  lines.push('**Engagement Likert** (1 = strongly disagree, 5 = strongly agree)');
  lines.push('');
  for (const [k, v] of Object.entries(exit.engagement_likert)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push('');
  lines.push('**Open-ended**');
  lines.push('');
  lines.push(`- _What was one moment where you felt the tutor got it right?_`);
  lines.push(`  > ${exit.open_ended.tutor_got_right || '(no response)'}`);
  lines.push(`- _What was one moment where you felt misunderstood?_`);
  lines.push(`  > ${exit.open_ended.felt_misunderstood || '(no response)'}`);
  lines.push('');

  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  // Configure isolated DB BEFORE importing the app
  const dbPath = args.db
    || process.env.SIM_DB_PATH
    || path.join(ROOT_DIR, 'data', 'pilot-simulation.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  process.env.EVAL_DB_PATH = dbPath;
  process.env.PILOT_ALLOW_FORCE_CONDITION = 'true';
  process.env.PILOT_ADMIN_TOKEN = process.env.PILOT_ADMIN_TOKEN || 'simulator-token';

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not set — simulator needs a real LLM');
    process.exit(1);
  }

  await loadAnswerKey();

  const { app } = await import('../server.js');

  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Determine sessions to run
  const allConditions = ['cell_1_base_single_unified', 'cell_5_recog_single_unified'];
  const plan = [];
  if (args.condition) {
    const n = args.participants ?? 1;
    for (let i = 0; i < n; i++) plan.push(args.condition);
  } else {
    const n = args.participants ?? 2;
    for (let i = 0; i < n; i++) plan.push(allConditions[i % allConditions.length]);
  }

  console.error(`Simulating ${plan.length} session(s) at ${baseUrl}`);
  console.error(`DB: ${dbPath}`);
  console.error(`Persona: ${args.persona}, ${args.turns} tutor turns each`);
  console.error('');

  const results = [];
  for (let i = 0; i < plan.length; i++) {
    const condition = plan[i];
    const t0 = Date.now();
    process.stderr.write(`  [${i + 1}/${plan.length}] ${condition} ... `);
    try {
      const data = await simulateSession({
        baseUrl, condition,
        personaId: args.persona,
        turns: args.turns,
        apiKey,
        adminToken: process.env.PILOT_ADMIN_TOKEN,
      });
      results.push(data);
      process.stderr.write(`done (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
    } catch (err) {
      process.stderr.write(`FAILED: ${err.message}\n`);
    }
  }

  server.close();

  // Render report
  if (!args.noReport) {
    const md = [
      `# Pilot Simulation — ${plan.length} sample session(s)`,
      '',
      `_Generated ${new Date().toISOString()} from \`${path.relative(ROOT_DIR, dbPath)}\`_`,
      '',
      ...results.map(renderReport),
    ].join('\n');

    if (args.reportFile) {
      fs.writeFileSync(args.reportFile, md);
      console.error(`\nReport written to ${args.reportFile}`);
    } else {
      console.log(md);
    }
  }

  console.error(`\nDone. ${results.length} session(s) in ${dbPath}`);
  console.error('To ingest into evaluation_results:');
  console.error(`  EVAL_DB_PATH=${dbPath} node scripts/ingest-pilot-sessions.js`);

  // Force exit — DB connections opened by the loaded modules don't close
  // automatically and would otherwise keep the process alive.
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[simulate-pilot-session] error:', err);
    process.exit(1);
  });
}

export { simulateSession, renderReport, PERSONAS };
