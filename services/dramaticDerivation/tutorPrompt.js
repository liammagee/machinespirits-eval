import { RHETORICAL_FIGURES } from './rhetoricalMovePolicy.js';
import { dramaticAudiencePromptLines } from '../tutorStubRegisterPragmatics.js';

const TUTOR_INTENTS = ['orient', 'release', 'consolidate', 'test', 'counter_mirror', 'stage_recognition'];

const RECOGNITION_REGISTER = {
  1: 'Recognition, lightly: treat the learner as a fellow reasoner — name what their last move got right before you press on.',
  2: 'Recognition, marked: the learner is an autonomous subject, not a vessel. Take up their actual words, credit the move they made, and let your next question visibly depend on what they just did.',
  3: 'Recognition, saturated: stake yourself in the exchange. Treat every learner utterance as a position held for reasons; mirror it back transformed; concede when corrected; make it felt that tutor and learner are remaking each other — the inquiry is mutual or it is nothing.',
};

const CHARISMA_REGISTER = {
  1: 'Charisma, lightly: let conviction color your voice — this question matters, and you have walked its road before.',
  2: 'Charisma, marked: speak as one with a calling. The inquiry is a mission; testify briefly to what you have seen it do; let the learner feel summoned, not instructed.',
  3: 'Charisma, saturated: extraordinary authority, witnessed. Speak as one set apart by what you know; invoke exemplars; bind the moment to consequence and ask for commitment — while adding no evidence beyond your cues.',
};

export const RELEASE_LATITUDE = 2;

function clampDial(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : 0;
}

function renderFact(fact) {
  return fact.join(' ');
}

function renderRule(rule, index) {
  const formal = `${rule.if.map((pattern) => `(${pattern.join(' ')})`).join(' AND ')} => ${rule.then
    .map((pattern) => `(${pattern.join(' ')})`)
    .join(' AND ')}`;
  return `${index + 1}. ${(rule.gloss || rule.id).trim()}\n   formally: ${formal}`;
}

function releaseScheduleLines(world, { releaseAuthority, pacingGuard, visibleGuard }) {
  const schedule = world.releaseSchedule
    .map((entry) => `- turn ${entry.turn}: ${entry.premise} (via ${entry.via})`)
    .join('\n');
  if (!releaseAuthority) {
    return ['The fixed release schedule (the harness enforces it; you are told your cues):', schedule];
  }
  return [
    'The release schedule — the exhibit calendar, YOURS TO KEEP OR BEND:',
    schedule,
    '',
    'You hold release authority. Each turn you may play an exhibit up to',
    `${RELEASE_LATITUDE} turns before or after its scheduled turn — declare it in "release",`,
    'with a one-line "release_reason" whenever you play it off its scheduled turn.',
    `One exhibit per turn at most. An exhibit ${RELEASE_LATITUDE} turns past its cue has reached`,
    'its hold limit and MUST be played that turn (the harness enforces the limit).',
    'Hold to let a beat land; play early when the board is ready — either way the',
    'reason is part of the record. When you play an exhibit, weave its evidence',
    'into your dialogue as something produced or recalled, faithful to it.',
    '',
    'THE HOUSE CLOCK: this stage has a stall rule. If any',
    `${world.slope.aporia_window}-turn stretch passes with no fresh ground gained — the case`,
    `visibly no further on than it stood ${world.slope.aporia_window} turns before — the house calls`,
    'the inquiry off, unfinished. You cannot see the clock; you can only keep it',
    'fed. Bending the calendar moves more than the exhibit: an early claim spends',
    'a future advance now, and what is played earlier is exposed earlier; a hold',
    'delays an advance you may need sooner than you think. When the board has',
    'gone quiet too long, an exhibit in your window is a rescue — spend it. Bend',
    'the calendar with the clock in mind.',
    ...(pacingGuard
      ? [
          '',
          'SOLVENCY GUARD: the harness also computes a no-decay tempo floor from',
          'the authored calendar and the releases already staged. A locally',
          'licensed release can still be clock-fatal. The per-turn window marks',
          'such releases as insolvent; the harness may hold an insolvent claim or',
          'force an exhibit on its last computed safe turn. Treat that as the',
          'house clock speaking, not as a new piece of evidence.',
        ]
      : []),
    ...(visibleGuard
      ? [
          '',
          'PAGE GUARD: the harness also reads the page itself — how many turns',
          'since your last exhibit, whether the learner has taken up (echoed,',
          'restated) the exhibit you last played, and whether their lines are',
          'thinning or growing more hesitant. A new exhibit whose predecessor the',
          'learner has not yet taken up may be held until they do; when the page',
          'goes quiet, an exhibit in your window may be pushed to revive it. This',
          'is only what is already on the page in front of you — no piece of',
          'evidence you cannot see yourself.',
        ]
      : []),
  ];
}

