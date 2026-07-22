import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

import { validateCanonicalCurriculum } from './curriculumCompiler.js';

export const DEFAULT_WORKPLAN_CURRICULUM_STATUSES = Object.freeze(['active', 'review', 'blocked', 'triaged']);

const PRIORITY_ORDER = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });
const STATUS_ORDER = Object.freeze({ active: 0, review: 1, blocked: 2, triaged: 3 });

function parseWorkplanItem(raw, filePath) {
  const match = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) throw new Error(`workplan item ${filePath}: missing YAML frontmatter`);
  const data = yaml.parse(match[1]) || {};
  for (const field of ['id', 'title', 'status', 'verification']) {
    if (!data[field]) throw new Error(`workplan item ${filePath}: missing ${field}`);
  }
  return { data, body: raw.slice(match[0].length).trim(), filePath };
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/[*`]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function clip(value, max = 900) {
  const text = normalizeText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function firstProblemParagraph(body, title) {
  const paragraphs = String(body || '').split(/\n\s*\n/gu);
  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((line) => /^(?:#{1,6}\s|[-*]\s|\d{4}-\d{2}-\d{2}\b)/u.test(line))) continue;
    const text = clip(lines.join(' '));
    if (text && !/^(?:acceptance|scope|tests?|context):?$/iu.test(text)) return text;
  }
  return `The workplan asks the project to reason about ${title}.`;
}

function itemSpecificTasks(body) {
  const tasks = [];
  let current = null;
  const flush = () => {
    if (current) tasks.push(clip(current, 500));
    current = null;
  };
  for (const line of String(body || '').split('\n')) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/u);
    if (bullet) {
      flush();
      current = bullet[1].trim();
      continue;
    }
    if (current && /^\s{2,}\S/u.test(line)) {
      current += ` ${line.trim()}`;
      continue;
    }
    if (current) flush();
    if (tasks.length >= 5) break;
  }
  flush();
  return tasks.filter(Boolean).slice(0, 5);
}

function statusMisconception(item) {
  if (item.status === 'blocked') {
    return `Treating the blocker (${item.blocked_by || 'an unresolved external gate'}) as if discussion alone could remove it.`;
  }
  if (item.status === 'review') {
    return 'Equating implementation completion with verified completion before the declared review evidence passes.';
  }
  if (item.status === 'active') {
    return 'Equating activity, a branch, or a promising intermediate result with satisfying the declared verification gate.';
  }
  return 'Jumping from a triaged idea to implementation before the unresolved decision, dependencies, and evidence standard are explicit.';
}

function stableItemOrder(a, b) {
  const priority = (PRIORITY_ORDER[a.data.priority] ?? 9) - (PRIORITY_ORDER[b.data.priority] ?? 9);
  if (priority) return priority;
  const status = (STATUS_ORDER[a.data.status] ?? 9) - (STATUS_ORDER[b.data.status] ?? 9);
  if (status) return status;
  return a.data.id.localeCompare(b.data.id);
}

function dependencyOrder(items) {
  const byId = new Map(items.map((item) => [item.data.id, item]));
  const incoming = new Map(items.map((item) => [item.data.id, 0]));
  const outgoing = new Map(items.map((item) => [item.data.id, []]));

  for (const item of items) {
    for (const dependency of item.data.depends_on || []) {
      if (!byId.has(dependency)) continue;
      incoming.set(item.data.id, incoming.get(item.data.id) + 1);
      outgoing.get(dependency).push(item.data.id);
    }
  }

  const ready = items.filter((item) => incoming.get(item.data.id) === 0).sort(stableItemOrder);
  const ordered = [];
  while (ready.length) {
    const item = ready.shift();
    ordered.push(item);
    for (const dependentId of outgoing.get(item.data.id)) {
      incoming.set(dependentId, incoming.get(dependentId) - 1);
      if (incoming.get(dependentId) === 0) {
        ready.push(byId.get(dependentId));
        ready.sort(stableItemOrder);
      }
    }
  }
  if (ordered.length !== items.length) {
    const cyclic = items.filter((item) => incoming.get(item.data.id) > 0).map((item) => item.data.id);
    throw new Error(`workplan curriculum dependency cycle: ${cyclic.join(', ')}`);
  }
  return ordered;
}

function moduleForItem(item, sequence) {
  const data = item.data;
  const problem = firstProblemParagraph(item.body, data.title);
  const declaredVerification = clip(data.verification, 1200);
  const dependencies = Array.isArray(data.depends_on) ? data.depends_on : [];
  const specificTasks = itemSpecificTasks(item.body);
  const dependencyStatement = dependencies.length
    ? `Respect the declared prerequisite work: ${dependencies.join(', ')}.`
    : 'Identify whether the card is genuinely independent or merely lacks an explicit dependency.';

  return {
    id: data.id,
    sequence,
    title: data.title,
    essential_question: `What is the real decision in “${data.title},” and what evidence would justify the next move?`,
    main_artifact: `A learner-authored reasoning brief for workplan item ${data.id}`,
    primary_verifier:
      'The brief states the problem, constraints, next action, and declared completion evidence without treating discussion or progress as completion.',
    knowledge_components: [
      { id: `${data.id}-KC01`, statement: `Problem frame: ${problem}` },
      { id: `${data.id}-KC02`, statement: `Declared project completion evidence: ${declaredVerification}` },
      { id: `${data.id}-KC03`, statement: dependencyStatement },
    ],
    canonical_tasks: [
      'Reconstruct the card’s problem and causal stakes from the card and its linked evidence.',
      ...specificTasks,
      'Choose one next action that respects the current status, dependencies, and verification boundary.',
    ],
    verifiers: [
      'The learner can distinguish a useful reasoning brief from actual completion of the workplan item.',
      `The learner explicitly carries forward the card’s completion gate: ${declaredVerification}`,
    ],
    misconception_signatures: [
      statusMisconception(data),
      'Letting the tutor invent missing repository facts instead of naming what must be inspected or tested.',
    ],
    mastery_gate:
      'The learner can state the problem, dependencies, next testable move, and completion evidence in their own words; this does not mark the workplan item done.',
    transfer_challenge:
      'Apply the same reasoning to a related current workplan item and identify which advice transfers and which is specific to this card.',
    workplan_binding: {
      item_id: data.id,
      item_path: `workplan/items/${path.basename(item.filePath)}`,
      status: data.status,
      type: data.type || null,
      priority: data.priority || null,
      owner: data.owner || null,
      branch: data.branch || null,
      blocked_by: data.blocked_by || null,
      depends_on: dependencies,
      declared_completion_verification: declaredVerification,
      links: data.links || {},
      tags: data.tags || [],
      boundary:
        'This module supports reasoning about the card. Tutor dialogue is not evidence that the card is complete.',
    },
  };
}

function sourceHash(items, statuses) {
  const input = {
    statuses: [...statuses],
    items: items.map((item) => ({ data: item.data, body: item.body, file: path.basename(item.filePath) })),
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(input)).digest('hex')}`;
}

