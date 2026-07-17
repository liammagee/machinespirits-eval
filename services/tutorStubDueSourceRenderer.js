export const TUTOR_STUB_DUE_SOURCE_RENDER_SCHEMA = 'machinespirits.tutor-stub.due-source-render.v1';
export const TUTOR_STUB_DUE_SOURCE_ACTION_REFERENTS_SCHEMA = 'machinespirits.tutor-stub.due-source-action-referents.v1';
export const TUTOR_STUB_DUE_SOURCE_ACTION_ALIGNMENT_SCHEMA = 'machinespirits.tutor-stub.due-source-action-alignment.v1';

const ROLE_ACTION_PATTERN =
  /\b(?:attesting|describing|giving|holding|identifying|opening|presenting|reading|reporting|showing|testifying|unfolding|voicing|witnessing)\b/iu;
const CONTENT_STOP_WORDS = new Set(
  'about after again also and are because before being from had has have into its just more not only other public source than that the their them then there these they this those through under very was were what when where which while with would your'.split(
    ' ',
  ),
);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function humanizeIdentifier(value) {
  return oneLine(value)
    .replace(/([\p{Ll}\d])([\p{Lu}])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function strictSourceSurface(entry, index) {
  const surface = String(entry?.surface || '').trim();
  if (!surface) throw new Error(`due source invalid: missing_surface:${index}`);
  if (/\r|\n/u.test(surface)) throw new Error(`due source invalid: multiline_surface:${index}`);
  return surface;
}

function roleCarrier(entry) {
  const role = oneLine(entry?.role);
  const match = ROLE_ACTION_PATTERN.exec(role);
  if (!match) return null;
  const identity = role
    .slice(0, match.index)
    .trim()
    .replace(/^(?:the|a|an)\s+/iu, '');
  let label = role.slice(match.index + match[0].length).trim();
  if (!label) return null;
  if (/^(?:his|her|their|its)\b/iu.test(label) && identity) {
    label = label.replace(/^(?:his|her|their|its)\b/iu, `${identity.replace(/[’']s$/u, '')}’s`);
  }
  return oneLine(label);
}

function carrierHead(label) {
  const tokens = oneLine(label).match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) || [];
  const head = tokens.at(-1) || '';
  return head.length >= 3 ? head : null;
}

function authoredActionReferents(entry) {
  const authored = entry?.action_referents ?? entry?.presentation?.action_referents;
  const rows =
    authored?.schema === TUTOR_STUB_DUE_SOURCE_ACTION_REFERENTS_SCHEMA
      ? (authored.referents || []).filter((row) => row?.source === 'authored')
      : Array.isArray(authored)
        ? authored
        : authored
          ? [authored]
          : [];
  return rows
    .map((row) => (typeof row === 'string' ? { label: row } : row))
    .map((row) => ({
      kind: oneLine(row?.kind) || 'authored',
      label: oneLine(row?.label || row?.surface || row?.id),
      source: 'authored',
      alignment_required: row?.alignment_required !== false,
    }))
    .filter((row) => row.label);
}

function factActionReferents(entry) {
  const fact = Array.isArray(entry?.fact) ? entry.fact : [];
  const publicSurfaceTokens = contentTokens(entry?.surface);
  return fact
    .slice(1)
    .map((value, index) => {
      const label = humanizeIdentifier(value);
      const labelTokens = contentTokens(label);
      const publicSurfaceValidated =
        labelTokens.size > 0 && [...labelTokens].every((token) => publicSurfaceTokens.has(token));
      return {
        kind: 'fact_argument',
        id: oneLine(value) || null,
        label,
        source: 'typed_fact',
        argument_index: index + 1,
        public_surface_validated: publicSurfaceValidated,
        // Formal fact arguments remain trace provenance. They become optional
        // speaker referents only when every material label token is already in
        // the authored public source surface.
        speaker_eligible: publicSurfaceValidated,
        alignment_required: false,
      };
    })
    .filter((row) => row.label);
}

function dedupeReferents(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = oneLine(row.label).toLowerCase().replace(/[’']/gu, "'");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function compileTutorStubDueSourceActionReferents(entry = null) {
  const authored = authoredActionReferents(entry);
  const carrier = roleCarrier(entry);
  const roleRows = carrier
    ? [
        {
          kind: 'role_carrier',
          label: carrier,
          source: 'authored_role',
          alignment_required: true,
        },
        ...(carrierHead(carrier) && carrierHead(carrier).toLowerCase() !== carrier.toLowerCase()
          ? [
              {
                kind: 'role_carrier_head',
                label: carrierHead(carrier),
                source: 'authored_role',
                alignment_required: false,
              },
            ]
          : []),
      ]
    : [];
  const factReferents = factActionReferents(entry);
  const referents = dedupeReferents([...authored, ...roleRows, ...factReferents.filter((row) => row.speaker_eligible)]);
  const traceOnlyFactReferents = factReferents.filter((row) => !row.speaker_eligible);
  return {
    schema: TUTOR_STUB_DUE_SOURCE_ACTION_REFERENTS_SCHEMA,
    active: referents.length > 0,
    required: referents.some((row) => row.alignment_required),
    primary: referents.find((row) => row.alignment_required) || referents[0] || null,
    referents,
    trace_only_fact_referents: traceOnlyFactReferents,
  };
}

function sourceReportingLead(entry) {
  const role = oneLine(entry?.role).toLowerCase();
  if (/\b(?:book|clerk|inventory|keeper|ledger|log|reading|record)\b/u.test(role)) {
    return { kind: 'record_reading', text: 'I read from the record' };
  }
  if (/\b(?:watch|watchman|witness|account|testif)\b/u.test(role)) {
    return { kind: 'witness_account', text: 'I give this account' };
  }
  if (/\b(?:identifying|knows?|recognis(?:e|ing)|recogniz(?:e|ing))\b/u.test(role)) {
    return { kind: 'identification', text: 'I identify this' };
  }
  if (/\b(?:describing|reporting|showing)\b/u.test(role)) {
    return { kind: 'report', text: 'I report this' };
  }
  if (/\b(?:verdict|voicing)\b/u.test(role)) {
    return { kind: 'verdict', text: 'I state the verdict' };
  }
  return { kind: 'attestation', text: 'I attest' };
}

/**
 * Render one host-owned due source without joining a reporting verb to an
 * authored complete sentence with the complementizer "that". The colon keeps
 * the authored surface byte-for-byte intact, including a deliberate opening
 * connective such as "And".
 */
export function renderTutorStubDueSource(entry = null, index = 0) {
  const surface = strictSourceSurface(entry, index);
  const mode = entry?.mode === 'enacted_role' ? 'enacted_role' : 'presented_exhibit';
  const actionReferents = compileTutorStubDueSourceActionReferents(entry);
  if (mode === 'enacted_role') {
    const reporting = sourceReportingLead(entry);
    return {
      schema: TUTOR_STUB_DUE_SOURCE_RENDER_SCHEMA,
      id: `source_${index + 1}`,
      premise: entry?.premise || null,
      mode,
      surface,
      text: `“${reporting.text}: ${surface}”`,
      reporting: { ...reporting, separator: 'colon', complementizer: null },
      action_referents: actionReferents,
    };
  }
  return {
    schema: TUTOR_STUB_DUE_SOURCE_RENDER_SCHEMA,
    id: `source_${index + 1}`,
    premise: entry?.premise || null,
    mode,
    surface,
    text: surface,
    reporting: null,
    action_referents: actionReferents,
  };
}

export function tutorStubDueSourceActionInstruction(entries = []) {
  const sources = (Array.isArray(entries) ? entries : [entries]).map((entry, index) =>
    entry?.schema === TUTOR_STUB_DUE_SOURCE_RENDER_SCHEMA ? entry : renderTutorStubDueSource(entry, index),
  );
  const required = dedupeReferents(
    sources.flatMap((source) => (source.action_referents?.referents || []).filter((row) => row.alignment_required)),
  );
  // Optional public fact arguments are useful trace provenance, but they do
  // not create an action obligation. Naming one before SOURCE would reveal a
  // clue detail early and make the prompt stricter than the delivery audit.
  const visible = required.slice(0, 4);
  if (!visible.length) return '';
  return `Anchor the due source entrance in its own referent (${visible.map((row) => row.label).join(', ')}); do not substitute an unrelated prop. A declarative part may name that referent without handling it.`;
}

function contentTokens(value) {
  return new Set(
    (
      oneLine(value)
        .toLowerCase()
        .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || []
    )
      .map((token) => token.replace(/[’']/gu, "'").replace(/'s$/u, ''))
      .filter((token) => token.length >= 3 && !CONTENT_STOP_WORDS.has(token)),
  );
}

export function auditTutorStubDueSourceActionAlignment({ text = '', sources = [] } = {}) {
  const responseTokens = contentTokens(text);
  const rows = (Array.isArray(sources) ? sources : [])
    .map((source, index) => {
      const rendered =
        source?.schema === TUTOR_STUB_DUE_SOURCE_RENDER_SCHEMA ? source : renderTutorStubDueSource(source, index);
      const required = (rendered.action_referents?.referents || []).filter((row) => row.alignment_required);
      const accepted = rendered.action_referents?.referents || [];
      const eligibleMatches = required.length ? required : accepted;
      const matches = eligibleMatches.filter((row) => {
        const tokens = contentTokens(row.label);
        return tokens.size > 0 && [...tokens].every((token) => responseTokens.has(token));
      });
      return {
        source: rendered.id,
        active: required.length > 0,
        required: required.map((row) => ({ kind: row.kind, label: row.label })),
        accepted: accepted.map((row) => ({ kind: row.kind, label: row.label })),
        matches: matches.map((row) => ({ kind: row.kind, label: row.label })),
        ok: required.length === 0 || matches.length > 0,
      };
    })
    .filter((row) => row.active);
  const issues = rows
    .filter((row) => !row.ok)
    .map((row) => ({
      type: 'due_source_action_referent_missing',
      source: row.source,
      required: row.required,
      reason: 'the source entrance is not anchored in its authored carrier or typed evidence referent',
    }));
  return {
    schema: TUTOR_STUB_DUE_SOURCE_ACTION_ALIGNMENT_SCHEMA,
    active: rows.length > 0,
    ok: issues.length === 0,
    sources: rows,
    issues,
  };
}