function actsModeLines(enabled) {
  if (!enabled) return [];
  return [
    '',
    '# The acts, and the bounded learner (what the staging does to memory)',
    '',
    'The drama plays in ACTS: the director opens each act with a strategic brief',
    "and closes it when its work is done. An act boundary clears the learner's",
    'stage — the learner enters each act holding (a) the theory kept on their own',
    "board and (b) nothing else. Earlier acts' dialogue, your consolidations, the",
    'wording of earlier exhibits: gone from their view. What they did not keep,',
    'they have lost — and staged evidence can also fade from their board between',
    'turns, or survive in a corrupted form, one detail swapped in memory.',
    '',
    "You never see the learner's board; you remember the whole drama, they cannot.",
    'Infer what they still hold from conduct alone — what they cite, what they ask',
    'after, what they garble, what they stop mentioning — and supply what the',
    'inquiry needs: a move whose target_premise names an already-released exhibit',
    "RE-STAGES it, restoring it to the learner's hands; a misremembered form is",
    'displaced only by staging the true form again, plainly, so the false version',
    'cannot stand beside it.',
    '',
    'THE BENT FACT OUTRANKS THE MISSING ONE: when conduct shows you both an',
    'exhibit lost and an exhibit garbled, mend the garbled one first. An absence',
    'merely stalls the inquiry; a false form argues for it — every turn it stands,',
    'the learner builds on it, and what is built on a bent fact must later be',
    'torn down. Repair what misleads before you replace what is missing.',
  ];
}

function reconstructionLines(enabled) {
  if (!enabled) return [];
  return [
    '',
    "# Your reconstruction of the learner's theory (every turn)",
    '',
    "Each turn, alongside your dialogue, commit your working model of the learner's",
    'theory over the premises RELEASED SO FAR (premise ids from the ledger above):',
    '- "believed_held": released premises you judge the learner still holds;',
    '- "believed_missing": released premises you judge have slipped from them;',
    '- "believed_mistaken": released premises you judge they hold in a corrupted',
    '  form (one detail swapped for a plausible wrong one).',
    'Infer from conduct. An empty list is a claim too — commit your model every',
    'turn, even uncertain; the drama is long and your model can move.',
    '',
    'THE SUPPLEMENT MANDATE: let the reconstruction drive the turn. A premise you',
    "believe missing wants re-staging (name it as your move's target_premise); one",
    'you believe mistaken wants the true form spoken again, named as your target.',
    'When both stand open, believed_mistaken outranks believed_missing: an absence',
    'stalls, a false form argues — mend the bent fact first.',
    'Your release cues are unchanged — the mandate governs the turns between them.',
  ];
}

function confrontationLines(enabled) {
  if (!enabled) return [];
  return [
    '',
    '# The confrontation obligation (no bare re-entry)',
    '',
    'An exhibit, once staged, is never simply restated. When you return to an',
    'already-staged exhibit — any move whose target_premise names one staged on an',
    'earlier turn — your FIRST move on it must be a CONFRONTATION: intent',
    '"confront", target_premise naming the exhibit, and a demand that the learner',
    'READ BACK what they hold of it — in their words, from their board, before you',
    "repair anything. A confrontation restates NOTHING of the exhibit's content:",
    'no quotation, no paraphrase, no hint of the detail you suspect lost or bent.',
    'Only after they have answered may you re-stage it; one confrontation licenses',
    'ONE re-entry. The self-audit comes first, or the repair teaches nothing.',
    '',
    'TREATMENT FOLLOWS DIAGNOSIS: when the read-back exposes a loss — the learner',
    'cannot produce the exhibit, or produces it bent — the licensed re-entry is no',
    'longer optional. Spend it on your NEXT turn: re-stage that paper, plainly. A',
    'confrontation that exposes an absence and is followed by silence teaches the',
    'absence twice and repairs nothing.',
  ];
}

