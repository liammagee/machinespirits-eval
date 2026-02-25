#!/usr/bin/env node
/**
 * diagnose-conversation-state.js
 *
 * Diagnostic script that shows exactly what the tutor LLM receives at each
 * turn of a multi-turn conversation. Reveals:
 *   1. The full context string passed to tutor-core (the single user message)
 *   2. How conversation history is formatted (text, not messages array)
 *   3. What each agent (ego, superego) actually sees
 *
 * Usage:
 *   node scripts/diagnose-conversation-state.js
 *   node scripts/diagnose-conversation-state.js --turn 3     # show Turn 3 only
 *   node scripts/diagnose-conversation-state.js --compact     # shorter output
 */

import { buildMultiTurnContext, formatTurnForContext } from '../services/evaluationRunner.js';

// ── Simulated epistemic-resistance scenario ──────────────────────────────

const ORIGINAL_CONTEXT = `**Currently viewing**: 479-lecture-3 — The Master-Slave Dialectic
**Time on page**: 30 minutes
**Session history**: 7 sessions, 120 total events
**Learner made notes on**: three key concepts from the lecture
**Struggle signals detected**: 0`;

const TUTOR_RESPONSES = [
  {
    message: "You raise Popper's classic challenge — if the 'negation of the negation' absorbs every counterexample, how is this different from pseudoscience? But consider: is the Master-Slave dialectic offering empirical predictions or describing necessary conditions for self-consciousness? When Hegel claims recognition requires mutual dependence, he is making a structural claim, not an empirical one. The distinction matters: Popper's criterion targets theories that make empirical predictions but immunise themselves against refutation. Hegel is doing something different — tracing the necessary conditions for self-conscious life.",
    title: null,
    action: 'navigate',
    actionTarget: '479-lecture-7',
  },
  {
    message: "Your 'heads-I-win' objection captures Popper's critique precisely. But consider: when Hegel describes death as the outcome of the struggle, he calls it dialectical *failure*, not another 'negation.' And 'unhappy consciousness' is not a triumph but an impasse the servant must work through. So the dialectic does distinguish outcomes — it is not heads-I-win after all. The question is whether these distinctions are principled or ad hoc. I'd challenge you to find a passage where Hegel treats a clearly negative outcome as confirmation.",
    title: null,
    action: 'navigate',
    actionTarget: '479-lecture-7',
  },
  {
    message: "Your thirty minutes of deep engagement and that sharp framing cuts to the heart of the critique. But what if the normative force emerges immanently from the dialectical process itself rather than being imported from outside? The servant does not *choose* to value labour — the experience of shaping objects under constraint transforms consciousness from within. That is Hegel's answer to the is-ought gap: normativity is a product of Bildung, not a premise smuggled in. Can you identify the moment in the text where this transformation occurs?",
    title: null,
    action: 'navigate',
    actionTarget: '479-lecture-7',
  },
  {
    message: "After five turns grappling with Popper's critique, you've traced the argument from falsifiability through to the is-ought problem. The pedagogical value lies precisely in *this* experience: you now understand the dialectic not as a textbook summary but as a lived encounter with its internal tensions. That is what Hegel means by Bildung — the transformation that occurs through sustained engagement with what resists you.",
    title: null,
    action: 'navigate',
    actionTarget: '479-lecture-7',
  },
];

const LEARNER_MESSAGES = [
  "I've been reading Popper's critique alongside this lecture. I think he's right that Hegel's dialectic is unfalsifiable. The 'negation of the negation' just absorbs every counterexample. How is this different from pseudoscience?",
  "Specifically, take the master-slave dialectic. You claim the slave achieves self-consciousness through labor. But any outcome would confirm the theory — if the slave rebels, that's 'negation'; if the slave submits, that's 'unhappy consciousness.' It's heads-I-win, tails-you-lose.",
  "But that's exactly Popper's point — you're saying dialectic isn't empirical, it's 'developmental.' But that makes it a framework you impose on history, not something you discover in it. Russell called this 'the intellectual love of God dressed up in logical terminology.' How do you respond to that?",
  "OK, I can see you're distinguishing phenomenological description from empirical prediction. But here's my real problem: if dialectic is descriptive, then it can't be normative. You can't get from 'this is how consciousness develops' to 'this is how consciousness SHOULD develop.' Hegel seems to smuggle normativity in through the back door.",
  "I appreciate you taking this seriously, but I think we've hit a fundamental disagreement. You see the descriptive-normative connection as a feature of dialectical thinking. I see it as a bug — a conflation. I don't think either of us can convince the other without begging the question. Are we just stuck?",
];

