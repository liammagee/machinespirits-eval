/**
 * Shared public-dialogue interchange and HTML renderer.
 *
 * This module owns presentation only. Callers choose the public messages,
 * verdicts, rulings, and provenance before constructing the interchange. The
 * strict key allowlists are deliberate: a transcript surface cannot quietly
 * pass private prompts, deliberation, proof state, or hidden learner state into
 * the renderer.
 */

export const DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA = 'machinespirits.dramatic-dialogue-interchange.v1';
export const DRAMATIC_DIALOGUE_RENDERER_SCHEMA = 'machinespirits.dramatic-dialogue-renderer.v1';

const LAYOUTS = new Set(['single', 'shared-learner', 'parallel']);
const SPEAKERS = new Set(['learner', 'tutor']);
const TONES = new Set(['neutral', 'muted', 'pass', 'fail', 'warning', 'info', 'ink']);
const ROOT_KEYS = new Set(['schema', 'id', 'label', 'layout', 'arms', 'turns', 'provenance']);
const ARM_KEYS = new Set(['id', 'label', 'baseline', 'summary']);
const TURN_KEYS = new Set(['id', 'turn', 'label', 'messages', 'emptyLanes']);
const MESSAGE_KEYS = new Set([
  'id',
  'speaker',
  'turn',
  'arm',
  'text',
  'delivery',
  'verdict',
  'ruling',
  'provenance',
  'gloss',
  'labels',
  'details',
]);
const BADGE_KEYS = new Set(['label', 'status', 'tone', 'title', 'kind', 'group']);
const PROVENANCE_KEYS = new Set(['sourceId', 'sourcePath', 'sourceHash', 'locator', 'quoteExact', 'note']);
const DETAIL_KEYS = new Set(['summary', 'group', 'entries']);
const DETAIL_ENTRY_KEYS = new Set(['label', 'text']);
const EMPTY_LANE_KEYS = new Set(['arm', 'label']);

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function assertKeys(value, allowed, label) {
  assertObject(value, label);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${label} contains unsupported field(s): ${unknown.join(', ')}`);
}

function assertString(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? 'a string' : 'a non-empty string'}`);
  }
}

function validateBadge(value, label) {
  if (value === null || value === undefined) return;
  assertKeys(value, BADGE_KEYS, label);
  assertString(value.label, `${label}.label`);
  for (const key of ['status', 'title', 'kind', 'group']) {
    if (value[key] !== undefined) assertString(value[key], `${label}.${key}`, { allowEmpty: key === 'title' });
  }
  if (value.tone !== undefined && !TONES.has(value.tone)) {
    throw new Error(`${label}.tone must be one of ${[...TONES].join(', ')}`);
  }
}

function validateProvenance(value, label) {
  if (value === null || value === undefined) return;
  assertKeys(value, PROVENANCE_KEYS, label);
  for (const key of ['sourceId', 'sourcePath', 'sourceHash', 'locator', 'note']) {
    if (value[key] !== undefined) assertString(value[key], `${label}.${key}`, { allowEmpty: key === 'note' });
  }
  if (value.quoteExact !== undefined && typeof value.quoteExact !== 'boolean') {
    throw new Error(`${label}.quoteExact must be boolean`);
  }
}

function validateDetails(details, label) {
  if (details === undefined) return;
  if (!Array.isArray(details)) throw new Error(`${label} must be an array`);
  details.forEach((detail, index) => {
    const detailLabel = `${label}[${index}]`;
    assertKeys(detail, DETAIL_KEYS, detailLabel);
    assertString(detail.summary, `${detailLabel}.summary`);
    if (detail.group !== undefined) assertString(detail.group, `${detailLabel}.group`);
    if (!Array.isArray(detail.entries) || !detail.entries.length) {
      throw new Error(`${detailLabel}.entries must be a non-empty array`);
    }
    detail.entries.forEach((entry, entryIndex) => {
      const entryLabel = `${detailLabel}.entries[${entryIndex}]`;
      assertKeys(entry, DETAIL_ENTRY_KEYS, entryLabel);
      assertString(entry.label, `${entryLabel}.label`);
      assertString(entry.text, `${entryLabel}.text`, { allowEmpty: true });
    });
  });
}

