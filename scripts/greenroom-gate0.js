#!/usr/bin/env node
/**
 * Green Room Gate 0 — coach quality screen (GREEN-ROOM-PLAN.md §7, §0.1).
 *
 * Runs N notes sessions: a judge-tier coach model reads an existing tutor
 * transcript, converses with the actor model about the performance, and ends
 * with <=3 "bankable notes" (checkable behavioural predicates quoting
 * transcript evidence) plus a proposed memory patch. Outputs land as files
 * only — no DB writes, no store, no cell registry. The owner then scores the
 * sessions against the ratified checklist (written alongside the sessions).
 *
 * Pass rule (ratified 2026-07-11): >=4/5 sessions produce at least one note
 * that (a) quotes transcript evidence, (b) is a checkable behavioural
 * predicate, (c) is non-generic. Owner-judged.
 *
 * Usage:
 *   node scripts/greenroom-gate0.js --transcripts <file-or-dir> [more...]
 *     [--sessions 5] [--coach codex.sol] [--actor codex.luna]
 *     [--out exports/greenroom-gate0-<stamp>] [--seed 1]
 *     [--max-transcript-chars 16000] [--dry-run]
 *
 * Typical local invocation against the preconscious stub's records:
 *   node scripts/greenroom-gate0.js \
 *     --transcripts ../machinespirits-eval-preconscious/.tutor-stub-auto-eval
 *
 * --dry-run writes the assembled prompts without calling any model (free
 * plumbing check; also doubles as the bridge-name smoke when run without it).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import process from 'node:process';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';

const TRANSCRIPT_EXTENSIONS = new Set(['.json', '.jsonl', '.md', '.txt']);
const SPEAKER_KEYS = ['speaker', 'role', 'agent', 'who', 'author'];
const TEXT_KEYS = ['text', 'content', 'message', 'utterance', 'public_text', 'speech', 'externalMessage'];
const CONTAINER_KEYS = ['turns', 'transcript', 'conversationHistory', 'entries', 'frames', 'messages', 'dialogue'];

export function parseModelRef(ref, flag) {
  const dot = String(ref || '').indexOf('.');
  if (dot <= 0 || dot === ref.length - 1) {
    throw new Error(`${flag}: expected dot notation <provider>.<model> (e.g. codex.sol), got "${ref}"`);
  }
  return { provider: ref.slice(0, dot), model: ref.slice(dot + 1) };
}

export function parseArgs(argv) {
  const args = {
    transcripts: [],
    sessions: 5,
    coach: 'codex.sol',
    actor: 'codex.luna',
    out: null,
    seed: 1,
    maxTranscriptChars: 16000,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--transcripts') {
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) args.transcripts.push(argv[++i]);
    } else if (token === '--sessions') args.sessions = Number.parseInt(argv[++i], 10);
    else if (token === '--coach') args.coach = argv[++i];
    else if (token === '--actor') args.actor = argv[++i];
    else if (token === '--out') args.out = argv[++i];
    else if (token === '--seed') args.seed = Number.parseInt(argv[++i], 10);
    else if (token === '--max-transcript-chars') args.maxTranscriptChars = Number.parseInt(argv[++i], 10);
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--help' || token === '-h') {
      console.log('See header of scripts/greenroom-gate0.js for usage.');
      process.exit(0);
    } else if (!token.startsWith('--')) args.transcripts.push(token);
    else throw new Error(`Unknown option: ${token}`);
  }
  if (!Number.isInteger(args.sessions) || args.sessions < 1) throw new Error('--sessions must be a positive integer');
  if (!Number.isInteger(args.seed)) throw new Error('--seed must be an integer');
  if (!Number.isInteger(args.maxTranscriptChars) || args.maxTranscriptChars < 1000) {
    throw new Error('--max-transcript-chars must be an integer >= 1000');
  }
  return args;
}

export function collectTranscriptFiles(paths) {
  const files = [];
  const walk = (p) => {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(p).sort()) {
        if (entry.startsWith('.')) continue;
        walk(path.join(p, entry));
      }
      return;
    }
    if (TRANSCRIPT_EXTENSIONS.has(path.extname(p).toLowerCase())) files.push(p);
  };
  for (const p of paths) walk(path.resolve(p));
  return [...new Set(files)].sort();
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectSessions(files, count, seed) {
  const rand = mulberry32(seed);
  const pool = [...files];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

function formatEntry(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry !== 'object') return String(entry);
  const speakerKey = SPEAKER_KEYS.find((k) => typeof entry[k] === 'string');
  const textKey = TEXT_KEYS.find((k) => typeof entry[k] === 'string' && entry[k].trim().length > 0);
  if (textKey) {
    const speaker = speakerKey ? entry[speakerKey] : 'entry';
    return `${speaker}: ${entry[textKey]}`;
  }
  const flat = JSON.stringify(entry);
  return flat.length > 400 ? `${flat.slice(0, 400)}…` : flat;
}

export function extractTranscriptText(filePath, rawOverride = null) {
  const raw = rawOverride ?? fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md' || ext === '.txt') return raw;
  if (ext === '.jsonl') {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed = lines.map((l) => {
      try {
        return formatEntry(JSON.parse(l));
      } catch {
        return l;
      }
    });
    return parsed.join('\n');
  }
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data.map(formatEntry).join('\n');
    if (data && typeof data === 'object') {
      for (const key of CONTAINER_KEYS) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          return data[key].map(formatEntry).join('\n');
        }
      }
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  } catch {
    return raw;
  }
}

export function truncateTranscript(text, maxChars) {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.66);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n\n[… ${text.length - maxChars} chars elided …]\n\n${text.slice(-tail)}`;
}

const COACH_SYSTEM = `You are an acting coach for an AI tutor — the offstage, judge-tier reviewer in a
"green room" training loop. You have just watched a performance: a tutoring
dialogue in which the tutor (the "actor" playing the tutor role) guided a
learner. Your craft standards:

- Observations must QUOTE the transcript. Never assert a pattern without the
  line that shows it.
- Notes are BEHAVIOURAL PREDICATES the actor can comply with or violate in a
  future performance ("do not stack a second question before the learner has
  answered the first"), never virtues ("be more engaging").
- Specific beats general. A note that would apply verbatim to any transcript
  is a failed note.
- Respect the actor as a fellow professional: elicit their account before
  prescribing. The point of the conversation is to find the note they can
  actually use.`;

const ACTOR_SYSTEM = `You are the actor who played the TUTOR in the transcript under discussion. You
are now offstage, in a notes session with your coach. Speak as the actor
about the role — third person for the character ("the tutor kept…", "I had
the tutor try…"), first person for your craft choices. Be candid about what
you were attempting and where the scene resisted; do not defend for the sake
of defending, and do not perform contrition. Keep replies under 250 words.`;

function coachOpenPrompt(transcriptText) {
  return `Here is the performance transcript:

---
${transcriptText}
---

Give your opening of the notes session: two or three observations, each
quoting the transcript, followed by exactly ONE question to the actor about
their choices.`;
}

const COACH_FINAL_PROMPT = `Close the session. Issue your bankable notes — at most THREE — and a proposed
patch to the actor's prompt book (their durable role memory).

End your reply with a fenced json block exactly in this shape:

\`\`\`json
{
  "notes": [
    {
      "note": "<behavioural predicate for future performances>",
      "evidence_quote": "<verbatim quote from this transcript>",
      "check": "<how a third party verifies compliance in a future transcript>"
    }
  ],
  "memory_patch": {
    "section": "<prompt-book section, e.g. Recurring patterns>",
    "op": "add",
    "text": "<the entry as it should appear in the book>"
  },
  "confidence": 0.0
}
\`\`\``;

export function parseStructuredTail(text) {
  const fences = [...String(text).matchAll(/```json\s*([\s\S]*?)```/g)];
  for (let i = fences.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(fences[i][1]);
    } catch {
      /* try earlier fence */
    }
  }
  const braceIdx = text.lastIndexOf('{"notes"');
  if (braceIdx >= 0) {
    for (let end = text.length; end > braceIdx; end--) {
      try {
        return JSON.parse(text.slice(braceIdx, end));
      } catch {
        /* shrink */
      }
    }
  }
  return null;
}

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function callModel(ref, systemPrompt, userPrompt, role, messageHistory) {
  return await callAIWithCliBridge({ provider: ref.provider, model: ref.model }, systemPrompt, userPrompt, role, {
    messageHistory: messageHistory && messageHistory.length > 0 ? messageHistory : undefined,
  });
}

