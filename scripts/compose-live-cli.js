#!/usr/bin/env node
// Live-compose sit-in, from the terminal — a CLI twin of GET /compose/live.
//
// You play one chair (tutor or learner), the AI plays the other, turn by turn,
// driven by the SAME engine (services/poetics/liveCompose.js) the web sit-in and
// the scored runs use — so a hand-played scene can't drift from them. For fast
// iteration: build a scene from a plain-language description with the LLM guide
// (--describe), or skip the dials entirely with --mock (canned, zero-cost).
//
//   node scripts/compose-live-cli.js                       # metered, you = learner
//   node scripts/compose-live-cli.js --mock                # free, canned AI lines
//   node scripts/compose-live-cli.js --describe "a nervous student splitting log(a+b)"
//   node scripts/compose-live-cli.js --role tutor --topic "the water cycle"
//   node scripts/compose-live-cli.js --lecture 1001-lecture-3 --prompt recognition
//   node scripts/compose-live-cli.js --list-lectures
//
// Metered by default (each AI turn + the --describe guide call is a real
// OpenRouter request, needs OPENROUTER_API_KEY). It is hand-played, so spend is
// always one attended turn at a time. In-play slash commands: /save /scene /help /quit.

import readline from 'node:readline';
import {
  startSession,
  humanTurn,
  saveSession,
  proposeSpec,
  viewSession,
  buildMockDeps,
  buildMockGuideDeps,
  listCourses,
  LIVE_VOCAB,
  DEFAULT_MAX_TURNS,
} from '../services/poetics/liveCompose.js';

// ── tiny ANSI helpers (respect NO_COLOR + non-TTY pipes) ─────────────────────
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const sgr = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s) => sgr('2', s);
const bold = (s) => sgr('1', s);
const moss = (s) => sgr('32', s); // tutor
const ochre = (s) => sgr('33', s); // learner
const brick = (s) => sgr('31', s); // errors
const roleColor = (role) => (role === 'tutor' ? moss : ochre);

// ── arg parsing ──────────────────────────────────────────────────────────────
// --key value, --key=value, and bare --flag. Unknown keys are collected so we can
// warn rather than silently ignore a typo'd dial.
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

const HELP = `live-compose sit-in (CLI)

  node scripts/compose-live-cli.js [options]

Seat & scene
  --role <learner|tutor>     chair you take (default: learner; AI takes the other)
  --topic "<text>"           what the scene is about
  --hamartia "<text>"        the tragic flaw — the wrong idea the learner keeps reaching for
  --opening <tutor|learner>  who speaks first (default: tutor)
  --max-turns <n>            scene length cap (default: ${DEFAULT_MAX_TURNS}, max 40)

AI tutor dials (used when you are the learner)
  --prompt <recognition|base>          stance (default: recognition)
  --tutor-arch <ego_superego|ego_only> deliberation (default: ego_superego)
  --lecture <ref>            ground the tutor in a course lecture (e.g. 1001-lecture-3)

AI learner dials (used when you are the tutor)
  --persona <name>           one of: ${LIVE_VOCAB.personas.join(', ')}
  --learner-arch <name>      one of: ${LIVE_VOCAB.learnerArch.join(', ')}

Guide & cost
  --describe "<plain language>"  let an LLM propose the whole spec, then play it
  --model <ref>              guide model (default: openrouter.sonnet or COMPOSE_GUIDE_MODEL)
  --mock, --free             canned AI lines + canned guide — zero spend, no API key
  --save [filename]          save the transcript when the scene ends

Info
  --list-lectures            print the course/lecture catalog and exit
  --list-personas            print the persona + architecture vocab and exit
  --help                     this

In play, type your line and press Enter. Slash commands: /save [name] · /scene · /help · /quit`;

// ── catalog listings ─────────────────────────────────────────────────────────
function printLectures() {
  const courses = listCourses();
  if (!courses.length) {
    console.log('no course lectures found.');
    return;
  }
  for (const c of courses) {
    const tag = c.isFixture ? dim(' [test fixture]') : '';
    console.log(bold(c.courseTitle) + tag);
    for (const l of c.lectures) {
      console.log('  ' + sgr('36', l.ref) + dim(' · ') + l.title);
    }
    console.log('');
  }
}

function printPersonas() {
  console.log(bold('learner personas') + dim(' (--persona)'));
  for (const p of LIVE_VOCAB.personas) console.log('  ' + p);
  console.log('');
  console.log(bold('learner architectures') + dim(' (--learner-arch)'));
  for (const a of LIVE_VOCAB.learnerArch) console.log('  ' + a);
}

// ── rendering ─────────────────────────────────────────────────────────────────
function indent(text) {
  return String(text)
    .split('\n')
    .map((line) => '    ' + line)
    .join('\n');
}

function printTurn(t) {
  if (!t) return;
  const who = `${t.role} · ${t.by === 'human' ? 'you' : 'ai'}`;
  console.log(roleColor(t.role)(bold(who)));
  console.log(indent(t.text));
  console.log('');
}

