#!/usr/bin/env node

/**
 * Chat CLI
 *
 * Terminal client for the eval repo's tutor chat API. Talks to a running
 * `npm run dev` server (default http://localhost:8081) so every cell from
 * config/tutor-agents.yaml is reachable without a browser. Same backend
 * the /chat web UI uses — fixes there land here automatically.
 *
 * Usage:
 *   node scripts/chat-cli.js [--cell <name>] [--topic <s>] [--lecture <ref>]
 *                            [--server <url>] [--show] [--cli]
 *
 * Slash commands (in REPL): /help, /info, /cells [filter], /cell <name>,
 *   /topic <s>, /lecture <ref|none>, /curricula, /show, /cli, /clear,
 *   /quit (or /exit).
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { parseArgs } from 'node:util';

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const { values: args } = parseArgs({
  options: {
    cell:    { type: 'string', default: 'cell_1_base_single_unified' },
    topic:   { type: 'string', default: 'general conversation' },
    lecture: { type: 'string' },
    server:  { type: 'string', default: 'http://localhost:8081' },
    show:    { type: 'boolean', default: false },
    cli:     { type: 'boolean', default: false },
    help:    { type: 'boolean', default: false },
  },
});

if (args.help) {
  console.log(`Usage: node scripts/chat-cli.js [options]

  --cell <name>     active cell (default cell_1_base_single_unified)
  --topic <s>       conversation topic (default "general conversation")
  --lecture <ref>   curriculum lecture ref (e.g. 479-lecture-3)
  --server <url>    server base URL (default http://localhost:8081)
  --show            show ego/superego deliberation each turn
  --cli             use local Claude CLI substrate instead of OpenRouter
  --help            this message

Then type messages at the prompt. Slash commands inside the REPL:
  /help, /info, /cells [filter], /cell <name>, /topic <s>,
  /lecture <ref|none>, /curricula, /show, /cli, /clear, /quit
`);
  process.exit(0);
}

const state = {
  server: args.server.replace(/\/$/, ''),
  cellName: args.cell,
  topic: args.topic,
  lectureRef: args.lecture || null,
  showDeliberation: args.show,
  useClaudeCli: args.cli,
  history: [],
  cellsCache: null,
};

async function api(method, urlPath, body) {
  const init = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${state.server}${urlPath}`, init);
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).error || text; } catch { /* keep raw */ }
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return text ? JSON.parse(text) : null;
}

async function checkServer() {
  try {
    return await api('GET', '/health');
  } catch (err) {
    console.error(`${C.red}Cannot reach ${state.server}${C.reset} — ${err.message}`);
    console.error(`Start the server first: ${C.cyan}npm run dev${C.reset}`);
    process.exit(1);
  }
}

async function loadCells() {
  if (!state.cellsCache) {
    const data = await api('GET', '/api/chat/cells');
    state.cellsCache = data.cells;
  }
  return state.cellsCache;
}

async function findCell(name) {
  const cells = await loadCells();
  return cells.find((c) => c.name === name);
}

function formatCellSummary(cell) {
  const parts = [
    cell.promptType || '?',
    `${cell.multiAgentTutor ? 'multi' : 'single'}-agent`,
    cell.learnerArchitecture || '?',
  ];
  if (cell.superego) parts.push('+superego');
  if (cell.recognitionMode && cell.promptType !== 'recognition') parts.push('+recognition');
  if (cell.conversationMode === 'messages') parts.push('messages-mode');
  if (cell.idDirector) parts.push('id-director');
  return parts.join(' · ');
}

function printDeliberation(trace) {
  for (const entry of trace.deliberation || []) {
    const meta = entry.model
      ? ` · ${entry.provider || '?'}/${entry.model}${entry.latencyMs != null ? ` · ${entry.latencyMs}ms` : ''}`
      : '';
    console.log(`\n${C.dim}── ${entry.label || entry.role}${meta}${C.reset}`);
    console.log((entry.content || '').trim());
  }
  console.log();
}

