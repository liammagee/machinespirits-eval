const tutorMountIndex = window.location.pathname.indexOf('/tutor');
const APP_PREFIX = tutorMountIndex > 0 ? window.location.pathname.slice(0, tutorMountIndex) : '';
const API = `${APP_PREFIX}/api/tutor-stub`;
let chatApiBase = `${APP_PREFIX}/api/chat`;
const SESSION_KEY = 'machinespirits.tutor.active-session.v1';

const FEATURE_OPTIONS = {
  approach: ['standard', 'polished', 'recognition', 'placebo', 'minimalist', 'charismatic'],
  critic: ['none', 'pedagogical', 'dialectical', 'divergent', 'hardwired'],
  stance: ['suspicious', 'adversary', 'advocate'],
  learnerModel: ['surface', 'reflective'],
  charismaVariant: ['generalist', 'v22-specialist', 'charisma-specialist'],
};
const DIRECTOR_OPTIONS = {
  mode: ['off', 'card', 'strict'],
  act: ['setup', 'complication', 'peripeteia', 'recognition', 'catharsis'],
  beat: ['opening', 'stock_take', 'route_change', 'action_gate', 'recognition_press', 'closure'],
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  status: $('#app-status'),
  setupPanel: $('#setup-panel'),
  setupForm: $('#setup-form'),
  safeMode: $('#safe-mode'),
  researchMode: $('#research-mode'),
  safeSetup: $('#safe-setup'),
  researchSetup: $('#research-setup'),
  start: $('#start-button'),
  refresh: $('#refresh-button'),
  lab: $('#lab-select'),
  labHelp: $('#lab-help'),
  world: $('#world-select'),
  tutor: $('#tutor-select'),
  model: $('#model-select'),
  resume: $('#resume-input'),
  assistantInput: $('#assistant-input'),
  assistantLive: $('#assistant-live'),
  assistantButton: $('#assistant-button'),
  assistantResult: $('#assistant-result'),
  researchApproach: $('#research-approach'),
  researchCritic: $('#research-critic'),
  researchStance: $('#research-stance'),
  researchLearnerModel: $('#research-learner-model'),
  researchCharisma: $('#research-charisma'),
  resolveCell: $('#resolve-cell-button'),
  researchCell: $('#research-cell'),
  researchCellHelp: $('#research-cell-help'),
  researchTopic: $('#research-topic'),
  researchCurriculum: $('#research-curriculum'),
  researchPersona: $('#research-persona'),
  directorMode: $('#director-mode'),
  directorAct: $('#director-act'),
  directorBeat: $('#director-beat'),
  directorScene: $('#director-scene'),
  directorNote: $('#director-note'),
  sessions: $('#session-select'),
  reconnect: $('#reconnect-button'),
  sessionPanel: $('#session-panel'),
  sessionTitle: $('#session-title'),
  sessionKicker: $('#session-kicker'),
  sessionMeta: $('#session-meta'),
  transcript: $('#transcript'),
  messageForm: $('#message-form'),
  message: $('#message-input'),
  send: $('#send-button'),
  stop: $('#stop-button'),
  reset: $('#reset-button'),
  export: $('#export-button'),
  researchPanel: $('#research-panel'),
  researchSummary: $('#research-summary'),
  researchTurns: $('#research-turns'),
  refreshResearch: $('#refresh-research-button'),
  exportResearch: $('#export-research-button'),
  end: $('#end-button'),
  messageTemplate: $('#message-template'),
  micConsent: $('#mic-consent'),
  enableMic: $('#enable-mic-button'),
  talk: $('#talk-button'),
  micStatus: $('#mic-status'),
  caption: $('#caption-text'),
  theme: $('#theme-button'),
};

const state = {
  catalog: null,
  researchCatalog: null,
  researchTrace: null,
  surfaceMode: 'safe',
  researchLoading: null,
  session: null,
  publicMessages: [],
  request: null,
  recognition: null,
  micEnabled: false,
  listening: false,
};

function setStatus(message, tone = 'normal') {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function safeText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

async function api(path = '', options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = payload?.error?.code || 'http_error';
    throw error;
  }
  return payload;
}