function sceneHeader(sess, { mock, model }) {
  const lines = [];
  lines.push(dim('─'.repeat(64)));
  lines.push(bold('  the scene is set'));
  lines.push(`  you are the ${bold(sess.humanRole)} · AI is the ${bold(sess.aiRole)}`);
  lines.push(`  topic: ${sess.topic}`);
  if (sess.hamartia) lines.push(`  hamartia: ${sess.hamartia}`);
  if (sess.aiRole === 'tutor') {
    lines.push(`  AI tutor: cell ${sess.tutorCell}${sess.lectureRef ? ` · teaching ${sess.lectureRef}` : ''}`);
  } else {
    lines.push(`  AI learner: persona ${sess.persona} · ${sess.learnerArchitecture}`);
  }
  lines.push(`  max ${sess.maxTurns} turns`);
  lines.push(`  mode: ${mock ? moss('free preview (canned, no spend)') : brick('metered') + ` · ${model}`}`);
  lines.push(dim('─'.repeat(64)));
  console.log(lines.join('\n'));
  console.log('');
}

function printScene(sess, { mock }) {
  const tok = Number(sess.spend.inputTokens || 0) + Number(sess.spend.outputTokens || 0);
  console.log(dim(`  you=${sess.humanRole} ai=${sess.aiRole} · turn ${sess.turnCount}/${sess.maxTurns}`));
  if (sess.aiRole === 'tutor') {
    console.log(dim(`  AI tutor: cell ${sess.tutorCell}${sess.lectureRef ? ` · ${sess.lectureRef}` : ''}`));
  } else {
    console.log(dim(`  AI learner: ${sess.persona} · ${sess.learnerArchitecture}`));
  }
  console.log(
    dim(`  spend: $${Number(sess.spend.estimatedCostUsd || 0).toFixed(4)} · ${tok} tokens${mock ? ' (mock)' : ''}`),
  );
}

function spendLine(sess) {
  const tok = Number(sess.spend.inputTokens || 0) + Number(sess.spend.outputTokens || 0);
  return dim(
    `    [$${Number(sess.spend.estimatedCostUsd || 0).toFixed(4)} · ${tok} tok · turn ${sess.turnCount}/${
      sess.maxTurns
    }]`,
  );
}

// ── spec assembly ─────────────────────────────────────────────────────────────
// Flags the user passed explicitly; used both to seed the spec and to override a
// guide proposal (an explicit dial always beats the LLM's pick).
function specFromFlags(args) {
  const spec = {};
  const role = args.role === 'tutor' ? 'tutor' : args.role === 'learner' ? 'learner' : undefined;
  if (role) spec.humanRole = role;
  if (typeof args.topic === 'string') spec.topic = args.topic;
  if (typeof args.hamartia === 'string') spec.hamartia = args.hamartia;
  if (typeof args.prompt === 'string') spec.promptType = args.prompt;
  if (typeof args['tutor-arch'] === 'string') spec.tutorArchitecture = args['tutor-arch'];
  if (typeof args.lecture === 'string') spec.lectureRef = args.lecture;
  if (typeof args.persona === 'string') spec.persona = args.persona;
  if (typeof args['learner-arch'] === 'string') spec.learnerArchitecture = args['learner-arch'];
  if (typeof args.opening === 'string') spec.openingSpeaker = args.opening;
  if (args['max-turns'] !== undefined) spec.maxTurns = Number(args['max-turns']) || DEFAULT_MAX_TURNS;
  if (typeof args.model === 'string') spec.model = args.model;
  return spec;
}

