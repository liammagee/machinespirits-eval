#!/usr/bin/env node
/**
 * Automated A19R mini-drama packet adjudication.
 *
 * The raw judgment step reads only packet.coder_packet. The private S0/S1 arm
 * mapping is applied only after that raw judgment is preserved.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_MINI_DRAMA_CODEBOOK,
  DEFAULT_MINI_DRAMA_ONTOLOGY,
  adjudicateMiniDramaCoderPacket,
  applyMiniDramaPrivateKey,
  loadMiniDramaCodebook,
  loadMiniDramaOntology,
  repoRel,
  summarizeMiniDramaAutomatedAdjudications,
} from '../services/miniDramaMachines.js';

function usage() {
  return `Usage:
  node scripts/adjudicate-a19r-mini-drama.js \\
    --packet-dir exports/a19r/adjudication-packets/automated-branch-2026-06-09 \\
    [--out-dir exports/a19r/automated-adjudication/automated-branch-2026-06-09] \\
    [--summary-out exports/a19r/reports/automated-adjudication-2026-06-09.json] [--json]

Options:
  --packet FILE       Add one packet file. Repeatable.
  --packet-dir DIR    Read all *.packet.json files from a directory.
  --codebook FILE     Default: config/rhetoric/mini-drama-codebook.v0.1.json
  --ontology FILE     Default: config/rhetoric/mini-drama-ontology.v0.1.json
  --critic-id ID      Default: deterministic-mini-drama-v0.1
  --out-dir DIR       Write per-packet adjudication JSON files.
  --summary-out FILE  Write aggregate summary JSON.
  --json              Print aggregate summary JSON.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    packets: [],
    packetDir: null,
    codebook: DEFAULT_MINI_DRAMA_CODEBOOK,
    ontology: DEFAULT_MINI_DRAMA_ONTOLOGY,
    criticId: 'deterministic-mini-drama-v0.1',
    outDir: null,
    summaryOut: null,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--packet') args.packets.push(path.resolve(argv[++i]));
    else if (token === '--packet-dir') args.packetDir = path.resolve(argv[++i]);
    else if (token === '--codebook') args.codebook = path.resolve(argv[++i]);
    else if (token === '--ontology') args.ontology = path.resolve(argv[++i]);
    else if (token === '--critic-id') args.criticId = argv[++i];
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--summary-out') args.summaryOut = path.resolve(argv[++i]);
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
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

function packetFiles(args) {
  const files = [...args.packets];
  if (args.packetDir) {
    const dirFiles = fs
      .readdirSync(args.packetDir)
      .filter((entry) => entry.endsWith('.packet.json'))
      .map((entry) => path.join(args.packetDir, entry));
    files.push(...dirFiles);
  }
  const unique = [...new Set(files.map((filePath) => path.resolve(filePath)))].sort();
  if (!unique.length) throw new Error(`no packet files supplied\n\n${usage()}`);
  return unique;
}

export function adjudicateA19RMiniDramaPackets({
  packetPaths,
  codebook = loadMiniDramaCodebook(),
  ontology = loadMiniDramaOntology(),
  criticId = 'deterministic-mini-drama-v0.1',
  outDir = null,
  adjudicatedAt = new Date().toISOString(),
} = {}) {
  const results = [];
  const written = [];
  for (const packetPath of packetPaths) {
    const packet = readJson(packetPath);
    const rawJudgment = adjudicateMiniDramaCoderPacket({
      coderPacket: packet.coder_packet,
      codebook,
      ontology,
      criticId,
      adjudicatedAt,
    });
    const unblinded = applyMiniDramaPrivateKey({ packet, rawJudgment });
    const result = {
      schema_version: 'mini-drama-automated-adjudication-result-v0.1',
      packet_path: repoRel(packetPath),
      packet_id: packet.packet_id,
      raw_blinded_judgment: rawJudgment,
      private_mapping_applied_after_raw_judgment: unblinded,
    };
    results.push(unblinded);
    if (outDir) {
      const outPath = path.join(outDir, `${packet.packet_id}.automated-adjudication.json`);
      writeJson(outPath, result);
      written.push(repoRel(outPath));
    }
  }
  const summary = {
    ...summarizeMiniDramaAutomatedAdjudications(results),
    critic_id: criticId,
    packet_paths: packetPaths.map(repoRel),
    result_paths: written,
  };
  return { summary, results, written };
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const codebook = loadMiniDramaCodebook(args.codebook);
  const ontology = loadMiniDramaOntology(args.ontology);
  const packetPaths = packetFiles(args);
  const { summary } = adjudicateA19RMiniDramaPackets({
    packetPaths,
    codebook,
    ontology,
    criticId: args.criticId,
    outDir: args.outDir,
  });
  if (args.summaryOut) writeJson(args.summaryOut, summary);
  if (args.json) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  else {
    process.stdout.write(`A19R automated adjudication: ${summary.result_label}\n`);
    process.stdout.write(
      `S1 supported: ${summary.s1_supported_count}/${summary.packet_count}; S0 preferred: ${summary.s0_preferred_count}; unclear: ${summary.unclear_count}\n`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