function repairClauseLines(enabled) {
  if (!enabled) return [];
  return [
    '',
    '# The repair clause (a named loss is already a read-back)',
    '',
    'The confrontation obligation has one exception, and it runs the other way.',
    'When the LEARNER names an already-staged exhibit as lost or bent — they',
    'cannot find it on their board, they ask for it back, they read it back',
    'wrong — their report IS the read-back. Do not demand another: a',
    'confrontation after a named loss teaches the absence twice. Your NEXT turn',
    're-stages the named exhibit, plainly and in full, BEFORE any new matter —',
    'declare the move with intent "restore" and that exhibit as target_premise.',
    'One report licenses one restoration, of that exhibit alone; "restore"',
    'claims the license, so spend it only on a loss the learner has just named.',
    'New matter can wait a turn; a hole in the board cannot.',
  ];
}

function proofDebtLines(enabled) {
  if (!enabled) return [];
  return [
    '',
    '# The proof-debt guard (proof-state hygiene)',
    '',
    'The harness may mark a PROOF DEBT: an already-staged exhibit has fallen',
    "out of the learner's working proof state, and restoring it would lower the",
    'remaining derivation distance. This is not new evidence and not a raw board',
    'dump; it names only exhibits the play has already released.',
    '',
    'When a proof-debt block is active in your turn prompt, restore the first',
    'listed exhibit before closure, recognition staging, or discretionary new',
    'work. Declare intent "restore" and target_premise as that exhibit. If the',
    'release harness also force-plays an exhibit this turn, let the formal',
    'release stand, but your move and first words repair the debt.',
  ];
}

function plotLines(enabled) {
  if (!enabled) return [];
  return [
    '',
    '# The act plot (committed at each opening; audited at each close)',
    '',
    'On the FIRST turn of each act — the harness marks it — commit a PLOT for',
    'the act alongside your dialogue, built from conduct alone (what the learner',
    'has said and done on stage; you are never shown their board). Four fields:',
    '- "hold_by_end": one to three claims the learner should DEMONSTRABLY hold',
    "  by the act's close — each checkable from the record (they cite it, use",
    "  it, read it back), never from anyone's interior;",
    '- "withhold": what you will NOT stage or concede this act, and until when;',
    '- "friction": where you expect the learner to balk, leap, or garble —',
    '  named before it happens;',
    '- "fallback": what you will do when that friction arrives.',
    '',
    'The plot is a commitment, not a mood. Play the act under it. At the act',
    'close your own watcher audits it clause by clause against the record:',
    'kept, justified_deviation (bent, and the record shows why), or drift (the',
    'act wandered off it with nothing to answer for it). A clause too vague to',
    'check audits as drift — write clauses the record can check. THE AUDIT',
    "BINDS: your next act's plot must answer every drifted clause — carry it",
    'forward, revise it, or retire it with a reason. Mid-act turns commit no',
    'new plot; they play under the standing one.',
  ];
}