const commands = {
  help() {
    console.log(`
  /help                 this
  /info                 current cell + settings
  /cells [filter]       list cells, optionally filtered
  /cell <name>          switch active cell (clears history)
  /topic <topic>        set conversation topic
  /lecture <ref|none>   set/clear curriculum context
  /curricula            list courses + lecture refs
  /show                 toggle ego/superego trace
  /cli                  toggle Claude CLI substrate
  /clear                reset conversation history
  /quit                 exit
`);
  },
  async info() {
    const cell = await findCell(state.cellName);
    const row = (k, v) => console.log(`  ${k.padEnd(11)}${v}`);
    console.log();
    row('cell', state.cellName);
    if (cell) {
      row('', `${C.dim}${cell.description || ''}${C.reset}`);
      row('', `${C.dim}${formatCellSummary(cell)}${C.reset}`);
    }
    row('topic', state.topic);
    row('lecture', state.lectureRef || '—');
    row('server', state.server);
    row('substrate', state.useClaudeCli ? 'Claude CLI' : 'OpenRouter');
    row('trace', state.showDeliberation ? 'on' : 'off');
    row('history', `${state.history.length} turns`);
    console.log();
  },
  async cells(arg) {
    const cells = await loadCells();
    const filter = (arg || '').toLowerCase();
    const filtered = filter
      ? cells.filter((c) =>
          c.name.toLowerCase().includes(filter)
          || (c.description || '').toLowerCase().includes(filter))
      : cells;
    console.log();
    if (!filtered.length) {
      console.log(`  ${C.dim}no cells match "${filter}"${C.reset}\n`);
      return;
    }
    const limit = 80;
    const shown = filtered.slice(0, limit);
    const nameWidth = Math.max(...shown.map((c) => c.name.length)) + 2;
    for (const c of shown) {
      const marker = c.name === state.cellName ? `${C.cyan}●${C.reset}` : ' ';
      console.log(` ${marker} ${c.name.padEnd(nameWidth)}${C.dim}${formatCellSummary(c)}${C.reset}`);
    }
    if (filtered.length > limit) {
      console.log(`   ${C.dim}… ${filtered.length - limit} more — narrow with /cells <filter>${C.reset}`);
    }
    console.log();
  },
  async cell(arg) {
    if (!arg) return console.log(`${C.red}usage: /cell <name>${C.reset}`);
    const cell = await findCell(arg);
    if (!cell) {
      const hint = arg.split('_')[0];
      return console.log(`${C.red}no cell "${arg}"${C.reset} ${C.dim}— try /cells ${hint}${C.reset}`);
    }
    state.cellName = arg;
    state.history = [];
    console.log(`${C.dim}→${C.reset} ${arg} ${C.dim}· ${formatCellSummary(cell)}${C.reset}`);
  },
  topic(arg) {
    if (!arg) return console.log(`${C.red}usage: /topic <topic>${C.reset}`);
    state.topic = arg;
    console.log(`${C.dim}→ topic · ${arg}${C.reset}`);
  },
  lecture(arg) {
    if (!arg || arg === 'none' || arg === 'off') {
      state.lectureRef = null;
      console.log(`${C.dim}→ lecture · cleared${C.reset}`);
    } else {
      state.lectureRef = arg;
      console.log(`${C.dim}→ lecture · ${arg}${C.reset}`);
    }
  },
  async curricula() {
    const data = await api('GET', '/api/chat/curricula');
    for (const pkg of data.packages || []) {
      console.log(`\n  ${pkg.label} ${C.dim}· ${pkg.dir}${C.reset}`);
      for (const course of pkg.courses) {
        console.log(`    ${course.id} ${C.dim}· ${course.title}${C.reset}`);
        for (const lec of course.lectures.slice(0, 6)) {
          console.log(`      ${C.dim}${lec.ref.padEnd(22)}${C.reset} ${lec.title}`);
        }
        if (course.lectures.length > 6) {
          console.log(`      ${C.dim}… ${course.lectures.length - 6} more${C.reset}`);
        }
      }
    }
    console.log();
  },
  show() {
    state.showDeliberation = !state.showDeliberation;
    console.log(`${C.dim}→ trace · ${state.showDeliberation ? 'on' : 'off'}${C.reset}`);
  },
  cli() {
    state.useClaudeCli = !state.useClaudeCli;
    console.log(`${C.dim}→ substrate · ${state.useClaudeCli ? 'Claude CLI' : 'OpenRouter'}${C.reset}`);
  },
  clear() {
    state.history = [];
    console.log(`${C.dim}→ history cleared${C.reset}`);
  },
  quit() { process.exit(0); },
  exit() { process.exit(0); },
};

async function sendTurn(message) {
  const trace = await api('POST', '/api/chat/turn', {
    cellName: state.cellName,
    history: state.history,
    learnerMessage: message,
    topic: state.topic,
    lectureRef: state.lectureRef,
    useClaudeCli: state.useClaudeCli,
  });
  state.history.push({ role: 'learner', content: message });
  state.history.push({ role: 'tutor', content: trace.finalMessage });
  return trace;
}

async function main() {
  await checkServer();
  const cell = await findCell(state.cellName);
  if (!cell) {
    console.error(`${C.red}unknown cell "${state.cellName}"${C.reset} ${C.dim}— use /cells to list${C.reset}\n`);
  } else {
    console.log(`\n  ${state.cellName}`);
    console.log(`  ${C.dim}${formatCellSummary(cell)} · /help${C.reset}\n`);
  }

  const rl = readline.createInterface({ input, output });
  rl.on('SIGINT', () => { console.log(); process.exit(0); });

  while (true) {
    let line;
    try {
      line = await rl.question(`${C.bold}you ▸${C.reset} `);
    } catch {
      break;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('/')) {
      const [name, ...rest] = trimmed.slice(1).split(/\s+/);
      const handler = commands[name.toLowerCase()];
      if (handler) {
        try { await handler(rest.join(' ')); }
        catch (err) { console.error(`${C.red}Error: ${err.message}${C.reset}`); }
      } else {
        console.log(`${C.red}Unknown command: /${name}${C.reset} (try /help)`);
      }
      continue;
    }

    try {
      process.stdout.write(`${C.dim}…${C.reset}\r`);
      const trace = await sendTurn(trimmed);
      process.stdout.write(' '.repeat(4) + '\r');
      if (state.showDeliberation) printDeliberation(trace);
      console.log(`${C.magenta}tutor ▸${C.reset} ${(trace.finalMessage || '').trim()}`);
      if (trace.totals) {
        const { inputTokens = 0, outputTokens = 0, latencyMs = 0 } = trace.totals;
        const total = inputTokens + outputTokens;
        const revised = trace.wasRevised ? ' · revised' : '';
        console.log(`${C.dim}        ${latencyMs}ms · ${total} tokens${revised}${C.reset}`);
      }
      console.log();
    } catch (err) {
      process.stdout.write(' '.repeat(4) + '\r');
      console.error(`${C.red}error · ${err.message}${C.reset}\n`);
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error(`${C.red}Fatal: ${err.message}${C.reset}`);
  process.exit(1);
});
