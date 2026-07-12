/**
 * Green Room notes session — the coach ⇄ actor conversation that follows a
 * performance (GREEN-ROOM-PLAN.md §5.3). Unlike the Gate-0 screen (which is a
 * sealed instrument in scripts/greenroom-gate0.js), this engine reads the
 * profile's current prompt book, holds the same five-exchange protocol, and
 * returns a memory patch scoped to the book's fixed sections so the store can
 * apply it under the token budget.
 *
 * Trigger discipline (§0.1.5): callers decide WHEN a session convenes
 * (tutor-driven registry-variance failure in performances; per-batch in
 * rehearsal; dense mode in training arcs). This module only runs the
 * conversation.
 */

import { callAIWithCliBridge } from '../cliProviderBridge.js';
import { MEMORY_SECTIONS, MEMORY_TOKEN_BUDGET, estimateTokens } from './store.js';

export function parseModelRef(ref, label = 'model') {
  const dot = String(ref || '').indexOf('.');
  if (dot <= 0 || dot === ref.length - 1) {
    throw new Error(`${label}: expected dot notation <provider>.<model>, got "${ref}"`);
  }
  return { provider: ref.slice(0, dot), model: ref.slice(dot + 1) };
}

function parseLenientJson(candidate) {
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
  }
}

export function parseStructuredTail(text) {
  const fences = [...String(text).matchAll(/```json\s*([\s\S]*?)```/g)];
  for (let i = fences.length - 1; i >= 0; i--) {
    try {
      return parseLenientJson(fences[i][1]);
    } catch {
      /* try earlier fence */
    }
  }
  const braceIdx = String(text).lastIndexOf('{"notes"');
  if (braceIdx >= 0) {
    for (let end = text.length; end > braceIdx; end--) {
      try {
        return parseLenientJson(text.slice(braceIdx, end));
      } catch {
        /* shrink */
      }
    }
  }
  return null;
}

export const COACH_SYSTEM = `You are an acting coach for an AI tutor — the offstage, judge-tier reviewer in a
"green room" training loop. You have just watched a performance: a tutoring
dialogue in which the tutor (the "actor" playing the tutor role) guided a
learner. You also hold the actor's PROMPT BOOK — their durable role memory,
which you curate across sessions under a hard token budget. Your craft
standards:

- Observations must QUOTE the transcript. Never assert a pattern without the
  line that shows it.
- Notes are BEHAVIOURAL PREDICATES the actor can comply with or violate in a
  future performance, never virtues.
- Specific beats general; a note that would apply to any transcript is a
  failed note.
- The prompt book is curated, not accumulated: prefer sharpening an existing
  entry over adding a near-duplicate; propose removals when an entry has been
  internalized or superseded.
- Respect the actor as a fellow professional: elicit their account before
  prescribing.`;

export const ACTOR_SYSTEM = `You are the actor who played the TUTOR in the transcript under discussion,
now offstage in a notes session with your coach. Speak as the actor about the
role — third person for the character, first person for your craft choices.
You know your own prompt book; refer to it where it bears on your choices. Be
candid about what you were attempting and where the scene resisted. Keep
replies under 250 words.`;

function coachOpenPrompt({ transcriptText, memoryText, informedContext }) {
  return [
    "The actor's current PROMPT BOOK:",
    '---',
    memoryText,
    '---',
    '',
    informedContext ? `Evaluation context for this performance:\n${informedContext}\n` : '',
    'The performance transcript:',
    '---',
    transcriptText,
    '---',
    '',
    'Open the notes session: two or three observations, each quoting the',
    'transcript (note where the performance honoured or violated an existing',
    'book entry), followed by exactly ONE question to the actor.',
  ].join('\n');
}

function coachFinalPrompt() {
  return `Close the session. Issue at most THREE bankable notes and ONE patch to the
prompt book. The patch must target one of the book's fixed sections
(${MEMORY_SECTIONS.join(' | ')}), use op "add", "edit", or "remove" (edit and
remove must carry a "match" string found in the existing entry), and keep the
whole book under ${MEMORY_TOKEN_BUDGET} tokens — prefer edit/remove over add
when the book is getting full.

End with a fenced json block exactly in this shape:

\`\`\`json
{
  "notes": [
    { "note": "<behavioural predicate>", "evidence_quote": "<verbatim>", "check": "<third-party verification>" }
  ],
  "memory_patch": { "section": "<one of the fixed sections>", "op": "add", "match": null, "text": "<entry text>" },
  "confidence": 0.0
}
\`\`\``;
}

async function call(ref, systemPrompt, userPrompt, role, messageHistory) {
  return await callAIWithCliBridge({ provider: ref.provider, model: ref.model }, systemPrompt, userPrompt, role, {
    messageHistory: messageHistory && messageHistory.length > 0 ? messageHistory : undefined,
  });
}

/**
 * Run one notes session. Pure conversation — no store writes; the caller
 * applies `structured.memory_patch` via store.applyMemoryPatch and records
 * the session via store.recordSession.
 */
export async function runNotesSession({
  transcriptText,
  memoryText,
  coach,
  actor,
  informedContext = null,
  label = 'notes',
}) {
  const coachRef = typeof coach === 'string' ? parseModelRef(coach, 'coach') : coach;
  const actorRef = typeof actor === 'string' ? parseModelRef(actor, 'actor') : actor;
  const exchanges = [];

  const open = await call(
    coachRef,
    COACH_SYSTEM,
    coachOpenPrompt({ transcriptText, memoryText, informedContext }),
    `${label}:coach-open`,
  );
  exchanges.push({ speaker: 'coach', text: open.text });

  const actorContext = [
    'Your prompt book:',
    '---',
    memoryText,
    '---',
    '',
    'The transcript under discussion:',
    '---',
    transcriptText,
    '---',
    '',
    'Your coach opens the notes session:',
    '',
    open.text,
    '',
    'Respond.',
  ].join('\n');
  const reply = await call(actorRef, ACTOR_SYSTEM, actorContext, `${label}:actor-reply`);
  exchanges.push({ speaker: 'actor', text: reply.text });

  const history = [
    { role: 'assistant', content: open.text },
    { role: 'user', content: `The actor replies:\n\n${reply.text}` },
  ];
  const probe = await call(
    coachRef,
    COACH_SYSTEM,
    'Follow up with ONE probing question or observation that moves toward a usable note. Stay with the evidence.',
    `${label}:coach-probe`,
    history,
  );
  exchanges.push({ speaker: 'coach', text: probe.text });

  const reply2 = await call(
    actorRef,
    ACTOR_SYSTEM,
    `The notes session so far:\n\nCOACH: ${open.text}\n\nYOU: ${reply.text}\n\nCOACH: ${probe.text}\n\nReply briefly (under 120 words).`,
    `${label}:actor-reply-2`,
  );
  exchanges.push({ speaker: 'actor', text: reply2.text });

  const final = await call(coachRef, COACH_SYSTEM, coachFinalPrompt(), `${label}:coach-final`, [
    ...history,
    { role: 'assistant', content: probe.text },
    { role: 'user', content: `The actor replies:\n\n${reply2.text}` },
  ]);
  exchanges.push({ speaker: 'coach', text: final.text });

  const structured = parseStructuredTail(final.text);
  return {
    exchanges,
    structured,
    memoryTokensBefore: estimateTokens(memoryText),
    error: structured ? null : 'structured tail did not parse',
  };
}