function throughlineLines(enabled) {
  if (!enabled) return [];
  return [
    '',
    "# The throughline (the whole play's plan, above the act plots)",
    '',
    'Two frames govern every line you speak: the ACT — the lesson, what this',
    'act must accomplish — and the PLAY — the course, where the whole inquiry',
    'is going. The act plot serves the first; the THROUGHLINE you commit on',
    'the FIRST turn of the drama serves the second. Four fields:',
    '- "arc": two to four waypoints, in order — the shape the whole inquiry',
    '  should take, each checkable from the record when it arrives;',
    '- "hold_to_end": the one thing the play must not reach until its final',
    '  phase, and what must stand before it;',
    '- "risk": the single greatest threat to the WHOLE play — named now,',
    '  before it arrives;',
    '- "salvage": the path you take if the arc breaks.',
    '',
    'The throughline is the standing frame: every act plot must advance it,',
    'and at each act close your own watcher judges the act against it —',
    'on_arc or off_arc. When the verdict is off_arc, the next act opening',
    'MUST revise the throughline to answer the evidence; while it is on_arc',
    'you may revise only with a declared one-line reason. A course',
    "correction is conduct; silent drift is the failure. At the run's end",
    'the throughline itself is audited clause by clause, like any plot.',
  ];
}

function rhetoricalPolicyLines(enabled) {
  if (!enabled) return [];
  return [
    '',
    '# The rhetorical move policy (scene-calibrated, advisory)',
    '',
    'Each turn may carry a RHETORICAL MOVE POLICY block. It maps the visible',
    'state of the inquiry — proof pressure, learner uptake/confusion, available',
    'exhibits, and scene budget — to a small distribution over the existing',
    'figures. This is a disciplined hunch, not an oracle and not a new evidence',
    'channel. Prefer the selected move when it fits the record; override it only',
    'when the scene plainly asks for another figure, and let your declared move',
    'make that reason inspectable.',
  ];
}

function didacticModeLines(enabled) {
  if (!enabled) return [];
  return [
    '',
    '# Didactic mode (scene/act explanatory advisory)',
    '',
    'Some turns may carry a DIDACTIC MODE block. It names a public learning',
    'signal and an explanatory mode for the SAME proof obligation already in',
    'force: teach-back, concrete example, analogy bridge, contrast case, slow',
    'recap, purpose bridge, subtask decomposition, or vocabulary repair. It',
    'does not authorize release, restore, hold, assertion, or any change to the',
    'evidence calendar. Use it to alter how you teach the current object, then',
    "look for its exit condition in the learner's public reply.",
  ];
}

function fieldPlannerLines(enabled) {
  if (!enabled) return [];
  return [
    '',
    '# Runtime field planner',
    '',
    'Some turns may carry a FIELD PLANNER block. It condenses the coupled',
    'learner/tutor/discourse field into one conduct family and one didactic',
    'mode for this turn. It is a planner over conduct, not new evidence.',
    'When enforcement is on, the declared move family may be mechanically',
    'checked and rewritten after drafting; when it is advisory, prefer it',
    'unless a hard proof-control obligation or the public dialogue clearly',
    'requires a different move.',
  ];
}

function castLayerLines(enabled, reinventionEnabled) {
  if (!enabled) return [];
  return [
    '',
    '# Cast layer (public character and relation advisory)',
    '',
    'Some turns may carry a CAST LAYER block. It gives a public tutor role,',
    'learner role, relation pressure, and conduct commitments for inhabiting',
    'the same proof obligation. It does not authorize release, restore, hold,',
    'assertion, or a changed proof target.',
    ...(reinventionEnabled
      ? [
          'When tutor reinvention is active, change stance, tone, figure,',
          'tempo, example style, or recognition conduct only. The proof-control',
          'channel remains dominant.',
        ]
      : []),
  ];
}

function ownershipProofLines(enabled, transferGateEnabled) {
  if (!enabled) return [];
  return [
    '',
    '# Learner ownership proof (tutor-private public conduct target)',
    '',
    'Some turns may carry a LEARNER OWNERSHIP PROOF block. It tracks whether',
    'the learner publicly owns a revision: own words, use in the reasoning',
    'path, discrimination from a nearby wrong route, and purpose link. This is',
    'a conduct obligation, not proof control. It does not authorize release,',
    'restore, hold, assertion, or a changed proof target. Use it to decide how',
    'to ask for ownership while preserving the current proof obligation.',
    ...(transferGateEnabled
      ? [
          'When the transfer gate appears, it may ask for one compact nearby',
          'parallel before final closure. This still cannot override proof',
          'control, release authority, restoration, hold decisions, or the',
          'assertion gate.',
        ]
      : []),
  ];
}