async function chatApi(path = '', options = {}) {
  let response = await fetch(`${chatApiBase}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (response.status === 404 && typeof payload?.adminPath === 'string') {
    const suffix = path.split('?')[0];
    chatApiBase = payload.adminPath.endsWith(suffix) ? payload.adminPath.slice(0, -suffix.length) : chatApiBase;
    response = await fetch(`${chatApiBase}${path}`, {
      ...options,
      headers: {
        accept: 'application/json',
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const error = new Error(
      payload?.error?.message || payload?.error || `Research request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

function option(select, value, label, metadata = {}) {
  const row = document.createElement('option');
  row.value = value;
  row.textContent = label;
  for (const [key, nested] of Object.entries(metadata)) row.dataset[key] = String(nested);
  select.append(row);
  return row;
}

function replaceOptions(select) {
  while (select.firstChild) select.firstChild.remove();
}

function fallbackCatalog() {
  return {
    defaults: {
      lab: 'pure_chat',
      world: 'none',
      tutor: 'dramatic-detective@v1',
      model: 'codex.gpt-5.6-terra',
    },
    labs: [
      {
        id: 'pure_chat',
        title: 'Pure chat',
        summary: 'A learner-safe text conversation with one speaking-model call per turn.',
        audience: 'learner_safe',
        maturity: 'stable',
        costClass: 'metered',
        launch: { engine: 'tutor_stub', mode: 'passthrough', available: true, requiresWorld: false },
      },
      {
        id: 'human_scaffold',
        title: 'Human scaffold',
        summary: 'A learner-safe dramatic inquiry with public evidence tracking.',
        audience: 'learner_safe',
        maturity: 'stable',
        costClass: 'metered',
        launch: { engine: 'tutor_stub', mode: 'scaffold', available: true, requiresWorld: true },
      },
    ],
    worlds: [{ id: 'none', title: 'Open topic (no authored world)' }],
    tutors: [{ id: 'dramatic-detective', ref: 'dramatic-detective@v1', title: 'Dramatic detective' }],
    models: [{ ref: 'codex.gpt-5.6-terra', label: 'Codex · GPT-5.6 Terra' }],
  };
}

function projectedCatalog(payload) {
  return payload?.catalog || payload || fallbackCatalog();
}

function renderCatalog(catalog) {
  state.catalog = catalog;
  replaceOptions(elements.lab);
  const labs = (catalog.labs || []).filter((lab) => lab.audience === 'learner_safe');
  for (const lab of labs) {
    const row = option(
      elements.lab,
      lab.id,
      `${lab.title || lab.label || lab.id} · ${lab.costClass || 'declared cost'}`,
      {
        engine: lab.launch?.engine || 'tutor_stub',
        mode: lab.launch?.mode || 'direct',
        requiresWorld: Boolean(lab.launch?.requiresWorld),
      },
    );
    if (lab.launch?.available === false) row.disabled = true;
  }
  if (!labs.length) {
    option(elements.lab, 'pure_chat', 'Pure chat', {
      engine: 'tutor_stub',
      mode: 'passthrough',
      requiresWorld: false,
    });
  }
  const defaultLab = catalog.defaults?.lab;
  if (defaultLab && [...elements.lab.options].some((row) => row.value === defaultLab && !row.disabled)) {
    elements.lab.value = defaultLab;
  }

  replaceOptions(elements.world);
  option(elements.world, 'none', 'Open topic (no authored world)');
  for (const world of catalog.worlds || []) {
    if (world.id === 'none') continue;
    option(elements.world, world.id, world.title ? `${world.title} · ${world.id}` : world.id);
  }
  const defaultWorld = catalog.defaults?.world;
  if (defaultWorld && [...elements.world.options].some((row) => row.value === defaultWorld)) {
    elements.world.value = defaultWorld;
  }

  replaceOptions(elements.tutor);
  for (const tutor of catalog.tutors || []) option(elements.tutor, tutor.ref || tutor.id, tutor.title || tutor.id);
  if (!elements.tutor.options.length) option(elements.tutor, 'dramatic-detective@v1', 'Dramatic detective');
  if (catalog.defaults?.tutor && [...elements.tutor.options].some((row) => row.value === catalog.defaults.tutor)) {
    elements.tutor.value = catalog.defaults.tutor;
  }

  replaceOptions(elements.model);
  for (const model of catalog.models || []) option(elements.model, model.ref, model.label || model.ref);
  if (!elements.model.options.length) option(elements.model, 'codex.gpt-5.6-terra', 'Codex · GPT-5.6 Terra');
  if (catalog.defaults?.model && [...elements.model.options].some((row) => row.value === catalog.defaults.model)) {
    elements.model.value = catalog.defaults.model;
  }
  elements.start.disabled = ![...elements.lab.options].some((row) => !row.disabled);
  updateLabHelp();
}

function humanize(value) {
  return String(value || '')
    .replace(/[_-]+/gu, ' ')
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function populateNamedOptions(select, values, selected) {
  replaceOptions(select);
  for (const value of values) option(select, value, humanize(value));
  if (selected && [...select.options].some((row) => row.value === selected)) select.value = selected;
}

function initializeResearchControls() {
  populateNamedOptions(elements.researchApproach, FEATURE_OPTIONS.approach, 'standard');
  populateNamedOptions(elements.researchCritic, FEATURE_OPTIONS.critic, 'none');
  populateNamedOptions(elements.researchStance, FEATURE_OPTIONS.stance, 'suspicious');
  populateNamedOptions(elements.researchLearnerModel, FEATURE_OPTIONS.learnerModel, 'surface');
  populateNamedOptions(elements.researchCharisma, FEATURE_OPTIONS.charismaVariant, 'generalist');
  populateNamedOptions(elements.directorMode, DIRECTOR_OPTIONS.mode, 'off');
  populateNamedOptions(elements.directorAct, DIRECTOR_OPTIONS.act, 'setup');
  populateNamedOptions(elements.directorBeat, DIRECTOR_OPTIONS.beat, 'opening');
  syncResearchFeatureVisibility();
}

function syncResearchFeatureVisibility() {
  const critic = elements.researchCritic.value;
  elements.researchStance.disabled = critic !== 'dialectical' && critic !== 'divergent';
  elements.researchCharisma.disabled = elements.researchApproach.value !== 'charismatic';
}

function selectedResearchFeatures() {
  return {
    approach: elements.researchApproach.value,
    critic: elements.researchCritic.value,
    stance: elements.researchStance.value,
    learnerModel: elements.researchLearnerModel.value,
    charismaVariant: elements.researchCharisma.value,
  };
}

function renderResearchCatalog({ cellsPayload, curriculaPayload, personasPayload, assistHealth }) {
  const cells = (cellsPayload?.cells || []).filter(
    (cell) => /^cell_\d/u.test(cell.name) && cell.ego && cell.runner !== 'adaptive',
  );
  state.researchCatalog = {
    cells,
    curricula: curriculaPayload || {},
    personas: personasPayload?.personas || [],
    assistHealth: assistHealth || null,
  };

  replaceOptions(elements.researchCell);
  for (const cell of cells) {
    const architecture = [
      cell.promptType || 'base',
      cell.superego ? 'ego + superego' : 'ego only',
      cell.learnerArchitecture || 'unified learner',
    ].join(' · ');
    option(elements.researchCell, cell.name, `${cell.name} · ${architecture}`);
  }

  replaceOptions(elements.researchCurriculum);
  option(elements.researchCurriculum, '', 'No authored source');
  for (const pkg of curriculaPayload?.packages || []) {
    for (const course of pkg.courses || []) {
      for (const lecture of course.lectures || []) {
        option(
          elements.researchCurriculum,
          lecture.ref,
          `${pkg.label || pkg.id} · ${course.title || course.id} · ${lecture.title || lecture.ref}`,
          { sourceType: 'lecture' },
        );
      }
    }
  }
  for (const source of curriculaPayload?.sceneSources || []) {
    option(elements.researchCurriculum, source.ref, `${humanize(source.kind)} · ${source.label || source.ref}`, {
      sourceType: 'curriculum',
    });
  }

  replaceOptions(elements.researchPersona);
  option(elements.researchPersona, '', 'No persona annotation');
  for (const persona of personasPayload?.personas || []) {
    option(
      elements.researchPersona,
      persona.id,
      `${persona.name || humanize(persona.id)}${persona.hint ? ` · ${persona.hint}` : ''}`,
    );
  }

  const assistantMode = assistHealth?.ok
    ? `Live assistant available via ${assistHealth.provider || 'configured provider'} (${assistHealth.model}).`
    : 'Deterministic preview is available; no live assistant provider is configured.';
  elements.assistantResult.textContent = assistantMode;
  elements.start.disabled =
    state.surfaceMode === 'research' ? cells.length === 0 : ![...elements.lab.options].some((row) => !row.disabled);
  void resolveResearchCell({ announce: false });
}

async function loadResearchCatalogs() {
  if (state.researchCatalog) return state.researchCatalog;
  if (state.researchLoading) return state.researchLoading;
  setStatus('Loading administrator research catalogues…');
  state.researchLoading = Promise.all([
    chatApi('/cells'),
    chatApi('/curricula'),
    chatApi('/personas'),
    chatApi('/assist/health'),
  ])
    .then(([cellsPayload, curriculaPayload, personasPayload, assistHealth]) => {
      renderResearchCatalog({ cellsPayload, curriculaPayload, personasPayload, assistHealth });
      if (state.surfaceMode === 'research') {
        setStatus('Research mode ready. Choose or resolve an eval cell explicitly.');
      }
      return state.researchCatalog;
    })
    .catch((error) => {
      if (state.surfaceMode === 'research') elements.start.disabled = true;
      elements.researchCellHelp.textContent =
        error.status === 401 || error.status === 403
          ? 'Administrator credentials are required to load research controls.'
          : `Research catalogues could not be loaded: ${error.message}`;
      if (state.surfaceMode === 'research') {
        setStatus(`Research mode is unavailable: ${error.message}`, 'error');
      }
      throw error;
    })
    .finally(() => {
      state.researchLoading = null;
    });
  return state.researchLoading;
}

async function resolveResearchCell({ announce = true } = {}) {
  if (!state.researchCatalog) return;
  elements.resolveCell.disabled = true;
  try {
    const resolved = await chatApi('/resolve', {
      method: 'POST',
      body: JSON.stringify(selectedResearchFeatures()),
    });
    const cell = resolved.resolved;
    if (!cell?.name) throw new Error('The resolver returned no cell');
    if (![...elements.researchCell.options].some((row) => row.value === cell.name)) {
      throw new Error(`${cell.name} is not compatible with the cell_lab session adapter`);
    }
    elements.researchCell.value = cell.name;
    const relaxed = (cell.matches || []).filter((match) => !match.match).map((match) => match.dimension);
    elements.researchCellHelp.textContent = `${resolved.matchQuality} match · ${cell.name} · score ${cell.score}/${resolved.maxScore}${
      relaxed.length ? ` · relaxed ${relaxed.join(', ')}` : ''
    }`;
    if (announce) setStatus(`Resolved ${cell.name} as the closest research cell.`);
  } catch (error) {
    elements.researchCellHelp.textContent = `Cell resolution failed: ${error.message}`;
    if (announce) setStatus(`Cell resolution failed: ${error.message}`, 'error');
  } finally {
    elements.resolveCell.disabled = false;
  }
}

function applyAssistantProposal(proposal = {}) {
  const features = proposal.features || {};
  const featureElements = {
    approach: elements.researchApproach,
    critic: elements.researchCritic,
    stance: elements.researchStance,
    learnerModel: elements.researchLearnerModel,
    charismaVariant: elements.researchCharisma,
  };
  for (const [key, value] of Object.entries(features)) {
    const select = featureElements[key];
    if (select && [...select.options].some((row) => row.value === value)) select.value = value;
  }
  if (typeof proposal.topic === 'string') elements.researchTopic.value = proposal.topic;
  if (typeof proposal.personaId === 'string') elements.researchPersona.value = proposal.personaId;
  const sourceRef = proposal.curriculumRef || proposal.lectureRef;
  if (sourceRef && [...elements.researchCurriculum.options].some((row) => row.value === sourceRef)) {
    elements.researchCurriculum.value = sourceRef;
  }
  for (const [key, value] of Object.entries(proposal.director || {})) {
    const target = {
      mode: elements.directorMode,
      act: elements.directorAct,
      beat: elements.directorBeat,
      scene: elements.directorScene,
      note: elements.directorNote,
    }[key];
    if (target) target.value = value;
  }
  syncResearchFeatureVisibility();
}

async function draftResearchConfiguration() {
  const request = elements.assistantInput.value.trim();
  if (!request) {
    elements.assistantInput.focus();
    return;
  }
  elements.assistantButton.disabled = true;
  elements.assistantResult.textContent = 'Drafting a configuration proposal…';
  try {
    const payload = await chatApi('/assist', {
      method: 'POST',
      body: JSON.stringify({
        dryRun: !elements.assistantLive.checked,
        ...(elements.assistantLive.checked ? { confirmModelCallLimit: 2 } : {}),
        messages: [{ role: 'user', content: request }],
        currentConfig: {
          features: selectedResearchFeatures(),
          topic: elements.researchTopic.value.trim(),
          personaId: elements.researchPersona.value || null,
          mode: 'human',
        },
      }),
    });
    applyAssistantProposal(payload.proposal || {});
    await resolveResearchCell({ announce: false });
    elements.assistantResult.textContent = `${payload.message || 'Proposal applied.'}${
      payload.resolved?.name ? ` Resolved ${payload.resolved.name}.` : ''
    }`;
    setStatus('Configuration assistant proposal applied; review every field before starting.');
  } catch (error) {
    elements.assistantResult.textContent = `Assistant failed: ${error.message}`;
    setStatus(`Configuration assistant failed: ${error.message}`, 'error');
  } finally {
    elements.assistantButton.disabled = false;
  }
}

function syncSurfaceMode() {
  const research = elements.researchMode.checked;
  state.surfaceMode = research ? 'research' : 'safe';
  elements.safeSetup.hidden = research;
  elements.researchSetup.hidden = !research;
  elements.start.textContent = research ? 'Start research cell' : 'Start session';
  elements.researchCell.required = research;
  if (research) {
    elements.start.disabled = !state.researchCatalog;
    void loadResearchCatalogs().catch(() => {});
  } else {
    elements.start.disabled = ![...elements.lab.options].some((row) => !row.disabled);
    setStatus('Ready. Safe labs are resolved by the local server.');
  }
}

async function refreshAllCatalogs() {
  await refreshCatalogAndSessions();
  if (state.surfaceMode !== 'research') return;
  state.researchCatalog = null;
  await loadResearchCatalogs().catch(() => {});
}

function updateLabHelp() {
  const lab = (state.catalog?.labs || []).find((candidate) => candidate.id === elements.lab.value);
  if (!lab) return;
  const audience = safeText(lab.audience, 'declared audience').replace('_', ' ');
  const maturity = safeText(lab.maturity || lab.maturityTier, 'versioned');
  const cost = safeText(lab.costClass, 'declared cost');
  const launch = lab.launch || {};
  const none = [...elements.world.options].find((row) => row.value === 'none');
  if (none) none.disabled = Boolean(launch.requiresWorld);
  elements.world.required = Boolean(launch.requiresWorld);
  if (launch.requiresWorld && elements.world.value === 'none') {
    const preferred = state.catalog?.defaults?.world;
    const next =
      [...elements.world.options].find((row) => row.value === preferred && !row.disabled) ||
      [...elements.world.options].find((row) => !row.disabled);
    if (next) elements.world.value = next.value;
  } else if (!launch.requiresWorld) {
    elements.world.value = 'none';
  }
  const availability =
    launch.available === false
      ? ` Unavailable here: ${launch.unavailableReason || 'missing browser transport support'}`
      : '';
  elements.labHelp.textContent = `${lab.summary || lab.description || lab.title || lab.id} Audience: ${audience}; maturity: ${maturity}; cost: ${cost}.${availability}`;
}

function sessionId(snapshot = state.session) {
  return snapshot?.sessionId || snapshot?.id || null;
}

function rememberSession(id) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage is optional; the active in-memory session still works.
  }
}

function existingMessages(snapshot) {
  const value = snapshot?.state || {};
  const candidates = [value.publicMessages, value.publicHistory, value.messages, value.history];
  const source = candidates.find((candidate) => Array.isArray(candidate)) || [];
  return source
    .map((entry) => {
      const rawRole = entry.role || entry.agent || entry.speaker;
      const role =
        rawRole === 'assistant' || rawRole === 'tutor' ? 'tutor' : rawRole === 'system' ? 'system' : 'learner';
      const text = entry.content || entry.text || entry.message;
      return typeof text === 'string' && text.trim() ? { role, text: text.trim() } : null;
    })
    .filter(Boolean);
}

function isResearchSession(snapshot = state.session) {
  return snapshot?.state?.engine === 'cell_lab' || snapshot?.capabilitySnapshot?.mode === 'cell_lab';
}

function appendDefinition(list, term, value) {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value == null || value === '' ? '—' : String(value);
  list.append(dt, dd);
}

function renderResearchTrace(trace) {
  state.researchTrace = trace;
  elements.researchSummary.replaceChildren();
  appendDefinition(elements.researchSummary, 'Cell', trace?.cell?.name);
  appendDefinition(elements.researchSummary, 'Configuration hash', trace?.configHash);
  appendDefinition(elements.researchSummary, 'Prompt family', trace?.cell?.architecture?.promptType);
  appendDefinition(
    elements.researchSummary,
    'Architecture',
    trace?.cell?.architecture?.hasSuperego ? 'ego + superego' : 'ego only',
  );
  appendDefinition(elements.researchSummary, 'Topic', trace?.source?.topic);
  appendDefinition(
    elements.researchSummary,
    'Curriculum',
    trace?.source?.curriculum?.sourceRef || trace?.source?.curriculumRef,
  );
  appendDefinition(elements.researchSummary, 'Persona annotation', trace?.source?.personaId);
  appendDefinition(elements.researchSummary, 'Input tokens', trace?.totals?.inputTokens ?? 0);
  appendDefinition(elements.researchSummary, 'Output tokens', trace?.totals?.outputTokens ?? 0);
  appendDefinition(elements.researchSummary, 'Latency', `${trace?.totals?.latencyMs ?? 0} ms`);

  elements.researchTurns.replaceChildren();
  const turns = trace?.turns || [];
  if (!turns.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No research turns yet. The inspector will update after each tutor response.';
    elements.researchTurns.append(empty);
    return;
  }

  for (const turn of turns) {
    const card = document.createElement('article');
    card.className = 'research-turn';
    const heading = document.createElement('h3');
    heading.textContent = `Turn ${turn.turn}`;
    const learner = document.createElement('p');
    learner.className = 'research-learner-input';
    learner.textContent = `Learner: ${turn.learnerMessage || '—'}`;
    card.append(heading, learner);
    for (const entry of turn.deliberation || []) {
      const detail = document.createElement('details');
      detail.className = 'deliberation-entry';
      if (turn === turns[turns.length - 1]) detail.open = true;
      const summary = document.createElement('summary');
      summary.textContent = entry.label || humanize(entry.role || 'deliberation');
      const meta = document.createElement('p');
      meta.className = 'deliberation-meta';
      meta.textContent = [
        entry.provider,
        entry.model,
        Number.isFinite(entry.inputTokens) ? `${entry.inputTokens} in` : null,
        Number.isFinite(entry.outputTokens) ? `${entry.outputTokens} out` : null,
        Number.isFinite(entry.latencyMs) ? `${entry.latencyMs} ms` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      const content = document.createElement('pre');
      content.textContent = safeText(entry.content, 'No recorded content.');
      detail.append(summary, meta, content);
      card.append(detail);
    }
    elements.researchTurns.append(card);
  }
}

async function refreshResearchTrace({ quiet = false } = {}) {
  const id = sessionId();
  if (!id || state.surfaceMode !== 'research' || !isResearchSession()) {
    state.researchTrace = null;
    elements.researchPanel.hidden = true;
    return null;
  }
  elements.researchPanel.hidden = false;
  if (!quiet) setStatus('Refreshing the private research projection…');
  try {
    const payload = await api(`/sessions/${encodeURIComponent(id)}/research`);
    if (sessionId() !== id) return null;
    renderResearchTrace(payload.research);
    if (!quiet) setStatus('Private deliberation inspector refreshed.');
    return payload.research;
  } catch (error) {
    if (sessionId() !== id) return null;
    const empty = document.createElement('p');
    empty.textContent = `Research projection unavailable: ${error.message}`;
    elements.researchTurns.replaceChildren(empty);
    if (!quiet) setStatus(`Research projection unavailable: ${error.message}`, 'error');
    return null;
  }
}

function addMessage(role, text, { record = true, placeholder = false } = {}) {
  const normalized = safeText(text).trim();
  if (!normalized) return;
  if (!placeholder) elements.transcript.querySelector('[data-placeholder="true"]')?.remove();
  if (record) {
    state.publicMessages.push({ role, text: normalized });
  }
  const item = elements.messageTemplate.content.firstElementChild.cloneNode(true);
  item.dataset.role = role;
  if (placeholder) item.dataset.placeholder = 'true';
  item.querySelector('.message-role').textContent = role === 'learner' ? 'You' : role === 'tutor' ? 'Tutor' : 'Session';
  item.querySelector('.message-text').textContent = normalized;
  elements.transcript.append(item);
  item.scrollIntoView({ block: 'nearest' });
}

function renderMessages(messages) {
  state.publicMessages = [];
  elements.transcript.replaceChildren();
  for (const message of messages) addMessage(message.role, message.text);
  if (!messages.length) {
    addMessage('system', 'Session ready. Write a message to begin; text remains available even if voice is off.', {
      record: false,
      placeholder: true,
    });
  }
}

function updateSession(snapshot, { replaceTranscript = false } = {}) {
  state.session = snapshot;
  const id = sessionId(snapshot);
  if (!id) return;
  rememberSession(id);
  elements.setupPanel.hidden = true;
  elements.sessionPanel.hidden = false;
  elements.sessionTitle.textContent = snapshot?.state?.worldTitle || snapshot?.state?.topic || 'Tutor session';
  elements.sessionKicker.textContent = `${snapshot.status || 'active'} session`;
  const mode = snapshot?.capabilitySnapshot?.mode || snapshot?.state?.mode || 'tutor';
  const revision = Number.isFinite(snapshot?.revision) ? `revision ${snapshot.revision}` : 'versioned runtime';
  elements.sessionMeta.textContent = `${id} · ${mode} · ${revision}`;
  const messages = existingMessages(snapshot);
  if (replaceTranscript || (messages.length && messages.length !== state.publicMessages.length))
    renderMessages(messages);
  elements.message.disabled = snapshot.status === 'finalized';
  elements.send.disabled = snapshot.status === 'finalized';
  if (state.surfaceMode === 'research' && isResearchSession(snapshot)) {
    elements.researchPanel.hidden = false;
    void refreshResearchTrace({ quiet: true });
  } else {
    state.researchTrace = null;
    elements.researchPanel.hidden = true;
  }
}

async function refreshCatalogAndSessions() {
  setStatus('Refreshing safe labs and active sessions…');
  const [catalogResult, sessionResult] = await Promise.allSettled([api('/catalog'), api('/sessions')]);
  if (catalogResult.status === 'fulfilled') renderCatalog(projectedCatalog(catalogResult.value));
  else renderCatalog(fallbackCatalog());

  replaceOptions(elements.sessions);
  const sessions = sessionResult.status === 'fulfilled' ? sessionResult.value.sessions || [] : [];
  option(elements.sessions, '', sessions.length ? 'Choose a session' : 'No active sessions');
  for (const session of sessions) {
    const id = sessionId(session);
    if (id) option(elements.sessions, id, `${id} · ${session.status || 'active'}`);
  }
  elements.reconnect.disabled = sessions.length === 0;
  setStatus(
    catalogResult.status === 'fulfilled'
      ? 'Ready. Safe labs are resolved by the local server.'
      : 'Catalogue metadata is unavailable; the learner-safe fallback remains usable.',
    catalogResult.status === 'fulfilled' ? 'normal' : 'error',
  );
}

async function startSession(event) {
  event.preventDefault();
  elements.start.disabled = true;
  setStatus('Starting the tutor process…');
  let body;
  if (state.surfaceMode === 'research') {
    const selectedSource = elements.researchCurriculum.selectedOptions[0];
    const sourceRef = selectedSource?.value || '';
    body = {
      engine: 'cell_lab',
      mode: 'cell_lab',
      cell: elements.researchCell.value,
      topic: elements.researchTopic.value.trim() || 'general conversation',
      director: {
        mode: elements.directorMode.value,
        act: elements.directorAct.value,
        beat: elements.directorBeat.value,
        scene: elements.directorScene.value.trim(),
        note: elements.directorNote.value.trim(),
      },
    };
    if (sourceRef) {
      if (selectedSource.dataset.sourceType === 'lecture') body.lectureRef = sourceRef;
      else body.curriculumRef = sourceRef;
    }
    if (elements.researchPersona.value) body.personaId = elements.researchPersona.value;
  } else {
    const mode = elements.lab.selectedOptions[0]?.dataset.mode || 'direct';
    const engine = elements.lab.selectedOptions[0]?.dataset.engine || 'tutor_stub';
    body = {
      engine,
      lab: elements.lab.value,
      mode,
      model: elements.model.value,
      tutor: elements.tutor.value,
      world: elements.world.value || 'none',
    };
    if (elements.resume.value.trim()) body.resume = elements.resume.value.trim();
  }
  try {
    const payload = await api('/sessions', { method: 'POST', body: JSON.stringify(body) });
    updateSession(payload.session, { replaceTranscript: true });
    setStatus(
      state.surfaceMode === 'research'
        ? 'Research cell started. Public dialogue and the private inspector are ready.'
        : 'Session started. Public text is ready.',
    );
    elements.message.focus();
  } catch (error) {
    setStatus(`Could not start the session: ${error.message}`, 'error');
  } finally {
    elements.start.disabled = false;
  }
}

async function reconnect(id = elements.sessions.value) {
  if (!id) return;
  setStatus(`Reconnecting to ${id}…`);
  try {
    const payload = await api(`/sessions/${encodeURIComponent(id)}`);
    updateSession(payload.session, { replaceTranscript: true });
    setStatus('Session reconnected from its public projection.');
    elements.message.focus();
  } catch (error) {
    setStatus(`Could not reconnect: ${error.message}`, 'error');
  }
}

async function canonicalSession(payload, id) {
  if (sessionId(payload?.session) === id) return payload.session;
  const latest = await api(`/sessions/${encodeURIComponent(id)}`);
  if (sessionId(latest?.session) !== id) throw new Error('Server did not return the canonical session projection');
  return latest.session;
}

async function sendMessage(event) {
  event.preventDefault();
  const input = elements.message.value.trim();
  const id = sessionId();
  if (!input || !id || state.request) return;
  // This row is deliberately visual-only. The server's public projection is
  // the export authority, and replaces the transcript when the step commits.
  addMessage('learner', input, { record: false });
  elements.message.value = '';
  elements.message.disabled = true;
  elements.send.disabled = true;
  elements.stop.disabled = false;
  const controller = new AbortController();
  state.request = controller;
  setStatus('Tutor is composing a response. Stop remains available.');
  try {
    const payload = await api(`/sessions/${encodeURIComponent(id)}/steps`, {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({ input, kind: 'learner', context: { source: 'tutor_web', awaitCompletion: true } }),
    });
    // Never merge client guesses with process output. A successful mutation
    // returns the canonical public session projection, so replace even when
    // its message count happens to match the optimistic transcript.
    updateSession(await canonicalSession(payload, id), { replaceTranscript: true });
    setStatus('Tutor response complete.');
  } catch (error) {
    // A confirmed Stop/End can clear this session before the aborted fetch
    // rejects. Do not let that stale request redraw or relabel a newer view.
    if (sessionId() !== id) return;
    if (error.name === 'AbortError') {
      addMessage(
        'system',
        'The wait was cancelled. If you chose Stop session, the local tutor process is being closed.',
        { record: false },
      );
      setStatus('Tutor wait cancelled.');
    } else {
      addMessage('system', `The response failed: ${error.message}. Text input remains available.`, {
        record: false,
      });
      setStatus(`Tutor response failed: ${error.message}`, 'error');
    }
  } finally {
    if (state.request === controller) state.request = null;
    if (sessionId() === id) {
      elements.message.disabled = false;
      elements.send.disabled = false;
      elements.stop.disabled = true;
      elements.message.focus();
    }
  }
}

async function stopResponse() {
  const id = sessionId();
  state.request?.abort();
  if (!id) return;
  elements.stop.disabled = true;
  setStatus('Stopping the local tutor process…');
  try {
    await api(`/sessions/${encodeURIComponent(id)}/interrupt`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'tutor_web_interrupt' }),
    });
    clearActiveSession();
    await refreshCatalogAndSessions();
    setStatus('Session stopped. You can start or explicitly resume another safe lab.');
  } catch (error) {
    if (sessionId() !== id) return;
    addMessage(
      'system',
      `Stop was not confirmed: ${error.message}. This session remains active here; retry Stop or End session.`,
      { record: false },
    );
    setStatus(`Stop was not confirmed; the session remains active: ${error.message}`, 'error');
  }
}