export function validateDramaticDialogueInterchange(value) {
  assertKeys(value, ROOT_KEYS, 'dialogue');
  if (value.schema !== DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA) {
    throw new Error(`dialogue.schema must be ${DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA}`);
  }
  assertString(value.id, 'dialogue.id');
  assertString(value.label, 'dialogue.label');
  if (!LAYOUTS.has(value.layout)) throw new Error(`dialogue.layout must be one of ${[...LAYOUTS].join(', ')}`);
  validateProvenance(value.provenance, 'dialogue.provenance');

  if (!Array.isArray(value.arms) || !value.arms.length) throw new Error('dialogue.arms must be a non-empty array');
  const armIds = new Set();
  value.arms.forEach((arm, index) => {
    const label = `dialogue.arms[${index}]`;
    assertKeys(arm, ARM_KEYS, label);
    assertString(arm.id, `${label}.id`);
    assertString(arm.label, `${label}.label`);
    if (arm.baseline !== undefined && typeof arm.baseline !== 'boolean') {
      throw new Error(`${label}.baseline must be boolean`);
    }
    if (arm.summary !== undefined) assertString(arm.summary, `${label}.summary`, { allowEmpty: true });
    if (armIds.has(arm.id)) throw new Error(`dialogue arm id ${arm.id} is duplicated`);
    armIds.add(arm.id);
  });
  if (value.layout === 'single' && value.arms.length !== 1) {
    throw new Error('single dialogue layout must declare exactly one arm');
  }

  if (!Array.isArray(value.turns) || !value.turns.length) throw new Error('dialogue.turns must be a non-empty array');
  const turnIds = new Set();
  const messageIds = new Set();
  value.turns.forEach((turn, turnIndex) => {
    const turnLabel = `dialogue.turns[${turnIndex}]`;
    assertKeys(turn, TURN_KEYS, turnLabel);
    assertString(turn.id, `${turnLabel}.id`);
    if (turnIds.has(turn.id)) throw new Error(`dialogue turn id ${turn.id} is duplicated`);
    turnIds.add(turn.id);
    if (!['string', 'number'].includes(typeof turn.turn)) throw new Error(`${turnLabel}.turn must be string or number`);
    if (turn.label !== undefined) assertString(turn.label, `${turnLabel}.label`, { allowEmpty: true });
    if (!Array.isArray(turn.messages)) throw new Error(`${turnLabel}.messages must be an array`);
    if (turn.emptyLanes !== undefined) {
      if (!Array.isArray(turn.emptyLanes)) throw new Error(`${turnLabel}.emptyLanes must be an array`);
      turn.emptyLanes.forEach((empty, index) => {
        const emptyLabel = `${turnLabel}.emptyLanes[${index}]`;
        assertKeys(empty, EMPTY_LANE_KEYS, emptyLabel);
        if (!armIds.has(empty.arm)) throw new Error(`${emptyLabel}.arm must name a declared arm`);
        assertString(empty.label, `${emptyLabel}.label`);
      });
    }

    turn.messages.forEach((message, messageIndex) => {
      const messageLabel = `${turnLabel}.messages[${messageIndex}]`;
      assertKeys(message, MESSAGE_KEYS, messageLabel);
      assertString(message.id, `${messageLabel}.id`);
      if (messageIds.has(message.id)) throw new Error(`dialogue message id ${message.id} is duplicated`);
      messageIds.add(message.id);
      if (!SPEAKERS.has(message.speaker)) throw new Error(`${messageLabel}.speaker must be learner or tutor`);
      if (!['string', 'number'].includes(typeof message.turn)) {
        throw new Error(`${messageLabel}.turn must be string or number`);
      }
      if (String(message.turn) !== String(turn.turn))
        throw new Error(`${messageLabel}.turn must match its parent turn`);
      if (message.arm !== null && !armIds.has(message.arm)) {
        throw new Error(`${messageLabel}.arm must be null or name a declared arm`);
      }
      if (message.arm === null && value.layout !== 'shared-learner') {
        throw new Error(`${messageLabel}.arm may be null only in shared-learner layout`);
      }
      if (message.arm === null && message.speaker !== 'learner') {
        throw new Error(`${messageLabel} may be shared only when speaker is learner`);
      }
      if (value.layout === 'shared-learner' && message.arm !== null && message.speaker !== 'tutor') {
        throw new Error(`${messageLabel} arm-specific messages must be tutor messages in shared-learner layout`);
      }
      assertString(message.text, `${messageLabel}.text`, { allowEmpty: true });
      validateBadge(message.delivery, `${messageLabel}.delivery`);
      validateBadge(message.verdict, `${messageLabel}.verdict`);
      validateBadge(message.ruling, `${messageLabel}.ruling`);
      validateProvenance(message.provenance, `${messageLabel}.provenance`);
      if (message.gloss !== undefined && message.gloss !== null) {
        assertString(message.gloss, `${messageLabel}.gloss`, { allowEmpty: true });
      }
      if (message.labels !== undefined) {
        if (!Array.isArray(message.labels)) throw new Error(`${messageLabel}.labels must be an array`);
        message.labels.forEach((badge, index) => validateBadge(badge, `${messageLabel}.labels[${index}]`));
      }
      validateDetails(message.details, `${messageLabel}.details`);
    });

    if (value.layout === 'shared-learner') {
      const shared = turn.messages.filter((message) => message.arm === null);
      if (shared.length !== 1) throw new Error(`${turnLabel} must contain exactly one shared learner message`);
    }
    for (const empty of turn.emptyLanes || []) {
      if (turn.messages.some((message) => message.arm === empty.arm)) {
        throw new Error(`${turnLabel} cannot mark arm ${empty.arm} empty when it has a message`);
      }
    }
  });
  return value;
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/gu,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}