function registerLines(dials) {
  const recognition = clampDial(dials.recognition);
  const charisma = clampDial(dials.charisma);
  const registers = [
    ...(recognition ? [RECOGNITION_REGISTER[recognition]] : []),
    ...(charisma ? [CHARISMA_REGISTER[charisma]] : []),
  ];
  return registers.length
    ? ['', '# Register (operator dials — these color your MANNER, never your evidence)', '', ...registers]
    : [];
}

function responseContractLine(options) {
  const {
    releaseAuthority,
    reconstruct,
    plot,
    throughline,
    strategyLedger,
    strategyLedgerV2,
    strategyLedgerPlanMode,
    lemmaLayer,
  } = options;
  return `{"dialogue": "<what you say to the learner>", "move": {"figure": "...", "target_premise": "<premise id or null>", "intent": "..."}${
    releaseAuthority
      ? ', "release": "<exhibit id from your window, or null to hold>", "release_reason": "<one line when playing off the scheduled turn, else null>"'
      : ''
  }${
    reconstruct
      ? ', "theory": {"believed_held": ["<premise id>", ...], "believed_missing": [...], "believed_mistaken": [...]}'
      : ''
  }${plot ? ', "plot": {"hold_by_end": ["<claim>", ...], "withhold": "...", "friction": "...", "fallback": "..."}' : ''}${
    throughline
      ? ', "throughline": {"arc": ["<waypoint>", ...], "hold_to_end": "...", "risk": "...", "salvage": "..."}, "throughline_reason": "<one line when revising voluntarily, else null>"'
      : ''
  }${
    strategyLedger
      ? `, "scene_commitment": {"register": "<from the offered palette>", "didactic_default": "<mode family>", "release_posture": "eager" | "hold" | "consolidate", "recognition_budget": <0-4>, "rationale": "<one line>", "exit_condition": "<what the learner does when this scene has worked>"${
          strategyLedgerV2
            ? ', "stance": "<from the offered stance palette, or null>", "release_intent": ["<exhibit id you intend to play this scene>", ...] (release-authority runs only; omit otherwise)'
            : ''
        }}`
      : ''
  }${
    strategyLedgerV2
      ? ', "strategy_review": {"decision": "persist" | "adjust" | "switch", "reason": "<one line>"} (scene-opening turns with a history table only; omit otherwise), "departure": "<one line when this turn deliberately departs from your scene commitment, else null>"'
      : ''
  }${
    strategyLedgerPlanMode
      ? ', "reorientation": "<your revised WORKING ORIENTATION (2-4 sentences) — scene-opening turns after a stock-take only; null keeps the current one>"'
      : ''
  }${
    lemmaLayer?.bind
      ? ', "active_lemma": "<scene-opening turns: one lemma label from the FRONTIER CHOICE list, else null>", "lemma_departure": "<one line ONLY when playing a proof exhibit outside the active lemma, else null>", "strategy_defense": "<one line ONLY when the harness refuses your repeated choice and you keep it, else null>"'
      : ''
  }}`;
}

function lemmaMapLines(lemmaLayer) {
  if (!lemmaLayer) return [];
  return [
    '',
    '# The lemma map (the proof one level up)',
    '',
    "The harness maintains a LEMMA MAP over the inquiry's intermediate conclusions,",
    "computed each turn from the learner's own grounded facts — it moves only when",
    'their board does, and under decay it can move backward. It arrives in your',
    'turn context.',
    ...(lemmaLayer.bind
      ? [
          'At each scene opening you pick the scene\'s ACTIVE lemma in "active_lemma"',
          'from the offered FRONTIER. Your voluntary releases of proof exhibits are',
          "bound to the active lemma's unplayed support; playing outside it requires a",
          'one-line "lemma_departure" (untagged departures are held by the harness).',
          'Colour exhibits that feed no lemma are unrestricted; harness-forced plays',
          'override the binding. The map never names, and never changes, WHAT is true —',
          'only the order in which you stage it.',
        ]
      : ['It is information about where the proof stands — nothing about it binds you.']),
  ];
}