function guideCatalog() {
  return { courses: listCourses(), personas: LIVE_VOCAB.personas, learnerArch: LIVE_VOCAB.learnerArch };
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(HELP);
    return;
  }
  if (args['list-lectures']) {
    printLectures();
    return;
  }
  if (args['list-personas']) {
    printPersonas();
    return;
  }

  const mock = Boolean(args.mock || args.free);
  const turnDeps = mock ? buildMockDeps() : {};
  const flagSpec = specFromFlags(args);

  // 1) Optionally let the guide propose the whole spec, then apply explicit flags on top.
  let spec = flagSpec;
  if (typeof args.describe === 'string' && args.describe.trim()) {
    const guideDeps = mock ? buildMockGuideDeps() : {};
    if (typeof args.model === 'string') guideDeps.model = args.model;
    console.log(dim(mock ? 'guide: composing (free preview)…' : 'guide: composing (metered)…'));
    try {
      const proposed = await proposeSpec({ description: args.describe, catalog: guideCatalog() }, guideDeps);
      console.log(moss(bold('  guide set-up: ')) + (proposed.rationale || '(no rationale)'));
      if (proposed.notes) console.log(dim('  ' + proposed.notes));
      console.log('');
      spec = { ...proposed.spec, ...flagSpec }; // explicit flags win
    } catch (e) {
      if (e.code === 'LIVE_NO_API_KEY') {
        console.error(brick('guide needs OPENROUTER_API_KEY — or add --mock for a canned demo.'));
        process.exitCode = 1;
        return;
      }
      console.error(brick('guide failed: ' + (e.message || String(e))));
      process.exitCode = 1;
      return;
    }
  }

  // Match the web sit-in: the AI tutor opens unless a flag or the guide says otherwise.
  if (!spec.openingSpeaker) spec.openingSpeaker = 'tutor';

  const guideModel =
    (typeof args.model === 'string' && args.model) || process.env.COMPOSE_GUIDE_MODEL || 'openrouter.sonnet';

  // 2) Start the session (this may generate the AI's opening turn).
  let view;
  let openingTurn = null;
  try {
    const started = await startSession(spec, turnDeps);
    view = started.session;
    openingTurn = started.openingTurn;
  } catch (e) {
    if (e.code === 'LIVE_NO_API_KEY') {
      console.error(brick('this scene is metered and OPENROUTER_API_KEY is not set — add --mock for a free run.'));
    } else {
      console.error(brick('could not start: ' + (e.message || String(e))));
    }
    process.exitCode = 1;
    return;
  }

  sceneHeader(view, { mock, model: guideModel });
  if (openingTurn) printTurn(openingTurn);

  // 3) Interactive play.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // A line queue rather than per-call rl.question: it absorbs piped bursts (every
  // 'line' is queued) and returns null on EOF, while leaving the interface open so
  // the end-of-scene save prompt still works in a TTY. Resolves null once closed.
  const lineQueue = [];
  const lineWaiters = [];
  let stdinClosed = false;
  rl.on('line', (l) => (lineWaiters.length ? lineWaiters.shift()(l) : lineQueue.push(l)));
  rl.on('close', () => {
    stdinClosed = true;
    while (lineWaiters.length) lineWaiters.shift()(null);
  });
  const nextLine = () => {
    if (lineQueue.length) return Promise.resolve(lineQueue.shift());
    if (stdinClosed) return Promise.resolve(null);
    return new Promise((resolve) => lineWaiters.push(resolve));
  };
  const sessionId = view.id;
  let saved = false;

  const doSave = (name) => {
    try {
      const r = saveSession(sessionId, { filename: name });
      console.log(moss(`  saved ${r.path} · ${r.bytes} bytes`));
      saved = true;
    } catch (e) {
      console.error(brick('  save failed: ' + (e.message || String(e))));
    }
  };

  try {
    const prompt = `${roleColor(view.humanRole)(bold(`${view.humanRole} · you`))} ${dim('›')} `;
    while (view.status === 'live') {
      if (view.nextSpeaker !== view.humanRole) break; // humanTurn always returns control; guard anyway
      process.stdout.write(prompt);
      const raw = await nextLine();
      if (raw === null) break; // stdin EOF (e.g. piped input exhausted)
      const line = String(raw).trim();
      if (!line) continue;

      if (line.startsWith('/')) {
        const [cmd, ...rest] = line.slice(1).split(/\s+/);
        if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') break;
        if (cmd === 'help' || cmd === 'h') {
          console.log(dim('  /save [name] · /scene · /help · /quit'));
        } else if (cmd === 'scene') {
          printScene(view, { mock });
        } else if (cmd === 'save') {
          doSave(rest.join(' ').trim() || undefined);
        } else {
          console.log(dim('  unknown command — /save /scene /help /quit'));
        }
        continue;
      }

      console.log('');
      console.log(dim(`    (the ${view.aiRole} is thinking…)`));
      try {
        const res = await humanTurn(sessionId, line, turnDeps);
        printTurn(res.aiTurn);
        view = res.session;
        console.log(spendLine(view));
        console.log('');
      } catch (e) {
        console.error(brick('  turn failed: ' + (e.message || String(e))));
        view = viewSession(sessionId);
      }
    }

    // 4) Scene end — reported while readline is still open, so we can offer to save.
    console.log(dim('─'.repeat(64)));
    const why = view.status === 'live' ? 'you left' : view.stoppedReason || view.status;
    console.log(`  scene ended (${why}) · ${view.turnCount}/${view.maxTurns} turns · ` + spendLine(view).trim());
    if (!saved && view.turnCount > 0) {
      if (args.save !== undefined) {
        doSave(typeof args.save === 'string' ? args.save : undefined);
      } else if (process.stdin.isTTY && !stdinClosed) {
        process.stdout.write(dim('  save transcript? [y / filename / blank = no]: '));
        const ans = String((await nextLine()) || '').trim();
        const lower = ans.toLowerCase();
        if (ans && lower !== 'n' && lower !== 'no') {
          doSave(lower === 'y' || lower === 'yes' ? undefined : ans);
        } else {
          console.log(dim('  not saved.'));
        }
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  console.error(brick('fatal: ' + (e && e.stack ? e.stack : String(e))));
  process.exitCode = 1;
});