async function runSession({ index, file, transcriptText, coachRef, actorRef, dryRun, outDir }) {
  const exchanges = [];
  const record = {
    session: index,
    transcript: file,
    coach: `${coachRef.provider}.${coachRef.model}`,
    actor: `${actorRef.provider}.${actorRef.model}`,
    exchanges,
    structured: null,
    error: null,
  };
  const openPrompt = coachOpenPrompt(transcriptText);

  if (dryRun) {
    const dryPath = path.join(outDir, `session-${index}.dryrun.md`);
    fs.writeFileSync(
      dryPath,
      [
        `# Gate 0 session ${index} — DRY RUN (no model calls)`,
        `Transcript: ${file}`,
        '',
        '## COACH SYSTEM',
        COACH_SYSTEM,
        '',
        '## ACTOR SYSTEM',
        ACTOR_SYSTEM,
        '',
        '## Coach opening prompt',
        openPrompt,
        '',
        '## Coach closing prompt',
        COACH_FINAL_PROMPT,
      ].join('\n'),
    );
    record.dryRun = true;
    return record;
  }

  try {
    const coachOpen = await callModel(coachRef, COACH_SYSTEM, openPrompt, `gate0:s${index}:coach-open`);
    exchanges.push({ speaker: 'coach', text: coachOpen.text });

    const actorContext = `The transcript under discussion:\n\n---\n${transcriptText}\n---\n\nYour coach opens the notes session:\n\n${coachOpen.text}\n\nRespond.`;
    const actorReply = await callModel(actorRef, ACTOR_SYSTEM, actorContext, `gate0:s${index}:actor-reply`);
    exchanges.push({ speaker: 'actor', text: actorReply.text });

    const coachHistory = [
      { role: 'assistant', content: coachOpen.text },
      { role: 'user', content: `The actor replies:\n\n${actorReply.text}` },
    ];
    const coachProbe = await callModel(
      coachRef,
      COACH_SYSTEM,
      'Follow up with ONE probing question or observation that moves toward a usable note. Stay with the evidence.',
      `gate0:s${index}:coach-probe`,
      coachHistory,
    );
    exchanges.push({ speaker: 'coach', text: coachProbe.text });

    const actorReply2 = await callModel(
      actorRef,
      ACTOR_SYSTEM,
      `The notes session so far:\n\nCOACH: ${coachOpen.text}\n\nYOU: ${actorReply.text}\n\nCOACH: ${coachProbe.text}\n\nReply briefly (under 120 words).`,
      `gate0:s${index}:actor-reply-2`,
    );
    exchanges.push({ speaker: 'actor', text: actorReply2.text });

    const coachFinal = await callModel(coachRef, COACH_SYSTEM, COACH_FINAL_PROMPT, `gate0:s${index}:coach-final`, [
      ...coachHistory,
      { role: 'assistant', content: coachProbe.text },
      { role: 'user', content: `The actor replies:\n\n${actorReply2.text}` },
    ]);
    exchanges.push({ speaker: 'coach', text: coachFinal.text });
    record.structured = parseStructuredTail(coachFinal.text);
    if (!record.structured) record.error = 'structured tail did not parse';
  } catch (error) {
    record.error = String(error?.message || error);
  }
  return record;
}

