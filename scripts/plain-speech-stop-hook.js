#!/usr/bin/env node
// Claude Code Stop hook: checks the reply the agent is about to send against
// the repo style rule (.claude/style-rule.md). If it finds a banned shape it
// blocks the stop ONCE and hands the list back, so the agent rewrites before
// the user sees the reply. It never blocks twice in one turn (Claude Code sets
// stop_hook_active on the retry) and it fails open on any internal error, so a
// broken hook can never trap a session.
//
// Manual use:
//   node scripts/plain-speech-stop-hook.js --check-file reply.md
//   node scripts/plain-speech-stop-hook.js --check-transcript session.jsonl
// Both print findings as plain text and exit 1 when there are any.
//
// Allowlist: one term per line in .claude/plain-speech-allow.txt (optional).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const MAX_REPO_LOOKUPS = 14;
const REPO_LOOKUP_BUDGET_MS = 4000;
const LONG_SENTENCE_WORDS = 35;
const LONG_REPLY_WORDS = 450;
const SHORT_PROMPT_WORDS = 50;
const HEADER_FREE_UNDER_WORDS = 500;

// Words the style rule maps to a plain form (rule 1).
const LATINATE = {
  utilise: 'use',
  utilize: 'use',
  demonstrate: 'show',
  demonstrates: 'shows',
  sufficient: 'enough',
  additional: 'more',
  subsequently: 'then',
  'prior to': 'before',
  facilitate: 'help',
  obtain: 'get',
  attempt: 'try',
  terminate: 'end',
  initiate: 'start',
  approximately: 'about',
  regarding: 'about',
  numerous: 'many',
  modify: 'change',
  verify: 'check',
  determine: 'find out',
  perform: 'do',
  occur: 'happen',
  occurs: 'happens',
  occurred: 'happened',
  however: 'but',
  therefore: 'so',
  ensure: 'make sure',
  currently: 'now',
};

// Phrases the agent reaches for that the rule bans outright (rules 3 to 5),
// plus its own recorded tells (memory: feedback-no-aphoristic-pronouncements).
const TELLS = [
  [/\bhonest(?:ly)?\b/i, 'never write this word, in any register'],
  [/\b(?:it is )?worth noting\b/i, 'delete the frame; state the fact'],
  [/\bnot merely\b/i, 'banned construction; say the plain fact'],
  [/\bnot just \w+(?: \w+)?, (?:it|this|that|they) (?:is|are)\b/i, 'banned construction; say the plain fact'],
  [/\b(?:operates? )?at the level of\b/i, 'banned construction'],
  [/\bwhat \w+ actually (?:is|are|does|do)\b/i, 'banned construction'],
  [/\b(?:moving|going) forward\b/i, 'delete, or say "from now on"'],
  [/\bload-bearing\b/i, 'say what depends on it, or "nothing cites it"'],
  [/\bbit-?rot\b/i, 'say "the code is old and may not run now"'],
  [/\b(?:buy|bought|buying)\b(?! (?:a|the) (?:book|licen[cs]e|subscription|credit))/i, 'say "run"'],
  [/\b(?:delve|tapestry|unpack|leverage|journey|landscape)\b/i, 'jargon; say the concrete thing'],
  [/\b(?:nuanced?|robust(?:ly|ness)?)\b/i, 'say the specific property'],
  [
    /\b(?:at its core|in essence|ultimately|fundamentally|crucially|importantly|notably|arguably|essentially|in short|put simply|to be clear|in other words|the upshot|the takeaway|bottom line|boils down to|at the heart of|speaks to|think of it as|it turns out|the key insight|the real question|the deeper point|the deeper|the deep(?:er)? issue)\b/i,
    'delete the framing; keep the fact',
  ],
];

// Nouns the agent uses to mint a label for a thing ("the archive gap").
const LABEL_NOUNS =
  'gap|wall|cliff|trap|tell|lever|knob|dial|seam|surface|story|frame|ladder|rail|riddle|puzzle|problem|question|loop|line|arc|move|lens|axis';
const LABEL_SKIP_ADJ = new Set(
  'same first last next whole other only main real right wrong hard easy big small new old one two three second third bigger deeper key central core open closed full empty current present previous above below following original earlier later'.split(
    ' ',
  ),
);