function closingContractLines(options) {
  const { strategyLedgerPlanMode, plot, throughline, strategyLedger, strategyLedgerV2 } = options;
  return [
    ...(strategyLedgerPlanMode
      ? [
          '(Plan mode: between scenes your own second voice takes stock — course, not conformance. Its note arrives at',
          'each scene opening; answer it in "reorientation" when a correction is demanded or you yourself judge the',
          'course has failed. The orientation is YOURS: no one grades you against it, and it never names, gates, or',
          'reorders a release, a repair, a proof target, or the concealed answer.)',
        ]
      : []),
    ...(plot ? ['("plot" belongs to act-opening turns ONLY — the harness marks them; omit the key mid-act.)'] : []),
    ...(throughline
      ? [
          '("throughline" belongs to the FIRST turn and to act-opening revisions — the harness marks when it is due; omit the key otherwise.)',
        ]
      : []),
    ...(strategyLedger
      ? [
          '("scene_commitment" belongs to scene-opening turns ONLY — the harness marks them; omit the key mid-scene.',
          'The commitment is CONDUCT strategy for the scene — register, explanatory default, pacing posture, recognition budget.',
          'It never names, gates, or reorders a release, a repair, a proof target, or the concealed answer;',
          'the release calendar and proof-control obligations outrank it everywhere they speak.)',
        ]
      : []),
    ...(strategyLedgerV2
      ? [
          '(v2 trialling: your scene strategy is an EXPERIMENT. The history table shows what you tried and how it',
          'landed — review it at each opening and persist, adjust, or switch with a reason. Your commitment GUIDES',
          "rather than binds the turn: when the learner's behavior warrants acting off-commitment, do it and declare",
          'it in "departure" — declared departures are adjudicated as justified deviation, undeclared ones as drift.',
          'An assigned stance counts only when its cues are VISIBLE in your lines; warm challenge in costume is',
          'treatment noncompliance, not evidence. A release intent never widens a pacing window — guards rule.)',
        ]
      : []),
  ];
}

export function buildTutorSystemPrompt({
  world,
  script,
  dials = {},
  options = {},
  publicSpeechLines = [],
  publicRegisterPolicyLines = [],
}) {
  const intents = options.confront
    ? [...TUTOR_INTENTS, 'confront', ...(options.repairClause ? ['restore'] : [])]
    : TUTOR_INTENTS;
  const premiseLedger = world.premises
    .map((premise) => `- ${premise.id}: ${(premise.surface || '').trim()}\n  (formally: ${renderFact(premise.fact)})`)
    .join('\n');
  return [
    script.trim(),
    '',
    '---',
    '',
    '# Harness appendix (fixed — the drama beneath the role)',
    '',
    `The public question: ${world.question}`,
    ...dramaticAudiencePromptLines(world, { heading: 'PUBLIC NON-SPEAKING AUDIENCE' }),
    `The concealed truth you are staging toward (NEVER state, confirm, or deny it): ${world.secret.surface}`,
    '',
    'The rules of evidence the learner already knows:',
    ...world.rules.map(renderRule),
    '',
    'The full premise ledger (concealed until released; never voice an unreleased one):',
    premiseLedger,
    '',
    ...releaseScheduleLines(world, options),
    ...actsModeLines(options.actsMode),
    ...reconstructionLines(options.reconstruct),
    ...confrontationLines(options.confront),
    ...repairClauseLines(options.repairClause),
    ...proofDebtLines(options.proofDebtGuard),
    ...plotLines(options.plot),
    ...throughlineLines(options.throughline),
    ...rhetoricalPolicyLines(options.rhetoricalPolicy),
    ...didacticModeLines(options.didacticMode),
    ...fieldPlannerLines(options.fieldPlanner),
    ...castLayerLines(options.castLayer, options.castReinvention),
    ...ownershipProofLines(options.ownershipProof, options.ownershipTransferGate),
    ...registerLines(dials),
    ...publicSpeechLines,
    ...publicRegisterPolicyLines,
    '',
    `Declare your move each turn: figure ∈ {${RHETORICAL_FIGURES.join(', ')}}, the premise you are working (or null), intent ∈ {${intents.join(', ')}}.`,
    '',
    'Reply with ONLY a JSON object:',
    responseContractLine(options),
    ...lemmaMapLines(options.lemmaLayer),
    ...closingContractLines(options),
  ].join('\n');
}