async function resetSession() {
  const id = sessionId();
  if (!id) return;
  setStatus('Resetting the public dialogue…');
  try {
    const payload = await api(`/sessions/${encodeURIComponent(id)}/reset`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'learner_requested_reset' }),
    });
    updateSession(payload.session, { replaceTranscript: true });
    setStatus('Dialogue reset. The same lab and session controls remain active.');
  } catch (error) {
    setStatus(`Reset failed: ${error.message}`, 'error');
  }
}

function exportPublicTrace() {
  const id = sessionId();
  if (!id) return;
  const artifact = {
    schema: 'machinespirits.tutor-stub.public-session-export.v1',
    exportedAt: new Date().toISOString(),
    session: state.session,
    publicMessages: state.publicMessages,
    privacy: { rawAudioIncluded: false, credentialsIncluded: false, privateModelTraceIncluded: false },
  };
  const blob = new Blob([`${JSON.stringify(artifact, null, 2)}\n`], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `${id}-public-session.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  setStatus('Public session trace exported. It contains no raw audio or credentials.');
}

async function exportResearchTrace() {
  const id = sessionId();
  if (!id || state.surfaceMode !== 'research' || !isResearchSession()) return;
  const trace = state.researchTrace || (await refreshResearchTrace({ quiet: true }));
  if (!trace) {
    setStatus('Research trace is unavailable and was not exported.', 'error');
    return;
  }
  const artifact = {
    schema: 'machinespirits.cell-lab.research-export.v1',
    exportedAt: new Date().toISOString(),
    warning: 'Administrator research artifact: may contain private deliberation and model configuration.',
    research: trace,
  };
  const blob = new Blob([`${JSON.stringify(artifact, null, 2)}\n`], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `${id}-research-trace.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  setStatus('Private research trace exported separately from the public session artifact.');
}

async function endSession() {
  const id = sessionId();
  if (!id) return;
  state.request?.abort();
  setStatus('Ending the session…');
  try {
    await api(`/sessions/${encodeURIComponent(id)}/finalize`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'tutor_web_end' }),
    });
    clearActiveSession();
    await refreshCatalogAndSessions();
    setStatus('Session ended. You can start another safe lab.');
  } catch (error) {
    if (sessionId() !== id) return;
    addMessage(
      'system',
      `End was not confirmed: ${error.message}. This session remains active here; retry End session or use Stop.`,
      { record: false },
    );
    setStatus(`End was not confirmed; the session remains active: ${error.message}`, 'error');
  }
}