const COMPOUND_ALLOW = new Set(
  'well-known so-called long-term short-term real-time built-in read-only write-only one-off day-to-day up-to-date open-source case-insensitive case-sensitive top-level lower-case upper-case non-zero'.split(
    ' ',
  ),
);

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function stripMarkup(text) {
  let out = text.replace(/```[\s\S]*?```/g, ' [code] ');
  out = out.replace(/`[^`\n]*`/g, ' [code] ');
  out = out.replace(/\]\([^)]*\)/g, ']'); // markdown link targets
  out = out.replace(/\*\*/g, '');
  return out;
}

function sentencesOf(text) {
  const result = [];
  for (const rawLine of text.split('\n')) {
    let line = rawLine.trim();
    if (!line || line.startsWith('|') || /^#{1,6}\s/.test(line)) continue;
    line = line.replace(/^(?:[-*+]|\d+[.)])\s+/, '');
    for (const piece of line.split(/(?<=[.!?])\s+(?=[A-Z"'([])/)) {
      const s = piece.trim();
      if (wordCount(s) >= 3) result.push(s);
    }
  }
  return result;
}

const EPIGRAM =
  /^(.{0,140}?)\b(is|are|was|were|comes|come|lies|lie|sits|sit|lives|live|belongs|belong|means|meant|remains|remain)\b\s+(?:(?:a|an|the|in|on|at|of|from|about)\s+)?([^,;:]{2,48}),\s*not\s+(?:(?:a|an|the|in|on|at|of|from|about)\s+)?([^,;:.!?]{2,48})[.!?]?$/i;

function simpleSide(s) {
  return wordCount(s) <= 4 && !/[\d`/%]/.test(s);
}

function repoHas(term, cwd, budget) {
  if (!cwd || budget.done >= MAX_REPO_LOOKUPS || Date.now() - budget.start > REPO_LOOKUP_BUDGET_MS) {
    return null; // unknown: do not flag
  }
  budget.done += 1;
  try {
    // notes/ and exports/ hold prose from past agent sessions, so a label that
    // lives only there is a past coinage, not a name the project uses.
    execFileSync('git', ['grep', '-qiF', '--', term, ':!notes', ':!exports'], {
      cwd,
      stdio: 'ignore',
      timeout: 1500,
    });
    return true;
  } catch (error) {
    if (error && error.status === 1) return false;
    return null;
  }
}

function loadAllow(cwd) {
  const set = new Set();
  if (!cwd) return set;
  const file = path.join(cwd, '.claude', 'plain-speech-allow.txt');
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const t = line.trim().toLowerCase();
      if (t && !t.startsWith('#')) set.add(t);
    }
  } catch {
    /* optional file */
  }
  return set;
}

