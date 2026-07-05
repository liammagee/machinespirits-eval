export const PUBLIC_EVIDENCE_SCHEMA = 'dramatic-derivation.public-evidence.v0';

export const ADAPTATION_SCOPES = Object.freeze(['turn', 'dialogue_block', 'scene', 'act']);

export const PUBLIC_EVIDENCE_STANCES = Object.freeze([
  'tentative_correct',
  'defensive',
  'fluent_echo',
  'purpose_question',
  'near_final',
  'social_disengagement',
  'confused',
  'resistant',
  'unknown',
]);

export const PROOF_PRIVATE_KEYS = Object.freeze([
  'secret',
  'proofPath',
  'proof_path',
  'rawBoard',
  'raw_board',
  'hiddenBoard',
  'hidden_board',
  'corruptionLedger',
  'corruption_ledger',
  'D',
  'dNow',
  'dIfRestored',
  'deltaD',
  'finalD',
  'trajectoryD',
  'boardD',
  'sourcePremiseIds',
  'sourceProofPathIds',
  'proofTree',
  'closureTrace',
]);

const FORBIDDEN_KEYS = new Set(PROOF_PRIVATE_KEYS);
const SCOPE_SET = new Set(ADAPTATION_SCOPES);

function norm(text) {
  return String(text || '').toLowerCase();
}

export function cleanPublicText(text, limit = 600) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

export function auditPublicOnlyInput(input = {}, path = []) {
  const leaks = [];
  if (!input || typeof input !== 'object') {
    return { ok: true, leaks, forbiddenKeys: [...PROOF_PRIVATE_KEYS].sort() };
  }
  const visit = (value, currentPath) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...currentPath, String(index)]));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const nextPath = [...currentPath, key];
      if (FORBIDDEN_KEYS.has(key)) leaks.push({ path: nextPath.join('.'), key });
      visit(child, nextPath);
    }
  };
  visit(input, path);
  return { ok: leaks.length === 0, leaks, forbiddenKeys: [...PROOF_PRIVATE_KEYS].sort() };
}

export function publicDialogueLines(transcript = []) {
  return (Array.isArray(transcript) ? transcript : [])
    .filter((line) => ['learner', 'tutor', 'stage', 'director'].includes(line?.role))
    .map((line) => ({
      role: line.role === 'director' ? 'stage' : line.role,
      text: cleanPublicText(line.text),
      exchangeType: line.meta?.exchange?.type || line.exchangeType || null,
      turn: Number.isFinite(Number(line.turn)) ? Number(line.turn) : null,
    }))
    .filter((line) => line.text);
}

function learnerLines(input = {}) {
  const lines = publicDialogueLines(input.transcript).filter((line) => line.role === 'learner');
  const explicit = cleanPublicText(input.currentUtterance || input.learnerText || input.exchange?.text || '');
  if (explicit) lines.push({ role: 'learner', text: explicit, exchangeType: input.exchange?.type || null, turn: null });
  return lines;
}

function lastLearnerLine(input = {}) {
  const lines = learnerLines(input);
  return lines[lines.length - 1] || { role: 'learner', text: '', exchangeType: null, turn: null };
}

function markers(text, patterns) {
  const out = [];
  const lowered = norm(text);
  for (const [label, pattern] of patterns) {
    if (pattern.test(lowered)) out.push(label);
  }
  return out;
}

