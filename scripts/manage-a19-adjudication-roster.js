#!/usr/bin/env node
/**
 * Manage the A19 adjudication coder roster.
 *
 * The roster maps per-coder access keys to assigned packet slugs and switches
 * the dashboard (routes/a19AdjudicationRoutes.js) from the open localhost
 * research flow into keyed mode: coder identity comes from the key, each
 * coder sees only their assigned packets, and the legacy open endpoints are
 * refused.
 *
 * The roster file is PRIVATE — it holds the access keys. It lives under
 * exports/ (git-ignored) on purpose; never commit it or serve it. Send each
 * coder ONLY their own link: /adjudication/?key=<access_key>
 *
 * Usage:
 *   node scripts/manage-a19-adjudication-roster.js add --coder-id coder-001 \
 *     [--role expert_or_semi_expert] [--assignments slug-a,slug-b]
 *   node scripts/manage-a19-adjudication-roster.js assign --coder-id coder-001 --assignments slug-c
 *   node scripts/manage-a19-adjudication-roster.js unassign --coder-id coder-001 --assignments slug-c
 *   node scripts/manage-a19-adjudication-roster.js rotate-key --coder-id coder-001
 *   node scripts/manage-a19-adjudication-roster.js remove --coder-id coder-001
 *   node scripts/manage-a19-adjudication-roster.js list [--show-keys] [--json]
 *
 * Common flags: [--roster exports/a19/adjudication-roster.json]
 * `list` redacts access keys unless --show-keys is passed.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ROSTER_SCHEMA_VERSION,
  loadRoster,
  resolveWorkspace,
  safeCoderId,
  safeSlug,
} from '../services/a19AdjudicationPanel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return `Usage:
  node scripts/manage-a19-adjudication-roster.js <add|assign|unassign|rotate-key|remove|list> \\
    [--coder-id coder-001] [--role expert_or_semi_expert] [--assignments slug-a,slug-b] \\
    [--roster exports/a19/adjudication-roster.json] [--show-keys] [--json]

The roster file is private (it holds coder access keys); it stays under the
git-ignored exports/ tree. Coder link format: /adjudication/?key=<access_key>`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    command: null,
    coderId: null,
    role: 'expert_or_semi_expert',
    assignments: [],
    roster: null,
    showKeys: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!args.command && !token.startsWith('--')) args.command = token;
    else if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--coder-id') args.coderId = argv[++i];
    else if (token === '--role') args.role = argv[++i];
    else if (token === '--assignments') {
      args.assignments.push(
        ...String(argv[++i] || '')
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      );
    } else if (token === '--roster') args.roster = path.resolve(argv[++i]);
    else if (token === '--show-keys') args.showKeys = true;
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  return args;
}

function rosterPathFromArgs(args) {
  if (args.roster) return args.roster;
  return resolveWorkspace(process.env).rosterPath;
}

function newAccessKey() {
  return crypto.randomBytes(24).toString('base64url');
}

function emptyRoster() {
  const now = new Date().toISOString();
  return { schema_version: ROSTER_SCHEMA_VERSION, created_at: now, updated_at: now, coders: [] };
}

function readRoster(rosterPath) {
  if (!fs.existsSync(rosterPath)) return emptyRoster();
  // Reuse the server's loader so the CLI refuses exactly the rosters the
  // server would refuse.
  const roster = loadRoster({ rosterPath });
  return roster || emptyRoster();
}

function writeRoster(rosterPath, roster) {
  roster.updated_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(rosterPath), { recursive: true });
  const tmpPath = path.join(path.dirname(rosterPath), `.${path.basename(rosterPath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmpPath, `${JSON.stringify(roster, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, rosterPath);
}

function findCoder(roster, coderId) {
  return roster.coders.find((coder) => coder.coder_id === coderId) || null;
}

function requireCoderId(args) {
  if (!args.coderId) throw new Error(`--coder-id is required\n\n${usage()}`);
  return safeCoderId(args.coderId);
}

function redactKey(key) {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function printCoder(coder, { showKeys }) {
  const key = showKeys ? coder.access_key : redactKey(coder.access_key);
  process.stdout.write(
    `${coder.coder_id}  role=${coder.coder_role}  key=${key}  assignments=[${coder.assignments.join(', ')}]\n`,
  );
  if (showKeys) {
    process.stdout.write(`  link: /adjudication/?key=${coder.access_key}\n`);
  }
}

function main() {
  const args = parseArgs();
  if (args.help || !args.command) {
    process.stdout.write(`${usage()}\n`);
    if (!args.help && !args.command) process.exitCode = 1;
    return;
  }
  const rosterPath = rosterPathFromArgs(args);
  const roster = readRoster(rosterPath);
  const rel = path.relative(ROOT, rosterPath);

  switch (args.command) {
    case 'add': {
      const coderId = requireCoderId(args);
      if (findCoder(roster, coderId)) throw new Error(`coder already exists: ${coderId}`);
      const coder = {
        coder_id: coderId,
        coder_role: args.role,
        access_key: newAccessKey(),
        assignments: [...new Set(args.assignments.map((slug) => safeSlug(slug)))],
        created_at: new Date().toISOString(),
        key_rotated_at: null,
      };
      roster.coders.push(coder);
      writeRoster(rosterPath, roster);
      process.stdout.write(`Added ${coderId} to ${rel}\n`);
      printCoder(coder, { showKeys: true });
      process.stdout.write('The roster file is private — share only the per-coder link above.\n');
      break;
    }
    case 'assign':
    case 'unassign': {
      const coderId = requireCoderId(args);
      const coder = findCoder(roster, coderId);
      if (!coder) throw new Error(`coder not found: ${coderId}`);
      if (!args.assignments.length) throw new Error('--assignments is required');
      const slugs = args.assignments.map((slug) => safeSlug(slug));
      if (args.command === 'assign') {
        coder.assignments = [...new Set([...coder.assignments, ...slugs])];
      } else {
        coder.assignments = coder.assignments.filter((slug) => !slugs.includes(slug));
      }
      writeRoster(rosterPath, roster);
      printCoder(coder, { showKeys: false });
      break;
    }
    case 'rotate-key': {
      const coderId = requireCoderId(args);
      const coder = findCoder(roster, coderId);
      if (!coder) throw new Error(`coder not found: ${coderId}`);
      coder.access_key = newAccessKey();
      coder.key_rotated_at = new Date().toISOString();
      writeRoster(rosterPath, roster);
      process.stdout.write(`Rotated key for ${coderId} — the old link no longer works.\n`);
      printCoder(coder, { showKeys: true });
      break;
    }
    case 'remove': {
      const coderId = requireCoderId(args);
      if (!findCoder(roster, coderId)) throw new Error(`coder not found: ${coderId}`);
      roster.coders = roster.coders.filter((coder) => coder.coder_id !== coderId);
      writeRoster(rosterPath, roster);
      process.stdout.write(`Removed ${coderId} from ${rel}\n`);
      break;
    }
    case 'list': {
      if (args.json) {
        const safe = {
          ...roster,
          coders: roster.coders.map((coder) => ({
            ...coder,
            access_key: args.showKeys ? coder.access_key : redactKey(coder.access_key),
          })),
        };
        process.stdout.write(`${JSON.stringify(safe, null, 2)}\n`);
        break;
      }
      process.stdout.write(`Roster: ${rel} (${roster.coders.length} coder${roster.coders.length === 1 ? '' : 's'})\n`);
      if (!fs.existsSync(rosterPath)) {
        process.stdout.write(
          'No roster file yet — the dashboard is in OPEN mode. `add` a coder to switch to keyed mode.\n',
        );
      }
      for (const coder of roster.coders) printCoder(coder, { showKeys: args.showKeys });
      break;
    }
    default:
      throw new Error(`unknown command: ${args.command}\n\n${usage()}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