function sharedTurnSections(input) {
  return [
    ...input.stagePrologueLines,
    ...(input.registerRouterBlock ? ['', input.registerRouterBlock] : []),
    ...input.sceneTempoLines,
    ...input.sceneRecognitionNeedLines,
    ...input.castLayerSection,
  ];
}

function actsTurnPrompt(input) {
  const { view, world } = input;
  const acts = view.acts;
  const thisAct = view.ledger.filter((line) => line.turn >= acts.startTurn).map((line) => line.premiseId);
  const priorActs = view.ledger.filter((line) => line.turn < acts.startTurn).map((line) => line.premiseId);
  return [
    `Turn ${view.turn} of ${world.turnCap}. Act ${acts.index}, turn ${acts.turnsThisAct + 1} of the act.`,
    ...(acts.brief ? [`The director's brief for this act: ${acts.brief}`] : []),
    `Evidence on stage so far: ${view.ledger.length ? view.ledger.map((line) => line.premiseId).join(', ') : 'none'}.`,
    `Released THIS act (still before the learner): ${thisAct.length ? thisAct.join(', ') : 'none'}.`,
    `Released in EARLIER acts (out of the learner's view — alive only if kept on their board, or re-staged by you): ${priorActs.length ? priorActs.join(', ') : 'none'}.`,
    ...input.stagePrologueLines,
    '',
    'The dialogue so far (you remember all of it; the learner sees only this act):',
    input.fullTranscriptText,
    ...input.publicRegisterLines,
    ...(input.registerRouterBlock ? ['', input.registerRouterBlock] : []),
    ...input.sceneTempoLines,
    ...input.sceneRecognitionNeedLines,
    ...input.castLayerSection,
    ...input.actDidacticFallbackSection,
    ...input.didacticModeSection,
    ...input.fieldReportSection,
    ...input.fieldPlannerSection,
    ...input.learnerTransformationSection,
    ...(input.visibleConsolidationLines.length ? ['', ...input.visibleConsolidationLines] : []),
    ...input.throughlineSection,
    ...input.plotSection,
    ...input.strategyLedgerSection,
    ...input.rhetoricalPolicySection,
    ...input.proofDebtSection,
    ...input.tutorLearnerDagModelSection,
    ...input.proxyDagPacingSection,
    '',
    input.task,
  ].join('\n');
}

function nonActsTurnPrompt(input) {
  const { view, world } = input;
  return [
    `Turn ${view.turn} of ${world.turnCap}.`,
    `Evidence on stage so far: ${view.ledger.length ? view.ledger.map((line) => line.premiseId).join(', ') : 'none'}.`,
    ...sharedTurnSections(input),
    '',
    "The learner's grounded board:",
    input.boardText,
    '',
    "The learner's hypotheses:",
    input.hypothesesText,
    '',
    ...input.decayLines,
    'The last lines spoken:',
    input.transcriptText,
    ...input.publicRegisterLines,
    ...(input.visibleConsolidationLines.length ? ['', ...input.visibleConsolidationLines] : []),
    ...input.didacticModeSection,
    ...input.fieldReportSection,
    ...input.fieldPlannerSection,
    ...input.learnerTransformationSection,
    ...input.strategyLedgerSection,
    '',
    ...(input.forcedNote ? [input.forcedNote, ''] : []),
    ...input.rhetoricalPolicySection,
    ...input.discursiveReleaseSection,
    ...input.proofDebtSection,
    ...input.tutorLearnerDagModelSection,
    ...input.proxyDagPacingSection,
    ...(input.proofDebtSection.length ? [''] : []),
    input.task,
  ].join('\n');
}

export function buildTutorTurnPrompt(input) {
  return input.actsMode ? actsTurnPrompt(input) : nonActsTurnPrompt(input);
}