function classifyStance(text, exchangeType = null, input = {}) {
  const lowered = norm(text);
  if (input.stance && PUBLIC_EVIDENCE_STANCES.includes(input.stance)) return input.stance;
  if (
    input.uptake?.quality === 'echo_only' ||
    /\b(as you said|you said|just repeating|i can repeat)\b/u.test(lowered)
  ) {
    return 'fluent_echo';
  }
  if (
    exchangeType === 'resistance' ||
    /\b(but|surely|can't be|cannot be|doesn't follow|does not follow)\b/u.test(lowered)
  ) {
    return 'resistant';
  }
  if (/\b(why does|why would|why is|what does .* matter|what is .* for|what does .* prove)\b/u.test(lowered)) {
    return 'purpose_question';
  }
  if (
    exchangeType === 'confusion' ||
    exchangeType === 'repair_request' ||
    /\b(lost|confus|unclear|don't follow|do not follow)\b/u.test(lowered)
  ) {
    return 'confused';
  }
  if (/\b(whatever|i don't care|do not care|fine i guess|just tell me)\b/u.test(lowered)) {
    return 'social_disengagement';
  }
  if (input.nearFinal || /\b(so the answer is|therefore|then it must be|i can assert|that settles)\b/u.test(lowered)) {
    return 'near_final';
  }
  if (/\b(i think|i would say|it seems|maybe|because|so|which means|that means)\b/u.test(lowered)) {
    return 'tentative_correct';
  }
  if (/\b(no|not really|i disagree|that is not)\b/u.test(lowered)) return 'defensive';
  return 'unknown';
}

function confidenceFor({ text, stance, markerCount, inputAudit }) {
  if (!inputAudit.ok) return 0;
  let confidence = text ? 0.55 : 0.2;
  if (stance !== 'unknown') confidence += 0.2;
  if (markerCount >= 2) confidence += 0.15;
  if (markerCount >= 4) confidence += 0.05;
  return Math.min(0.95, +confidence.toFixed(2));
}

export function derivePublicLearnerEvidence(input = {}) {
  const inputAudit = auditPublicOnlyInput(input);
  const scope = SCOPE_SET.has(input.scope) ? input.scope : 'turn';
  if (!inputAudit.ok) {
    return {
      schema: PUBLIC_EVIDENCE_SCHEMA,
      publicOnly: true,
      scope,
      currentUtterance: '',
      recentUtterances: [],
      stance: 'unknown',
      uptakeMarkers: [],
      resistanceMarkers: [],
      affectMarkers: [],
      purposeMarkers: [],
      echoMarkers: [],
      uncertaintyMarkers: [],
      evidenceConfidence: 0,
      inputAudit,
    };
  }

  const recent = learnerLines(input);
  const current = lastLearnerLine(input);
  const text = current.text;
  const stance = classifyStance(text, current.exchangeType, input);
  const uptakeMarkers = markers(text, [
    ['own_words', /\b(i would say|in my words|i read it as|i take it|the point is)\b/u],
    ['uses_reasoning', /\b(because|so|therefore|which means|that means|it follows)\b/u],
    ['ready_to_continue', /\b(i can|let me|next|continue|go on)\b/u],
  ]);
  const resistanceMarkers = markers(text, [
    ['explicit_resistance', /\b(but|surely|doesn't follow|does not follow|can't be|cannot be)\b/u],
    ['answer_request', /\b(just tell me|give me the answer|what is the answer)\b/u],
  ]);
  const affectMarkers = markers(text, [
    ['frustration', /\b(frustrated|annoyed|whatever|fine)\b/u],
    ['overload', /\b(overwhelmed|too much|slow down|lost)\b/u],
    ['confidence', /\b(that helps|i see|makes sense|clear now)\b/u],
  ]);
  const purposeMarkers = markers(text, [
    ['why_matters', /\b(why does|why would|what does .* matter|what is .* for)\b/u],
    ['proof_link', /\b(proves|shows why|needed because|without it)\b/u],
  ]);
  const echoMarkers = markers(text, [['tutor_echo', /\b(as you said|you said|just repeating|i can repeat)\b/u]]);
  const uncertaintyMarkers = markers(text, [
    ['tentative', /\b(i think|maybe|i suppose|it seems)\b/u],
    ['gap_named', /\b(missing|gap|not ready|i need)\b/u],
  ]);
  const markerCount =
    uptakeMarkers.length +
    resistanceMarkers.length +
    affectMarkers.length +
    purposeMarkers.length +
    echoMarkers.length +
    uncertaintyMarkers.length;

  return {
    schema: PUBLIC_EVIDENCE_SCHEMA,
    publicOnly: true,
    scope,
    currentUtterance: text,
    recentUtterances: recent.map((line) => line.text).slice(-5),
    stance,
    uptakeMarkers,
    resistanceMarkers,
    affectMarkers,
    purposeMarkers,
    echoMarkers,
    uncertaintyMarkers,
    evidenceConfidence: confidenceFor({ text, stance, markerCount, inputAudit }),
    inputAudit,
  };
}