function tokenize(text) {
  return String(text || '')
    .split(/(\s+)/u)
    .filter((token) => token.length > 0);
}

function normalizeToken(token) {
  return token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function diffTokens(baseText, armText) {
  const base = tokenize(baseText)
    .filter((token) => token.trim().length > 0)
    .map(normalizeToken);
  const arm = tokenize(armText);
  const armWords = arm.map((token, index) => ({ token, index })).filter((entry) => entry.token.trim().length > 0);
  const armKeys = armWords.map((entry) => normalizeToken(entry.token));
  const table = Array.from({ length: base.length + 1 }, () => new Uint32Array(armKeys.length + 1));
  for (let i = base.length - 1; i >= 0; i -= 1) {
    for (let j = armKeys.length - 1; j >= 0; j -= 1) {
      table[i][j] = base[i] === armKeys[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const shared = new Set();
  let i = 0;
  let j = 0;
  while (i < base.length && j < armKeys.length) {
    if (base[i] === armKeys[j]) {
      shared.add(armWords[j].index);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return arm.map((token, index) => ({
    token,
    added: token.trim().length > 0 && !shared.has(index),
  }));
}

function renderSpeech(text, baselineText = null) {
  if (baselineText === null) return escapeHtml(text);
  return diffTokens(baselineText, text)
    .map((entry) =>
      entry.added ? `<mark class="dd__added">${escapeHtml(entry.token)}</mark>` : escapeHtml(entry.token),
    )
    .join('');
}

function badgeTone(badge) {
  if (badge.tone) return badge.tone;
  if (badge.status === 'pass') return 'pass';
  if (['fail', 'blocked'].includes(badge.status)) return 'fail';
  if (['indeterminate', 'unsure'].includes(badge.status)) return 'warning';
  return 'neutral';
}

function renderBadge(badge, fallbackKind) {
  if (!badge) return '';
  const kind = badge.kind || fallbackKind || 'label';
  return `<span class="dd__badge" data-dd-kind="${escapeHtml(kind)}" data-dd-status="${escapeHtml(
    badge.status || 'stated',
  )}" data-dd-group="${escapeHtml(badge.group || 'outcome')}" data-dd-tone="${escapeHtml(
    badgeTone(badge),
  )}"${badge.title ? ` title="${escapeHtml(badge.title)}"` : ''}>${escapeHtml(badge.label)}</span>`;
}

function renderLabelGroups(message) {
  const badges = [
    message.verdict ? { badge: message.verdict, kind: 'verdict' } : null,
    message.ruling ? { badge: message.ruling, kind: 'ruling' } : null,
    ...(message.labels || []).map((badge) => ({ badge, kind: badge.kind || 'label' })),
  ].filter(Boolean);
  if (!badges.length) return '';
  const groups = new Map();
  for (const entry of badges) {
    const group = entry.badge.group || 'outcome';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(renderBadge(entry.badge, entry.kind));
  }
  return [...groups.entries()]
    .map(
      ([group, rendered]) =>
        `<div class="dd__labels" data-dd-label-group="${escapeHtml(group)}">${rendered.join('')}</div>`,
    )
    .join('');
}

function renderDetails(message) {
  return (message.details || [])
    .map(
      (detail) => `<details class="dd__details" data-dd-detail-group="${escapeHtml(detail.group || 'notes')}">
        <summary>${escapeHtml(detail.summary)}</summary>
        ${detail.entries
          .map(
            (entry) =>
              `<p><strong>${escapeHtml(entry.label)}</strong>${entry.text ? ` ${escapeHtml(entry.text)}` : ''}</p>`,
          )
          .join('')}
      </details>`,
    )
    .join('');
}

function provenanceEntries(provenance) {
  if (!provenance) return [];
  return [
    provenance.sourceId ? { label: 'source', text: provenance.sourceId } : null,
    provenance.sourcePath ? { label: 'path', text: provenance.sourcePath } : null,
    provenance.sourceHash ? { label: 'hash', text: provenance.sourceHash } : null,
    provenance.locator ? { label: 'locator', text: provenance.locator } : null,
    provenance.quoteExact !== undefined ? { label: 'quote', text: provenance.quoteExact ? 'exact' : 'abridged' } : null,
    provenance.note ? { label: 'note', text: provenance.note } : null,
  ].filter(Boolean);
}

function renderMessage(
  message,
  armById,
  { baselineText = null, showProvenance = false, includeArmInWho = false } = {},
) {
  const arm = message.arm === null ? null : armById.get(message.arm);
  const armLabel = arm?.label || '';
  const who = includeArmInWho && armLabel ? `${armLabel} · ${message.speaker}` : message.speaker;
  const delivery = message.delivery
    ? `<span class="dd__delivery" data-dd-status="${escapeHtml(message.delivery.status || 'stated')}"${
        message.delivery.title ? ` title="${escapeHtml(message.delivery.title)}"` : ''
      }>${escapeHtml(message.delivery.label)}</span>`
    : '';
  const provenance = showProvenance ? provenanceEntries(message.provenance) : [];
  return `<article class="dd__message dd__message--${escapeHtml(message.speaker)}" data-dd-message-id="${escapeHtml(
    message.id,
  )}" data-dd-speaker="${escapeHtml(message.speaker)}" data-dd-turn="${escapeHtml(message.turn)}" data-dd-arm="${escapeHtml(
    message.arm ?? 'shared',
  )}">
    <header class="dd__message-head"><span class="dd__who">${escapeHtml(who)}</span>${delivery}</header>
    <div class="dd__speech">${message.text ? renderSpeech(message.text, baselineText) : '<em class="dd__empty">no public text</em>'}</div>
    ${renderLabelGroups(message)}
    ${renderDetails(message)}
    ${
      provenance.length
        ? `<details class="dd__details dd__details--provenance"><summary>provenance</summary>${provenance
            .map((entry) => `<p><strong>${escapeHtml(entry.label)}</strong> ${escapeHtml(entry.text)}</p>`)
            .join('')}</details>`
        : ''
    }
    ${message.gloss !== undefined && message.gloss !== null ? `<p class="dd__gloss"><b>Plain language</b><br />${escapeHtml(message.gloss)}</p>` : ''}
  </article>`.replace(/[ \t]+$/gmu, '');
}

function emptyLane(turn, armId) {
  return turn.emptyLanes?.find((entry) => entry.arm === armId)?.label || '—';
}

function renderSingle(dialogue, armById, options) {
  return dialogue.turns
    .map(
      (turn) => `<section class="dd__moment" data-dd-turn="${escapeHtml(turn.turn)}">
        <div class="dd__turn-gutter"><span class="dd__turn-badge">${escapeHtml(turn.label ?? turn.turn)}</span></div>
        <div class="dd__single">${turn.messages
          .map((message) => renderMessage(message, armById, { ...options, includeArmInWho: false }))
          .join('')}</div>
      </section>`,
    )
    .join('');
}

function renderSharedLearner(dialogue, armById, options) {
  return dialogue.turns
    .map((turn) => {
      const shared = turn.messages.find((message) => message.arm === null);
      const baselineMessage = options.diffAgainstArm
        ? turn.messages.find((message) => message.arm === options.diffAgainstArm && message.speaker === 'tutor')
        : null;
      const lanes = dialogue.arms
        .map((arm) => {
          const messages = turn.messages.filter((message) => message.arm === arm.id);
          return `<div class="dd__lane${arm.baseline ? ' dd__lane--baseline' : ''}" data-dd-arm="${escapeHtml(arm.id)}">
            <p class="dd__arm-label">${escapeHtml(arm.label)}</p>
            ${
              messages.length
                ? messages
                    .map((message) =>
                      renderMessage(message, armById, {
                        ...options,
                        includeArmInWho: true,
                        baselineText:
                          baselineMessage && arm.id !== options.diffAgainstArm ? baselineMessage.text : null,
                      }),
                    )
                    .join('')
                : `<p class="dd__empty">${escapeHtml(emptyLane(turn, arm.id))}</p>`
            }
          </div>`;
        })
        .join('');
      return `<section class="dd__moment" data-dd-turn="${escapeHtml(turn.turn)}">
        <div class="dd__turn-gutter"><span class="dd__turn-badge">${escapeHtml(turn.label ?? turn.turn)}</span></div>
        <div class="dd__moment-body">
          <div class="dd__shared">${renderMessage(shared, armById, options)}</div>
          <div class="dd__lanes" style="--dd-lane-count:${dialogue.arms.length}">${lanes}</div>
        </div>
      </section>`;
    })
    .join('');
}

function renderParallel(dialogue, armById, options) {
  const heads = dialogue.arms
    .map(
      (
        arm,
      ) => `<div class="dd__arm-head${arm.baseline ? ' dd__arm-head--baseline' : ''}" data-dd-arm="${escapeHtml(arm.id)}">
        <strong>${escapeHtml(arm.label)}</strong>${arm.summary ? `<span>${escapeHtml(arm.summary)}</span>` : ''}
      </div>`,
    )
    .join('');
  const turns = dialogue.turns
    .map((turn) => {
      const lanes = dialogue.arms
        .map((arm) => {
          const messages = turn.messages.filter((message) => message.arm === arm.id);
          return `<div class="dd__lane${arm.baseline ? ' dd__lane--baseline' : ''}" data-dd-arm="${escapeHtml(arm.id)}">
            <p class="dd__arm-label">${escapeHtml(arm.label)}</p>
            ${
              messages.length
                ? messages
                    .map((message) => renderMessage(message, armById, { ...options, includeArmInWho: false }))
                    .join('')
                : `<p class="dd__empty">${escapeHtml(emptyLane(turn, arm.id))}</p>`
            }
          </div>`;
        })
        .join('');
      return `<section class="dd__moment" data-dd-turn="${escapeHtml(turn.turn)}">
        <div class="dd__turn-gutter"><span class="dd__turn-badge">${escapeHtml(turn.label ?? turn.turn)}</span></div>
        <div class="dd__lanes" style="--dd-lane-count:${dialogue.arms.length}">${lanes}</div>
      </section>`;
    })
    .join('');
  return `${options.showArmHeads ? `<div class="dd__arm-heads" style="--dd-lane-count:${dialogue.arms.length}">${heads}</div>` : ''}${turns}`;
}

export function renderDramaticDialogueFragment(value, options = {}) {
  const dialogue = validateDramaticDialogueInterchange(value);
  const armById = new Map(dialogue.arms.map((arm) => [arm.id, arm]));
  const renderOptions = {
    diffAgainstArm: options.diffAgainstArm || null,
    showProvenance: options.showProvenance === true,
    showArmHeads: options.showArmHeads !== false,
  };
  if (renderOptions.diffAgainstArm && !armById.has(renderOptions.diffAgainstArm)) {
    throw new Error(`diffAgainstArm ${renderOptions.diffAgainstArm} is not declared by the dialogue`);
  }
  const body =
    dialogue.layout === 'single'
      ? renderSingle(dialogue, armById, renderOptions)
      : dialogue.layout === 'shared-learner'
        ? renderSharedLearner(dialogue, armById, renderOptions)
        : renderParallel(dialogue, armById, renderOptions);
  return `<section class="dd dd--${escapeHtml(dialogue.layout)}" data-dd-schema="${DRAMATIC_DIALOGUE_RENDERER_SCHEMA}" data-dd-interchange="${escapeHtml(
    dialogue.schema,
  )}" data-dd-dialogue-id="${escapeHtml(dialogue.id)}" data-dd-layout="${escapeHtml(dialogue.layout)}" aria-label="${escapeHtml(
    dialogue.label,
  )}">${body}</section>`;
}

export function renderDramaticDialogueStyles() {
  return `
  .dd { --dd-border: var(--ms-border, var(--rule, #c8c1b6)); --dd-border-subtle: var(--ms-border-subtle, var(--rule, #ddd6ca)); --dd-surface: var(--ms-surface-elevated, var(--paper, #fff)); --dd-learner: var(--ms-paper-2, var(--paper-2, #f6f1e8)); --dd-text: var(--ms-text, var(--ink, #201c18)); --dd-muted: var(--ms-text-muted, var(--ink-3, #6e665d)); --dd-ink: var(--ms-ink, var(--ink, #201c18)); --dd-white: var(--ms-white, #fff); --dd-ochre: var(--ms-ochre, var(--ochre, #be8a2d)); --dd-moss: var(--ms-moss, var(--moss, #657f5f)); --dd-moss-deep: var(--ms-moss-deep, var(--moss-d, #496c4c)); --dd-red: var(--ms-red, var(--brick, #b14932)); --dd-red-deep: var(--ms-red-dark, var(--brick-d, #8d2f20)); color: var(--dd-text); }
  .dd__arm-heads, .dd__lanes { display: grid; grid-template-columns: repeat(var(--dd-lane-count), minmax(0, 1fr)); gap: 0.85rem; }
  .dd__arm-heads { margin: 0 0 0.85rem 3.5rem; }
  .dd__arm-head { border: 1px solid var(--dd-border); background: var(--dd-surface); padding: 0.7rem 0.85rem; }
  .dd__arm-head strong, .dd__arm-head span { display: block; }
  .dd__arm-head span { margin-top: 0.25rem; color: var(--dd-muted); font: 0.72rem/1.5 var(--ms-font-mono, "Space Mono", monospace); }
  .dd__arm-head--baseline, .dd__lane--baseline .dd__message--tutor { border-left: 3px solid var(--dd-border); }
  .dd__moment { display: grid; grid-template-columns: 2.75rem minmax(0, 1fr); gap: 0.75rem; align-items: start; border-top: 1px solid var(--dd-border-subtle); padding: 0.85rem 0; }
  .dd__turn-gutter { display: flex; justify-content: center; padding-top: 0.2rem; }
  .dd__turn-badge { display: grid; place-items: center; width: 2.1rem; min-height: 2.1rem; box-sizing: border-box; padding: 0.2rem; background: var(--dd-ink); color: var(--dd-white); font: 700 0.72rem/1.1 var(--ms-font-mono, "Space Mono", monospace); text-align: center; }
  .dd__moment-body, .dd__single, .dd__lane { min-width: 0; }
  .dd__shared { margin-bottom: 0.7rem; }
  .dd__shared .dd__message { max-width: 62rem; background: var(--dd-learner); border-left: 3px solid var(--dd-ochre); }
  .dd__lane { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
  .dd__arm-label { display: none; margin: 0; color: var(--dd-muted); font: 700 0.7rem/1.5 var(--ms-font-mono, "Space Mono", monospace); text-transform: uppercase; letter-spacing: 0.06em; }
  .dd__message { min-width: 0; border: 1px solid var(--dd-border); background: var(--dd-surface); padding: 0.75rem 0.85rem; box-sizing: border-box; }
  .dd__message--learner { background: var(--dd-learner); border-left: 3px solid var(--dd-ochre); }
  .dd__message-head { display: flex; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.45rem; color: var(--dd-muted); font: 0.7rem/1.5 var(--ms-font-mono, "Space Mono", monospace); text-transform: uppercase; letter-spacing: 0.05em; }
  .dd__who { color: var(--dd-text); font-weight: 700; }
  .dd__delivery { text-align: right; }
  .dd__speech { font-size: 0.94rem; line-height: 1.62; white-space: pre-wrap; overflow-wrap: anywhere; }
  .dd__empty { color: var(--dd-muted); font-size: 0.84rem; font-style: italic; }
  .dd__labels { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.55rem; }
  .dd__badge { border: 1px solid var(--dd-border); padding: 0 0.38rem; font: 0.68rem/1.75 var(--ms-font-mono, "Space Mono", monospace); text-transform: uppercase; letter-spacing: 0.045em; }
  .dd__badge[data-dd-tone='pass'] { border-color: var(--dd-moss-deep); background: var(--dd-moss); color: var(--dd-white); }
  .dd__badge[data-dd-tone='fail'] { border-color: var(--dd-red-deep); background: var(--dd-red); color: var(--dd-white); }
  .dd__badge[data-dd-tone='warning'] { border-color: var(--dd-ochre); background: var(--dd-ochre); color: #111; }
  .dd__badge[data-dd-tone='muted'] { color: var(--dd-muted); background: transparent; }
  .dd__badge[data-dd-tone='ink'] { border-color: var(--dd-ink); background: var(--dd-ink); color: var(--dd-white); }
  .dd__details { margin-top: 0.45rem; color: var(--dd-muted); }
  .dd__details summary { cursor: pointer; font: 0.68rem/1.7 var(--ms-font-mono, "Space Mono", monospace); text-transform: uppercase; letter-spacing: 0.05em; }
  .dd__details p { margin: 0.35rem 0 0; font-size: 0.8rem; line-height: 1.5; }
  .dd__details strong { color: var(--dd-text); }
  .dd__gloss { margin: 0.65rem 0 0; border-top: 1px solid var(--dd-border-subtle); padding-top: 0.55rem; color: var(--dd-muted); font-size: 0.82rem; line-height: 1.5; }
  .dd__gloss b { color: var(--dd-red-deep); font: 700 0.66rem/1.4 var(--ms-font-mono, "Space Mono", monospace); text-transform: uppercase; letter-spacing: 0.06em; }
  mark.dd__added { background: color-mix(in srgb, var(--dd-red) 18%, transparent); color: inherit; padding: 0 0.05rem; }
  body[data-dd-diff='off'] mark.dd__added { background: transparent; }
  body[data-dd-stack='on'] .dd__lanes, body[data-dd-stack='on'] .dd__arm-heads { grid-template-columns: 1fr; }
  body[data-dd-stack='on'] .dd__arm-label { display: block; }
  @media (max-width: 74rem) {
    .dd--parallel .dd__lanes, .dd--parallel .dd__arm-heads { grid-template-columns: 1fr; }
    .dd--parallel .dd__arm-label { display: block; }
  }
  @media (max-width: 56rem) {
    .dd--shared-learner .dd__lanes { grid-template-columns: 1fr; }
    .dd--shared-learner .dd__arm-label { display: block; }
    .dd__arm-heads { margin-left: 0; }
  }
  @media (max-width: 36rem) {
    .dd__moment { grid-template-columns: 1fr; }
    .dd__turn-gutter { justify-content: flex-start; }
  }
  `;
}