function clearActiveSession() {
  rememberSession(null);
  state.session = null;
  state.researchTrace = null;
  state.publicMessages = [];
  elements.transcript.replaceChildren();
  elements.researchSummary.replaceChildren();
  elements.researchTurns.replaceChildren();
  elements.researchPanel.hidden = true;
  elements.sessionPanel.hidden = true;
  elements.setupPanel.hidden = false;
}

function setupVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    elements.enableMic.disabled = true;
    elements.talk.disabled = true;
    elements.micStatus.textContent = 'Speech recognition is unavailable in this browser. Text input is ready.';
    return;
  }
  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = document.documentElement.lang || 'en';
  recognition.onstart = () => {
    state.listening = true;
    elements.talk.textContent = 'Listening — release to stop';
    elements.micStatus.textContent =
      'Microphone listening. Speech is becoming editable text; nothing sends automatically.';
  };
  recognition.onresult = (event) => {
    let interim = '';
    let finalText = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const text = event.results[index][0]?.transcript || '';
      if (event.results[index].isFinal) finalText += text;
      else interim += text;
    }
    elements.caption.textContent = finalText || interim || 'Listening…';
    if (finalText.trim()) {
      elements.message.value = [elements.message.value.trim(), finalText.trim()].filter(Boolean).join(' ');
      elements.message.focus();
    }
  };
  recognition.onerror = (event) => {
    state.listening = false;
    elements.talk.textContent = 'Hold to talk';
    elements.micStatus.textContent = `Microphone transcription stopped (${event.error || 'browser error'}). Text input is ready.`;
  };
  recognition.onend = () => {
    state.listening = false;
    elements.talk.textContent = 'Hold to talk';
    elements.micStatus.textContent = state.micEnabled
      ? 'Microphone enabled and idle. Hold the button to transcribe; review before sending.'
      : 'Microphone off. Text input is ready.';
  };
  state.recognition = recognition;
}

