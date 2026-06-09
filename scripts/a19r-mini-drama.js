#!/usr/bin/env node
/**
 * Fast CLI loop for the A19 rhetoric / mini-drama branch.
 *
 * This script is deliberately offline by default. It creates deterministic
 * candidates, cheap gate reports, and blinded packets for later automated
 * adjudication. Human-coder assignment generation is intentionally out of this
 * branch while A19 stays on the automated path.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  DEFAULT_A18_A19_RHETORICAL_BATTERY,
  DEFAULT_MINI_DRAMA_CARDS,
  DEFAULT_MINI_DRAMA_CODEBOOK,
  DEFAULT_MINI_DRAMA_ONTOLOGY,
  buildMiniDramaPackets,
  generateMiniDramaRun,
  loadMiniDramaCards,
  loadMiniDramaCodebook,
  loadMiniDramaOntology,
  qaMiniDramaRun,
  repoRel,
  runMiniDramaBatteryScreen,
  summarizeMiniDramaBatteryScreen,
  summarizeMiniDramaRun,
  validateMiniDramaCodebook,
} from '../services/miniDramaMachines.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return `Usage:
  node scripts/a19r-mini-drama.js generate [--out exports/a19r/runs/run.json] [--moves a,b] [--card-ids a,b] [--json]
  node scripts/a19r-mini-drama.js screen [--out exports/a19r/runs/battery.json] [--samples-per-card 2] [--seed text] [--json]
  node scripts/a19r-mini-drama.js packetize --run exports/a19r/runs/run.json [--out-dir exports/a19r/adjudication-packets/run]
  node scripts/a19r-mini-drama.js codebook-validate [--json]
  node scripts/a19r-mini-drama.js qa --run exports/a19r/runs/run.json [--json]
  node scripts/a19r-mini-drama.js report --run exports/a19r/runs/run.json [--out exports/a19r/reports/run.json] [--json]

Shared options:
  --ontology config/rhetoric/mini-drama-ontology.v0.1.json
  --cards config/rhetoric/mini-drama-cards.v0.1.json
  --codebook config/rhetoric/mini-drama-codebook.v0.1.json`;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseArgs(argv = process.argv.slice(2)) {
  const command = argv[0] || 'help';
  const args = {
    command,
    ontology: DEFAULT_MINI_DRAMA_ONTOLOGY,
    cards: command === 'screen' ? DEFAULT_A18_A19_RHETORICAL_BATTERY : DEFAULT_MINI_DRAMA_CARDS,
    codebook: DEFAULT_MINI_DRAMA_CODEBOOK,
    run: null,
    out: null,
    outDir: null,
    moves: [],
    cardIds: [],
    candidateIds: [],
    seed: 'a19r-mini-drama-battery-v0.1',
    samplesPerCard: 2,
    json: false,
    help: command === 'help',
  };
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--ontology') args.ontology = path.resolve(argv[++i]);
    else if (token === '--cards') args.cards = path.resolve(argv[++i]);
    else if (token === '--codebook') args.codebook = path.resolve(argv[++i]);
    else if (token === '--run') args.run = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--moves') args.moves = splitCsv(argv[++i]);
    else if (token === '--card-ids') args.cardIds = splitCsv(argv[++i]);
    else if (token === '--candidate-ids') args.candidateIds = splitCsv(argv[++i]);
    else if (token === '--seed') args.seed = argv[++i];
    else if (token === '--samples-per-card') args.samplesPerCard = Number.parseInt(argv[++i], 10);
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (!Number.isInteger(args.samplesPerCard) || args.samplesPerCard < 1) {
    throw new Error('--samples-per-card must be a positive integer');
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function defaultRunPath(run) {
  return path.join(ROOT, 'exports', 'a19r', 'runs', `${run.run_id}.json`);
}

function defaultPacketDir(run) {
  return path.join(ROOT, 'exports', 'a19r', 'adjudication-packets', run.run_id);
}

function renderObject(value, json) {
  if (json) return `${JSON.stringify(value, null, 2)}\n`;
  return null;
}

function loadContext(args) {
  return {
    ontology: loadMiniDramaOntology(args.ontology),
    cardPool: loadMiniDramaCards(args.cards),
    codebook: loadMiniDramaCodebook(args.codebook),
  };
}

function cmdGenerate(args) {
  const { ontology, cardPool } = loadContext(args);
  const run = generateMiniDramaRun({
    ontology,
    cardPool,
    moveIds: args.moves,
    cardIds: args.cardIds,
  });
  const out = args.out || defaultRunPath(run);
  writeJson(out, run);
  const summary = {
    run: repoRel(out),
    run_id: run.run_id,
    candidate_count: run.candidates.length,
    card_count: run.card_ids.length,
    move_count: run.move_ids.length,
    gate_status: qaMiniDramaRun(run).status,
  };
  if (args.json) process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  else {
    process.stdout.write(`A19R mini-drama run: ${summary.run}\n`);
    process.stdout.write(`candidates: ${summary.candidate_count}; gates: ${summary.gate_status}\n`);
  }
}

function cmdScreen(args) {
  const { ontology, cardPool } = loadContext(args);
  const screen = runMiniDramaBatteryScreen({
    ontology,
    cardPool,
    moveIds: args.moves,
    cardIds: args.cardIds,
    samplesPerCard: args.samplesPerCard,
    seed: args.seed,
  });
  const report = summarizeMiniDramaBatteryScreen(screen);
  const out = args.out || defaultRunPath(screen);
  writeJson(out, screen);
  const summary = {
    run: repoRel(out),
    run_id: screen.run_id,
    card_count: screen.card_ids.length,
    candidate_count: screen.candidates.length,
    gate_status: report.gate_status,
    proxy_headroom_rate: report.proxy_headroom_rate,
    feasibility: report.feasibility,
  };
  if (args.json) process.stdout.write(JSON.stringify({ ...summary, report }, null, 2) + '\n');
  else {
    process.stdout.write(`A19R rhetorical battery screen: ${summary.run}\n`);
    process.stdout.write(
      `cards: ${summary.card_count}; candidates: ${summary.candidate_count}; gates: ${summary.gate_status}\n`,
    );
    process.stdout.write(
      `proxy headroom: ${report.proxy_headroom_count}/${summary.candidate_count} (${summary.proxy_headroom_rate}); feasibility: ${summary.feasibility}\n`,
    );
  }
}

function cmdPacketize(args) {
  if (!args.run) throw new Error(`--run is required\n\n${usage()}`);
  const { ontology } = loadContext(args);
  const run = readJson(args.run);
  const packets = buildMiniDramaPackets({ run, ontology, candidateIds: args.candidateIds });
  const outDir = args.outDir || defaultPacketDir(run);
  const written = packets.map((packet) => {
    const packetPath = path.join(outDir, `${packet.packet_id}.packet.json`);
    writeJson(packetPath, packet);
    return {
      packet: repoRel(packetPath),
      packet_id: packet.packet_id,
      coder_packet_sha256: packet.audit.coder_packet_sha256,
    };
  });
  const summary = {
    run: repoRel(args.run),
    packet_count: written.length,
    packets: written,
    automated_branch_note: 'packet_only_no_human_assignment',
  };
  if (args.json) process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  else {
    process.stdout.write(`A19R packets written: ${summary.packet_count}\n`);
    process.stdout.write('human assignment generation: disabled for automated branch\n');
  }
}

function cmdCodebookValidate(args) {
  const { ontology, codebook } = loadContext(args);
  const report = validateMiniDramaCodebook({ codebook, ontology });
  const rendered = renderObject(report, args.json);
  if (rendered) process.stdout.write(rendered);
  else {
    process.stdout.write(`Mini-drama codebook validation: ${report.status}\n`);
    if (report.issues.length) {
      report.issues.forEach((issue) => process.stdout.write(`- ${issue.severity}: ${issue.code}\n`));
    }
  }
  if (report.status !== 'pass') process.exitCode = 1;
}

function cmdQa(args) {
  if (!args.run) throw new Error(`--run is required\n\n${usage()}`);
  const run = readJson(args.run);
  const report = qaMiniDramaRun(run);
  const rendered = renderObject(report, args.json);
  if (rendered) process.stdout.write(rendered);
  else {
    process.stdout.write(`Mini-drama QA: ${report.status}\n`);
    process.stdout.write(`candidates: ${report.candidate_count}; issues: ${report.issue_count}\n`);
  }
  if (report.status !== 'pass') process.exitCode = 1;
}

function cmdReport(args) {
  if (!args.run) throw new Error(`--run is required\n\n${usage()}`);
  const run = readJson(args.run);
  const report =
    run.schema_version === 'mini-drama-battery-screen-v0.1'
      ? summarizeMiniDramaBatteryScreen(run)
      : summarizeMiniDramaRun(run);
  if (args.out) writeJson(args.out, report);
  if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else {
    if (args.out) process.stdout.write(`A19R report: ${repoRel(args.out)}\n`);
    process.stdout.write(`run: ${report.run_id}\n`);
    process.stdout.write(
      `cards: ${report.card_count}; candidates: ${report.candidate_count}; gates: ${report.gate_status}\n`,
    );
  }
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const commands = {
    generate: cmdGenerate,
    screen: cmdScreen,
    packetize: cmdPacketize,
    'codebook-validate': cmdCodebookValidate,
    qa: cmdQa,
    report: cmdReport,
  };
  const command = commands[args.command];
  if (!command) throw new Error(`unknown command: ${args.command}\n\n${usage()}`);
  command(args);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