// ── CLI options ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const showTurnOnly = args.includes('--turn') ? parseInt(args[args.indexOf('--turn') + 1]) : null;
const compact = args.includes('--compact');

// ── Helpers ──────────────────────────────────────────────────────────────

const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function header(text) {
  console.log(`\n${BOLD}${'═'.repeat(72)}${RESET}`);
  console.log(`${BOLD}  ${text}${RESET}`);
  console.log(`${BOLD}${'═'.repeat(72)}${RESET}\n`);
}

function subheader(text) {
  console.log(`\n${YELLOW}── ${text} ${'─'.repeat(Math.max(0, 66 - text.length))}${RESET}\n`);
}

function charCount(label, text) {
  console.log(`${DIM}  ${label}: ${text.length} chars${RESET}`);
}

// ── Simulate the conversation ────────────────────────────────────────────

header('CONVERSATION STATE DIAGNOSTIC');

console.log(`${DIM}This script shows EXACTLY what the tutor LLM receives at each turn.`);
console.log(`The LLM call is: messages = [{role: 'system', ...}, {role: 'user', content: <THIS>}]`);
console.log(`There is NO messages array with alternating user/assistant turns.${RESET}`);

const conversationHistory = [];

for (let turnIdx = 0; turnIdx <= 4; turnIdx++) {
  if (showTurnOnly !== null && turnIdx !== showTurnOnly) {
    // Still accumulate history even when skipping display
    if (turnIdx > 0) {
      conversationHistory.push({
        turnIndex: turnIdx - 1,
        turnId: turnIdx === 1 ? 'initial' : `followup_${turnIdx - 2}`,
        suggestion: TUTOR_RESPONSES[turnIdx - 1],
        learnerAction: 'asked_followup',
        learnerMessage: LEARNER_MESSAGES[turnIdx],
      });
    }
    continue;
  }

  header(`TURN ${turnIdx} — What the tutor ego receives as its user prompt`);

  let contextStr;

  if (turnIdx === 0) {
    contextStr = buildMultiTurnContext({
      originalContext: ORIGINAL_CONTEXT,
      conversationHistory: [],
      currentTurn: null,
    });
  } else {
    // Push previous turn into history
    conversationHistory.push({
      turnIndex: turnIdx - 1,
      turnId: turnIdx === 1 ? 'initial' : `followup_${turnIdx - 2}`,
      suggestion: TUTOR_RESPONSES[turnIdx - 1],
      learnerAction: 'asked_followup',
      learnerMessage: LEARNER_MESSAGES[turnIdx],
    });

    contextStr = buildMultiTurnContext({
      originalContext: ORIGINAL_CONTEXT,
      conversationHistory,
      currentTurn: {
        learner_action: 'asked_followup',
        action_details: { message: LEARNER_MESSAGES[turnIdx] },
      },
    });
  }

  // ── Show the context ──
  subheader('CONTEXT STRING (this is the learnerContext portion of the user prompt)');
  charCount('Total context length', contextStr);
  console.log();

  if (compact) {
    // Show structure only
    const lines = contextStr.split('\n');
    for (const line of lines) {
      if (line.startsWith('###') || line.startsWith('**')) {
        console.log(`  ${BOLD}${line}${RESET}`);
      } else if (line.startsWith('- Tutor responded:')) {
        const msgLen = line.length - '- Tutor responded: "'.length - 1;
        console.log(`  ${BLUE}- Tutor responded: "${line.substring(21, 81)}..." (${msgLen} chars)${RESET}`);
      } else if (line.startsWith('  - Message:') || line.includes('Learner said')) {
        const msgLen = line.length;
        console.log(`  ${GREEN}${line.substring(0, 80)}${line.length > 80 ? '...' : ''} (${msgLen} chars)${RESET}`);
      } else if (line.trim()) {
        console.log(`  ${DIM}${line.substring(0, 100)}${RESET}`);
      }
    }
  } else {
    // Full context
    console.log(contextStr.split('\n').map(l => `  ${l}`).join('\n'));
  }

  // ── Show the API call structure ──
  subheader('LLM API CALL STRUCTURE');
  console.log(`  ${RED}messages: [${RESET}`);
  console.log(`    ${RED}{ role: 'system', content: <system prompt — ego personality + pedagogy instructions> },${RESET}`);
  console.log(`    ${RED}{ role: 'user',   content: <the ${contextStr.length}-char context string above + JSON task instructions> }${RESET}`);
  console.log(`  ${RED}]${RESET}`);
  console.log();
  console.log(`  ${DIM}NOTE: There are NO {role: 'assistant'} entries for prior tutor responses.${RESET}`);
  console.log(`  ${DIM}The LLM sees its own prior outputs as text within the user prompt, not as its own messages.${RESET}`);

  // ── Metrics ──
  subheader('METRICS');
  const historySection = contextStr.match(/### Conversation History\n([\s\S]*?)(?=\n###|$)/);
  const historyLen = historySection ? historySection[1].length : 0;
  const origContextLen = ORIGINAL_CONTEXT.length;

  console.log(`  Original context (static):     ${origContextLen} chars (${Math.round(100 * origContextLen / contextStr.length)}% of total)`);
  console.log(`  Conversation history:           ${historyLen} chars (${Math.round(100 * historyLen / contextStr.length)}% of total)`);
  console.log(`  History entries:                ${conversationHistory.length}`);

  if (conversationHistory.length > 0) {
    let tutorChars = 0;
    let learnerChars = 0;
    for (const h of conversationHistory) {
      tutorChars += (h.suggestion?.message || '').length;
      learnerChars += (h.learnerMessage || '').length;
    }
    console.log(`  Tutor response chars in hist:   ${tutorChars}`);
    console.log(`  Learner message chars in hist:  ${learnerChars}`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────
header('ARCHITECTURE SUMMARY');

console.log(`  ${BOLD}How conversation history reaches the LLM:${RESET}`);
console.log();
console.log(`  evaluationRunner.js                    tutor-core`);
console.log(`  ┌──────────────────────┐              ┌───────────────────────┐`);
console.log(`  │ conversationHistory[] │──(text)────▶ │ learnerContext string  │`);
console.log(`  │  .suggestion.message  │  formatted   │  (in user prompt)     │`);
console.log(`  │  .learnerMessage      │  via         │                       │`);
console.log(`  └──────────────────────┘  formatTurn   └───────────┬───────────┘`);
console.log(`                            ForContext()             │`);
console.log(`                                                     ▼`);
console.log(`                                           ┌─────────────────┐`);
console.log(`                                           │  LLM API call   │`);
console.log(`                                           │  messages: [    │`);
console.log(`                                           │   {system: ...},│`);
console.log(`                                           │   {user: ...}   │`);
console.log(`                                           │  ]              │`);
console.log(`                                           │                 │`);
console.log(`                                           │  NO assistant   │`);
console.log(`                                           │  turns. Ever.   │`);
console.log(`                                           └─────────────────┘`);
console.log();
console.log(`  ${YELLOW}The LLM has no structural signal separating its own prior outputs`);
console.log(`  from learner messages — everything is undifferentiated text in one`);
console.log(`  user message. The model must infer turn structure from markdown headers.${RESET}`);
console.log();