function enableMicrophone() {
  if (!elements.micConsent.checked) {
    elements.micStatus.textContent = 'Check the consent box before the browser asks for microphone access.';
    elements.micConsent.focus();
    return;
  }
  if (!state.recognition) return;
  state.micEnabled = true;
  elements.talk.disabled = false;
  elements.enableMic.textContent = 'Voice input armed';
  elements.enableMic.disabled = true;
  elements.micStatus.textContent = 'Microphone enabled and idle. Hold the button to transcribe; review before sending.';
}

function syncMicrophoneConsent() {
  if (elements.micConsent.checked) {
    elements.enableMic.disabled = !state.recognition || state.micEnabled;
    elements.micStatus.textContent = state.micEnabled
      ? 'Microphone enabled and idle. Hold the button to transcribe; review before sending.'
      : 'Consent recorded in this page. Enable voice input, then hold the talk button to request microphone access.';
    return;
  }
  stopListening();
  state.micEnabled = false;
  elements.talk.disabled = true;
  elements.enableMic.disabled = true;
  elements.enableMic.textContent = 'Enable voice input';
  elements.micStatus.textContent = 'Microphone off. Text input is ready.';
}

function startListening(event) {
  event.preventDefault();
  if (!state.micEnabled || state.listening) return;
  state.listening = true;
  try {
    state.recognition.start();
  } catch {
    state.listening = false;
    // Browsers throw if start is called twice; the visible state remains authoritative.
  }
}