export function checkReply(replyText, { promptText = '', cwd = null } = {}) {
  const findings = [];
  const seenQuotes = new Set();
  const add = (rule, quote, fix) => {
    const key = quote.toLowerCase().replace(/\s+/g, ' ').slice(0, 110);
    if (seenQuotes.has(key)) return; // one finding per offending text
    seenQuotes.add(key);
    findings.push({ rule, quote: quote.slice(0, 110), fix });
  };
  const text = stripMarkup(replyText);
  const lowerPrompt = promptText.toLowerCase();
  const allow = loadAllow(cwd);
  const budget = { start: Date.now(), done: 0 };
  const replyWords = wordCount(text);

  for (const [re, fix] of TELLS) {
    const m = text.match(re);
    if (m) add('tell', m[0], fix);
  }

  for (const [word, plain] of Object.entries(LATINATE)) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    const m = text.match(re);
    if (m && !lowerPrompt.includes(word)) add('latinate', m[0], `write "${plain}"`);
  }

  const dash = text.match(/—|→|(?<![-\w])->(?![-\w])| – /);
  if (dash) add('dash', dash[0], 'no em-dash or arrow; use a full stop or "then"');

  for (const s of sentencesOf(text)) {
    const words = wordCount(s);
    if (words > LONG_SENTENCE_WORDS) {
      add('long-sentence', s, `${words} words; split it, one idea per sentence`);
    }
    if ((s.match(/\([^)]*\)/g) || []).length >= 2) {
      add('parentheticals', s, 'two brackets on one claim; move one into its own sentence');
    }
    const e = s.replace(/^["'*]+|["'*]+$/g, '').match(EPIGRAM);
    if (e && simpleSide(e[3]) && simpleSide(e[4])) {
      add(
        'epigram',
        s,
        'motto shape "X is A, not B"; state the concrete fact with a subject, a verb and a number, file or command',
      );
    }
  }

  const seenLabels = new Set();
  const labelRe = new RegExp(`\\bthe ([a-z][a-z-]{2,}) (${LABEL_NOUNS})\\b`, 'gi');
  for (const m of text.matchAll(labelRe)) {
    const adj = m[1].toLowerCase();
    const phrase = `${adj} ${m[2].toLowerCase()}`;
    if (LABEL_SKIP_ADJ.has(adj) || seenLabels.has(phrase) || allow.has(phrase)) continue;
    seenLabels.add(phrase);
    if (lowerPrompt.includes(phrase)) continue;
    if (repoHas(phrase, cwd, budget) === false) {
      add(
        'coined-label',
        m[0],
        'this name is in neither the repo nor the user message; say the thing (file, command, number) or define it in the same sentence',
      );
    }
  }

  const seenCompounds = new Set();
  for (const m of text.matchAll(/(?<![\w/.-])([a-z]{3,}-[a-z]{3,})(?![\w-])/g)) {
    const c = m[1].toLowerCase();
    if (seenCompounds.has(c) || COMPOUND_ALLOW.has(c) || allow.has(c)) continue;
    seenCompounds.add(c);
    if (lowerPrompt.includes(c)) continue;
    if (repoHas(c, cwd, budget) === false) {
      add('coined-compound', c, 'a compound found nowhere in the repo or the user message; use plain words');
    }
  }

  if (replyWords < HEADER_FREE_UNDER_WORDS && /^#{1,6}\s/m.test(text)) {
    add(
      'header',
      (text.match(/^#{1,6}\s.*$/m) || [''])[0],
      `no headers in a reply under ${HEADER_FREE_UNDER_WORDS} words`,
    );
  }

  const promptWords = wordCount(promptText);
  if (promptText && promptWords < SHORT_PROMPT_WORDS && replyWords > LONG_REPLY_WORDS) {
    add(
      'length',
      `${replyWords} words for a ${promptWords}-word question`,
      'cut, do not polish; drop tables and bold headings first',
    );
  }

  return findings;
}

// Transcript helpers -------------------------------------------------------

function isPromptRow(row) {
  if (row.type !== 'user' || !row.message) return false;
  const c = row.message.content;
  if (typeof c === 'string') return true;
  return Array.isArray(c) && c.some((b) => b && b.type === 'text') && !c.some((b) => b && b.type === 'tool_result');
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

export function lastTurn(transcriptPath) {
  const rows = [];
  for (const line of fs.readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      /* skip bad line */
    }
  }
  let promptIndex = -1;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (isPromptRow(rows[i])) {
      promptIndex = i;
      break;
    }
  }
  if (promptIndex < 0) return { promptText: '', replyText: '' };
  const promptText = textOf(rows[promptIndex].message.content);
  const parts = [];
  for (let i = promptIndex + 1; i < rows.length; i += 1) {
    const r = rows[i];
    if (r.type === 'assistant' && r.message && r.isSidechain !== true) {
      const t = textOf(r.message.content);
      if (t.trim()) parts.push(t);
    }
  }
  return { promptText, replyText: parts.join('\n\n') };
}

export function formatReason(findings) {
  const lines = findings.map((f, i) => `${i + 1}. [${f.rule}] "${f.quote.replace(/\s+/g, ' ')}" - ${f.fix}`);
  return [
    `Plain-speech check failed on your last reply (${findings.length} item${findings.length === 1 ? '' : 's'}). Rewrite the whole reply for the user, then stop again. Fix each item:`,
    ...lines,
    'Rule file: .claude/style-rule.md. Allowlist a term in .claude/plain-speech-allow.txt only when it is a name the repo uses.',
  ].join('\n');
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  const argv = process.argv.slice(2);
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  if (argv[0] === '--check-file' && argv[1]) {
    const findings = checkReply(fs.readFileSync(argv[1], 'utf8'), { cwd });
    if (findings.length) {
      process.stdout.write(`${formatReason(findings)}\n`);
      process.exit(1);
    }
    process.stdout.write('plain-speech: clean\n');
    return;
  }
  if (argv[0] === '--check-transcript' && argv[1]) {
    const { promptText, replyText } = lastTurn(argv[1]);
    const findings = checkReply(replyText, { promptText, cwd });
    if (findings.length) {
      process.stdout.write(`${formatReason(findings)}\n`);
      process.exit(1);
    }
    process.stdout.write('plain-speech: clean\n');
    return;
  }

  // Hook mode: JSON on stdin from Claude Code.
  let input = {};
  try {
    input = JSON.parse(readStdin() || '{}');
  } catch {
    return; // fail open
  }
  if (input.stop_hook_active) return; // one rewrite pass per turn
  if (!input.transcript_path || !fs.existsSync(input.transcript_path)) return;
  const { promptText, replyText } = lastTurn(input.transcript_path);
  if (!replyText.trim()) return;
  const findings = checkReply(replyText, { promptText, cwd: input.cwd || cwd });
  if (process.env.PLAIN_SPEECH_HOOK_DEBUG) {
    process.stderr.write(`${JSON.stringify(findings, null, 1)}\n`);
  }
  if (!findings.length) return;
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason: formatReason(findings) })}\n`);
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    if (process.env.PLAIN_SPEECH_HOOK_DEBUG) process.stderr.write(`${error && error.stack}\n`);
    process.exitCode = 0; // never trap the session
  }
}
