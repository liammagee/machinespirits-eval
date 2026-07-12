#!/usr/bin/env node
/**
 * Green Room CLI — first-wave profile ops + coaching (GREEN-ROOM-PLAN.md §5.6).
 * Standalone (no eval-cli / cell registry involvement until the fold-in stage).
 *
 * Usage:
 *   node scripts/greenroom.js create <id> --actor-model <ref> [--anchor world-005-marrick]
 *   node scripts/greenroom.js list
 *   node scripts/greenroom.js show <id> [--biography]
 *   node scripts/greenroom.js fork <id>@<version> <new-id>
 *   node scripts/greenroom.js freeze <id> | unfreeze <id>
 *   node scripts/greenroom.js coach <id> --transcript <file> [--scores <file>]
 *     [--coach claude-code.claude-opus-4-8] [--label <s>]
 *
 * `coach` runs one notes session against the profile's current prompt book,
 * records the session under the profile, and applies the memory patch. On
 * budget overflow (E_BUDGET) it runs a distillation pass: the coach rewrites
 * the whole book under budget, and the ledger records the eviction.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  createProfile,
  loadProfile,
  listProfiles,
  forkProfile,
  freezeProfile,
  unfreezeProfile,
  applyMemoryPatch,
  replaceMemory,
  recordSession,
  readLedger,
  MEMORY_TOKEN_BUDGET,
} from '../services/greenroom/store.js';
import { runNotesSession, parseModelRef } from '../services/greenroom/notesSession.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';

const DEFAULT_COACH = 'claude-code.claude-opus-4-8'; // plan §0.1.4 (re-pinned 2026-07-12)

function getOption(args, name, fallback = null) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx === args.length - 1) return fallback;
  return args[idx + 1];
}

function hasFlag(args, name) {
  return args.includes(name);
}

function extractTranscriptText(filePath) {
  // Stub transcripts are markdown/plain text; structured JSON extraction
  // stays in the Gate-0 runner, which owns that ingestion path.
  return fs.readFileSync(filePath, 'utf8');
}

async function distill(profileId, coachRef, overflowedPatchText) {
  const profile = loadProfile(profileId);
  const prompt = [
    `This prompt book exceeded its ${MEMORY_TOKEN_BUDGET}-token budget when the`,
    `following entry was added:`,
    '',
    overflowedPatchText,
    '',
    'Rewrite the ENTIRE book below so it fits comfortably under the budget',
    '(aim for 20% headroom), preserving the section structure and the most',
    'load-bearing entries, merging near-duplicates, and dropping what has been',
    'superseded. Return ONLY the rewritten book as markdown, no commentary.',
    '',
    '---',
    profile.memoryText,
    '---',
  ].join('\n');
  const result = await callAIWithCliBridge(
    { provider: coachRef.provider, model: coachRef.model },
    "You curate an AI tutor's prompt book: a token-budgeted, durable role memory. You distill without losing craft.",
    prompt,
    'greenroom:distill',
  );
  return replaceMemory(profileId, result.text.trim(), { type: 'distill', source: { reason: 'budget' } });
}

async function coachCommand(args) {
  const profileId = args[0];
  const transcriptPath = getOption(args, '--transcript');
  if (!profileId || !transcriptPath) {
    console.error('usage: greenroom.js coach <id> --transcript <file> [--scores <file>] [--coach <ref>] [--label <s>]');
    process.exit(1);
  }
  const profile = loadProfile(profileId);
  const coach = getOption(args, '--coach', DEFAULT_COACH);
  // profile.yaml stores the actor as a full <provider>.<model> ref.
  const actor = profile.meta.actor_model;
  const scoresPath = getOption(args, '--scores');
  const informedContext = scoresPath ? fs.readFileSync(scoresPath, 'utf8') : null;
  const label = getOption(args, '--label', path.basename(transcriptPath).replace(/\.[^.]+$/, ''));

  const transcriptText = extractTranscriptText(transcriptPath);
  console.log(
    `coach session: profile=${profileId} book v${profile.memoryVersion} (${profile.tokens} tok) coach=${coach} actor=${actor}`,
  );
  const session = await runNotesSession({
    transcriptText,
    memoryText: profile.memoryText,
    coach,
    actor,
    informedContext,
    label,
  });

  const record = {
    profile: profileId,
    transcript: transcriptPath,
    label,
    coach,
    actor,
    informed: Boolean(informedContext),
    memory_version_before: profile.memoryVersion,
    memory_hash_before: profile.memoryHash,
    ...session,
  };
  const sessionFile = recordSession(profileId, record, { source: { transcript: path.basename(transcriptPath) } });
  console.log(`  session recorded: ${sessionFile}`);
  if (session.error) {
    console.error(`  WARN: ${session.error} — no patch applied`);
    process.exit(2);
  }

  const patch = session.structured.memory_patch;
  if (!patch) {
    console.log('  coach proposed no patch (notes only)');
    return;
  }
  try {
    const applied = applyMemoryPatch(profileId, patch, {
      source: { session_file: path.basename(sessionFile), transcript: path.basename(transcriptPath) },
    });
    console.log(`  patch applied: ${patch.op} → "${patch.section}" — book v${applied.version} (${applied.tokens} tok)`);
  } catch (error) {
    if (error.code === 'E_BUDGET') {
      console.log('  budget overflow → distillation pass');
      const applied = await distill(profileId, parseModelRef(coach, 'coach'), patch.text || '');
      console.log(`  distilled: book v${applied.version} (${applied.tokens} tok)`);
      const reapplied = applyMemoryPatch(profileId, patch, {
        source: { session_file: path.basename(sessionFile), post_distill: true },
      });
      console.log(`  patch applied post-distill: book v${reapplied.version} (${reapplied.tokens} tok)`);
    } else {
      throw error;
    }
  }
}

function showCommand(args) {
  const id = args[0];
  const profile = loadProfile(id);
  console.log(`profile: ${id}`);
  console.log(`  actor: ${profile.meta.actor_model}  anchor: ${profile.meta.anchor}  frozen: ${profile.meta.frozen}`);
  console.log(`  book: v${profile.memoryVersion}  ${profile.tokens} tokens  ${profile.memoryHash.slice(0, 12)}…`);
  if (profile.meta.parent) console.log(`  forked from: ${profile.meta.parent.id}@v${profile.meta.parent.version}`);
  if (hasFlag(args, '--biography')) {
    const ledger = readLedger(id);
    const counts = {};
    for (const e of ledger) counts[e.type] = (counts[e.type] || 0) + 1;
    console.log(`  biography: ${ledger.length} events — ${JSON.stringify(counts)}`);
    for (const e of ledger.slice(-10)) {
      console.log(`    ${e.ts}  ${e.type}  v${e.version}${e.session_file ? '  ' + e.session_file : ''}`);
    }
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'create': {
      const id = args[0];
      const actorModel = getOption(args, '--actor-model', 'claude-code.claude-sonnet-5');
      const anchor = getOption(args, '--anchor', 'world-005-marrick');
      const profile = createProfile({ id, actorModel, anchor });
      console.log(`created ${id} (book v0, ${profile.tokens} tok) under ${profile.dir}`);
      break;
    }
    case 'list':
      for (const id of listProfiles()) console.log(id);
      break;
    case 'show':
      showCommand(args);
      break;
    case 'fork': {
      const [ref, newId] = args;
      const [srcId, version] = String(ref).split('@');
      const profile = forkProfile(srcId, Number.parseInt(version.replace(/^v/, ''), 10), newId);
      console.log(`forked ${srcId}@${version} → ${newId} (book v0, ${profile.tokens} tok)`);
      break;
    }
    case 'freeze':
      freezeProfile(args[0]);
      console.log(`${args[0]} frozen`);
      break;
    case 'unfreeze':
      unfreezeProfile(args[0]);
      console.log(`${args[0]} unfrozen`);
      break;
    case 'coach':
      await coachCommand(args);
      break;
    default:
      console.error('usage: greenroom.js <create|list|show|fork|freeze|unfreeze|coach> — see file header');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