function stopListening(event) {
  event?.preventDefault?.();
  if (!state.listening) return;
  try {
    state.recognition.stop();
  } catch {
    // The recognition object may already be stopping.
  }
}

function setupTheme() {
  let theme = 'system';
  try {
    theme = localStorage.getItem('machinespirits.theme') || 'system';
  } catch {
    // System theme is the safe fallback.
  }
  const apply = () => {
    document.documentElement.dataset.theme = theme === 'system' ? '' : theme;
    elements.theme.textContent = `Theme: ${theme}`;
    elements.theme.setAttribute('aria-pressed', String(theme !== 'system'));
  };
  elements.theme.addEventListener('click', () => {
    theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    try {
      localStorage.setItem('machinespirits.theme', theme);
    } catch {
      // Persistence is optional.
    }
    apply();
  });
  apply();
}

elements.setupForm.addEventListener('submit', startSession);
elements.messageForm.addEventListener('submit', sendMessage);
elements.message.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) elements.messageForm.requestSubmit();
});
elements.refresh.addEventListener('click', refreshAllCatalogs);
elements.lab.addEventListener('change', updateLabHelp);
elements.safeMode.addEventListener('change', syncSurfaceMode);
elements.researchMode.addEventListener('change', syncSurfaceMode);
elements.researchApproach.addEventListener('change', syncResearchFeatureVisibility);
elements.researchCritic.addEventListener('change', syncResearchFeatureVisibility);
elements.resolveCell.addEventListener('click', () => resolveResearchCell());
elements.assistantButton.addEventListener('click', draftResearchConfiguration);
elements.sessions.addEventListener('change', () => {
  elements.reconnect.disabled = !elements.sessions.value;
});
elements.reconnect.addEventListener('click', () => reconnect());
elements.stop.addEventListener('click', stopResponse);
elements.reset.addEventListener('click', resetSession);
elements.export.addEventListener('click', exportPublicTrace);
elements.refreshResearch.addEventListener('click', () => refreshResearchTrace());
elements.exportResearch.addEventListener('click', exportResearchTrace);
elements.end.addEventListener('click', endSession);
elements.enableMic.addEventListener('click', enableMicrophone);
elements.micConsent.addEventListener('change', syncMicrophoneConsent);
elements.talk.addEventListener('pointerdown', startListening);
for (const event of ['pointerup', 'pointercancel', 'pointerleave', 'blur'])
  elements.talk.addEventListener(event, stopListening);
elements.talk.addEventListener('keydown', (event) => {
  if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) startListening(event);
});
elements.talk.addEventListener('keyup', (event) => {
  if (event.key === 'Enter' || event.key === ' ') stopListening(event);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    stopListening(event);
    if (state.request) stopResponse();
  }
});
window.addEventListener('beforeunload', () => {
  state.request?.abort();
  stopListening();
});

setupTheme();
setupVoice();
initializeResearchControls();
if (new URLSearchParams(window.location.search).get('mode') === 'research') {
  elements.researchMode.checked = true;
  elements.safeMode.checked = false;
}
await refreshCatalogAndSessions();
syncSurfaceMode();
let remembered = null;
try {
  remembered = localStorage.getItem(SESSION_KEY);
} catch {
  remembered = null;
}
if (remembered) await reconnect(remembered);