export function buildWorkplanCurriculum(options = {}) {
  const itemsDir = path.resolve(options.itemsDir || path.join(process.cwd(), 'workplan', 'items'));
  const statuses = options.statuses || DEFAULT_WORKPLAN_CURRICULUM_STATUSES;
  const selectedStatuses = new Set(statuses);
  const items = fs
    .readdirSync(itemsDir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => {
      const filePath = path.join(itemsDir, name);
      return parseWorkplanItem(fs.readFileSync(filePath, 'utf8'), filePath);
    })
    .filter((item) => selectedStatuses.has(item.data.status));

  if (!items.length) throw new Error(`no workplan items selected for statuses: ${statuses.join(', ')}`);
  const ordered = dependencyOrder(items);
  const selectedIds = new Set(ordered.map((item) => item.data.id));
  const curriculum = {
    schema_version: 'ms-curriculum-v0.1',
    id: 'machinespirits_workplan_v1',
    version: '1.0.0',
    title: 'Machine Spirits Workplan as Reflective Curriculum',
    discipline: 'tutor-design-research',
    audience: 'Machine Spirits contributors reasoning through current tutor research and implementation work',
    delivery: 'Interactive tutor CLI, one workplan card at a time',
    source: {
      format: 'workplan-items',
      path: 'workplan/items',
      statuses: [...statuses],
      source_hash: sourceHash(ordered, statuses),
    },
    standard_profile: {
      spine: '1EdTech CASE 1.1 inspired',
      note: 'Workplan cards are projected as reflective inquiry modules; card completion remains governed by the workplan verifier.',
      extensions: [
        'ms:evidence',
        'ms:verifier',
        'ms:misconception',
        'ms:drama_binding',
        'ms:world_adaptation',
        'ms:workplan_binding',
      ],
    },
    modules: ordered.map((item, index) => moduleForItem(item, index + 1)),
    associations: ordered.flatMap((item) =>
      (item.data.depends_on || [])
        .filter((dependency) => selectedIds.has(dependency))
        .map((dependency) => ({ from: dependency, to: item.data.id, relation: 'prerequisite_of' })),
    ),
    projection_boundary:
      'This curriculum tests and improves reasoning about current project work. It cannot verify its own advice or mark a workplan card complete.',
  };
  validateCanonicalCurriculum(curriculum, 'live workplan projection');
  return curriculum;
}