function writeSessionFiles(outDir, record) {
  fs.writeFileSync(path.join(outDir, `session-${record.session}.json`), JSON.stringify(record, null, 2));
  const md = [
    `# Gate 0 — notes session ${record.session}`,
    `Transcript: \`${record.transcript}\``,
    `Coach: ${record.coach} · Actor: ${record.actor}`,
    '',
    ...record.exchanges.flatMap((e) => [`## ${e.speaker.toUpperCase()}`, '', e.text, '']),
    record.error ? `\n**ERROR:** ${record.error}` : '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, `session-${record.session}.md`), md);
}

function writeChecklist(outDir, records) {
  const rows = records
    .map((r) => `| ${r.session} | \`${path.basename(r.transcript)}\` | ${r.error ? '⚠ ' + r.error : ''} |  |  |  |  |`)
    .join('\n');
  fs.writeFileSync(
    path.join(outDir, 'gate0-review-checklist.md'),
    `# Gate 0 review checklist (owner-scored)

Ratified pass rule (GREEN-ROOM-PLAN.md §0.1 / §7): **>=4/5 sessions produce at
least one bankable note satisfying all three criteria below.** A session with
zero qualifying notes fails regardless of how good the conversation reads.

Criteria per note:
- **(a) quotes evidence** — the note carries a verbatim transcript quote that actually shows the pattern.
- **(b) checkable predicate** — a third party could verify compliance/violation in a future transcript.
- **(c) non-generic** — the note would NOT apply verbatim to a random other transcript.

| session | transcript | run notes | (a) evidence | (b) checkable | (c) non-generic | >=1 qualifying note? |
|---|---|---|---|---|---|---|
${rows}

**Verdict (>=4 yes → Gate 0 PASS):** ____
`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.transcripts.length === 0) {
    console.error('No --transcripts given. Point at stub transcript files or directories.');
    process.exit(1);
  }
  const coachRef = parseModelRef(args.coach, '--coach');
  const actorRef = parseModelRef(args.actor, '--actor');
  const files = collectTranscriptFiles(args.transcripts);
  if (files.length === 0) {
    console.error(`No transcript files (.json/.jsonl/.md/.txt) found under: ${args.transcripts.join(', ')}`);
    process.exit(1);
  }
  const chosen = selectSessions(files, args.sessions, args.seed);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(args.out || path.join('exports', `greenroom-gate0-${stamp}`));
  fs.mkdirSync(outDir, { recursive: true });

  // Frozen manifest before any model call (Phase-6 gate convention).
  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        gate: 'greenroom-gate0',
        gitSha: gitSha(),
        args: { ...args, transcripts: args.transcripts },
        coach: args.coach,
        actor: args.actor,
        seed: args.seed,
        selected: chosen.map((f) => ({
          file: f,
          sha256: crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),
        })),
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(
    `Gate 0: ${chosen.length} session(s), coach=${args.coach}, actor=${args.actor}${args.dryRun ? ' [DRY RUN]' : ''}`,
  );
  const records = [];
  for (let i = 0; i < chosen.length; i++) {
    const file = chosen[i];
    console.log(`  session ${i + 1}/${chosen.length}: ${file}`);
    const transcriptText = truncateTranscript(extractTranscriptText(file), args.maxTranscriptChars);
    const record = await runSession({
      index: i + 1,
      file,
      transcriptText,
      coachRef,
      actorRef,
      dryRun: args.dryRun,
      outDir,
    });
    records.push(record);
    if (!args.dryRun) writeSessionFiles(outDir, record);
  }
  if (!args.dryRun) writeChecklist(outDir, records);
  const failed = records.filter((r) => r.error).length;
  console.log(`Done → ${outDir}${failed ? ` (${failed} session(s) errored)` : ''}`);
  if (!args.dryRun && failed === records.length) process.exit(1);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
