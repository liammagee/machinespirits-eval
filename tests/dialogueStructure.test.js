/**
 * Dialogue Structural Integrity & Multi-Agent Logic Tests
 *
 * Validates trace-level invariants against real dialogue log files:
 *   1. Learner-request → tutor-response pairing
 *   2. Multi-agent tutor deliberation sequence
 *   3. Multi-agent learner deliberation sequence
 *   4. Cross-architecture consistency (all cells in tutor-agents.yaml)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { resolveConfigModels } from '../services/evaluationRunner.js';
import { loadTutorAgents } from '../services/evalConfigLoader.js';

// ── Log discovery ──────────────────────────────────────────────────────

const LOGS_DIR = path.resolve('logs/tutor-dialogues');

function discoverLogs() {
  if (!fs.existsSync(LOGS_DIR)) return [];
  return fs.readdirSync(LOGS_DIR)
    .filter(f => f.endsWith('.json') &&
      !f.includes('e2e-test') &&
      !f.includes('debug') &&
      !f.includes('demo'))
    .sort()
    .slice(-30);
}

function loadLog(filename) {
  return JSON.parse(fs.readFileSync(path.join(LOGS_DIR, filename), 'utf-8'));
}

// ── Trace helpers ──────────────────────────────────────────────────────

/** Known non-agent system entries that can appear in traces. */
const SYSTEM_AGENTS = new Set(['system']);

/** True if this entry is a learner-side entry (any learner agent label). */
function isLearnerEntry(entry) {
  return entry.agent === 'learner' ||
    entry.agent.startsWith('learner_');
}

/** True if this entry is a tutor-side entry (tutor, ego, superego). */
function isTutorEntry(entry) {
  return entry.agent === 'tutor' || entry.agent === 'ego' || entry.agent === 'superego';
}

/**
 * Segment a flat dialogueTrace into alternating tutor/learner blocks.
 * Each block is { type: 'tutor'|'learner'|'system', entries: [...] }.
 * Consecutive entries of the same side are grouped together.
 */
function segmentTrace(trace) {
  const segments = [];
  let current = null;

  for (const entry of trace) {
    let type;
    if (SYSTEM_AGENTS.has(entry.agent)) type = 'system';
    else if (isLearnerEntry(entry)) type = 'learner';
    else type = 'tutor';

    if (!current || current.type !== type) {
      if (current) segments.push(current);
      current = { type, entries: [entry] };
    } else {
      current.entries.push(entry);
    }
  }
  if (current) segments.push(current);
  return segments;
}

/**
 * Filter out system segments and merge adjacent same-type segments that were
 * split by interleaved system entries (e.g. system/memory_cycle between
 * ego/revise and tutor/final_output).
 */
function getNonSystemSegments(trace) {
  const raw = segmentTrace(trace).filter(s => s.type !== 'system');
  const merged = [];
  for (const seg of raw) {
    if (merged.length > 0 && merged[merged.length - 1].type === seg.type) {
      merged[merged.length - 1].entries.push(...seg.entries);
    } else {
      merged.push({ type: seg.type, entries: [...seg.entries] });
    }
  }
  return merged;
}

// ── Tests ──────────────────────────────────────────────────────────────

const logFiles = discoverLogs();
const multiTurnLogs = [];
const singleTurnLogs = [];

// Pre-classify logs
for (const f of logFiles) {
  try {
    const d = loadLog(f);
    if (d.isMultiTurn && d.totalTurns > 1) multiTurnLogs.push({ file: f, data: d });
    else singleTurnLogs.push({ file: f, data: d });
  } catch { /* skip unparseable */ }
}


// ═══════════════════════════════════════════════════════════════════════
// Group 1: Learner-Request → Tutor-Response Pairing
// ═══════════════════════════════════════════════════════════════════════

describe('Group 1: learner-request → tutor-response pairing', { skip: multiTurnLogs.length === 0 && 'no multi-turn logs on disk' }, () => {
  for (const { file, data } of multiTurnLogs) {
    describe(`[${file}]`, () => {
      it('trace starts with tutor-side entries (Turn 0 has no preceding learner)', () => {
        const trace = data.dialogueTrace || [];
        assert.ok(trace.length > 0, 'trace should be non-empty');
        const first = trace[0];
        assert.ok(isTutorEntry(first),
          `first trace entry should be tutor-side, got ${first.agent}/${first.action}`);
      });

      it('tutor blocks and learner blocks alternate after Turn 0', () => {
        const segments = getNonSystemSegments(data.dialogueTrace || []);

        // First segment must be tutor (Turn 0)
        assert.strictEqual(segments[0]?.type, 'tutor', 'first segment should be tutor');

        // After the first tutor segment, check alternation
        for (let i = 1; i < segments.length; i++) {
          const prev = segments[i - 1].type;
          const curr = segments[i].type;
          assert.notStrictEqual(prev, curr,
            `segments ${i - 1} and ${i} are both '${curr}' — expected alternation`);
        }
      });

      it('every learner block is eventually followed by a tutor block', () => {
        const segments = getNonSystemSegments(data.dialogueTrace || []);

        for (let i = 0; i < segments.length; i++) {
          if (segments[i].type === 'learner') {
            // Either followed by a tutor block, or it's the very last segment (final learner turn)
            const nextNonSystem = segments[i + 1];
            if (nextNonSystem) {
              assert.strictEqual(nextNonSystem.type, 'tutor',
                `learner block at index ${i} not followed by tutor block`);
            }
            // If it IS the last segment, that's the final learner message — acceptable
          }
        }
      });

      it('conversationHistory entries have both suggestion and learnerMessage', () => {
        const history = data.conversationHistory;
        if (!history || history.length === 0) return; // single-turn has no history

        for (let i = 0; i < history.length; i++) {
          const h = history[i];
          assert.ok(h.suggestion?.message,
            `conversationHistory[${i}] (turn ${h.turnIndex}) missing suggestion.message`);
          assert.ok(h.learnerMessage != null,
            `conversationHistory[${i}] (turn ${h.turnIndex}) missing learnerMessage`);
        }
      });

      it('conversationHistory length equals totalTurns or totalTurns - 1', () => {
        const history = data.conversationHistory;
        if (!history) return;
        // New behaviour: initial learner message is included, so length === totalTurns.
        // Legacy logs may still have length === totalTurns - 1 (initial message absent).
        const validLengths = [data.totalTurns, data.totalTurns - 1];
        assert.ok(validLengths.includes(history.length),
          `expected ${data.totalTurns} or ${data.totalTurns - 1} history entries, got ${history.length}`);
      });

      it('conversationHistory turnIndex values are monotonically non-decreasing', () => {
        const history = data.conversationHistory;
        if (!history || history.length === 0) return;
        // turnIndex values must be non-negative and monotonically non-decreasing.
        // Duplicates are allowed (e.g. when the initial learner message shares a
        // turnIndex with the first tutor response entry).
        for (let i = 0; i < history.length; i++) {
          assert.ok(history[i].turnIndex >= 0,
            `conversationHistory[${i}].turnIndex should be >= 0, got ${history[i].turnIndex}`);
          if (i > 0) {
            assert.ok(history[i].turnIndex >= history[i - 1].turnIndex,
              `conversationHistory[${i}].turnIndex (${history[i].turnIndex}) should be >= previous (${history[i - 1].turnIndex})`);
          }
        }
      });
    });
  }
});


// ═══════════════════════════════════════════════════════════════════════
// Group 2: Multi-Agent Tutor Deliberation Logic
// ═══════════════════════════════════════════════════════════════════════

describe('Group 2: multi-agent tutor deliberation', { skip: logFiles.length === 0 && 'no logs on disk' }, () => {
  for (const { file, data } of [...multiTurnLogs, ...singleTurnLogs]) {
    const trace = data.dialogueTrace || [];
    const hasSuperego = trace.some(e => e.agent === 'superego');

    describe(`[${file}] (superego: ${hasSuperego})`, () => {
      if (hasSuperego) {
        it('ego/generate appears before first superego/review in each tutor block', () => {
          const segments = getNonSystemSegments(trace).filter(s => s.type === 'tutor');
          for (let si = 0; si < segments.length; si++) {
            const entries = segments[si].entries;
            const egoIdx = entries.findIndex(e => e.agent === 'ego' && e.action === 'generate');
            const supIdx = entries.findIndex(e => e.agent === 'superego' && e.action === 'review');
            if (supIdx !== -1) {
              assert.ok(egoIdx !== -1,
                `tutor block ${si}: superego/review found but no ego/generate`);
              assert.ok(egoIdx < supIdx,
                `tutor block ${si}: ego/generate (${egoIdx}) should precede superego/review (${supIdx})`);
            }
          }
        });

        it('at least one superego/review exists per tutor block that has deliberation', () => {
          const segments = getNonSystemSegments(trace).filter(s => s.type === 'tutor');
          // At least one tutor block should have a superego entry
          const blocksWithSuperego = segments.filter(s =>
            s.entries.some(e => e.agent === 'superego'));
          assert.ok(blocksWithSuperego.length > 0,
            'at least one tutor block should contain superego/review');
        });
      } else {
        it('no superego entries in trace (single-agent tutor)', () => {
          const superegoEntries = trace.filter(e => e.agent === 'superego');
          assert.strictEqual(superegoEntries.length, 0,
            `expected 0 superego entries, found ${superegoEntries.length}`);
        });
      }

      it('every tutor block starts with tutor/context_input or ego/generate', () => {
        const segments = getNonSystemSegments(trace).filter(s => s.type === 'tutor');
        for (let si = 0; si < segments.length; si++) {
          const first = segments[si].entries[0];
          const validStart = (first.agent === 'tutor' && first.action === 'context_input') ||
            (first.agent === 'ego' && first.action === 'generate');
          assert.ok(validStart,
            `tutor block ${si} starts with ${first.agent}/${first.action}, expected tutor/context_input or ego/generate`);
        }
      });
    });
  }
});


// ═══════════════════════════════════════════════════════════════════════
// Group 3: Multi-Agent Learner Deliberation Logic
// ═══════════════════════════════════════════════════════════════════════

describe('Group 3: multi-agent learner deliberation', { skip: multiTurnLogs.length === 0 && 'no multi-turn logs on disk' }, () => {
  for (const { file, data } of multiTurnLogs) {
    const trace = data.dialogueTrace || [];
    const hasEgoSuperegoLearner = trace.some(e => e.agent === 'learner_ego_initial');
    const learnerArch = data.learnerArchitecture || '';

    describe(`[${file}] (learnerArch: ${learnerArch})`, () => {
      if (hasEgoSuperegoLearner) {
        it('learnerArchitecture contains "ego_superego"', () => {
          assert.ok(learnerArch.includes('ego_superego'),
            `trace has learner_ego_initial entries but learnerArchitecture is "${learnerArch}"`);
        });

        it('each learner block follows the 4-entry deliberation sequence', () => {
          const segments = segmentTrace(trace).filter(s => s.type === 'learner');
          const expectedSequence = [
            'learner_ego_initial/deliberation',
            'learner_superego/deliberation',
            'learner_ego_revision/deliberation',
            'learner/final_output',
          ];

          for (let si = 0; si < segments.length; si++) {
            const entries = segments[si].entries;
            assert.strictEqual(entries.length, 4,
              `learner block ${si} has ${entries.length} entries, expected 4`);

            for (let j = 0; j < 4; j++) {
              const actual = `${entries[j].agent}/${entries[j].action}`;
              assert.strictEqual(actual, expectedSequence[j],
                `learner block ${si} entry ${j}: expected ${expectedSequence[j]}, got ${actual}`);
            }
          }
        });

        it('learner turnIndex is consistent within each learner block', () => {
          const segments = segmentTrace(trace).filter(s => s.type === 'learner');
          for (let si = 0; si < segments.length; si++) {
            const turnIndices = segments[si].entries
              .map(e => e.turnIndex)
              .filter(t => t !== undefined);
            const unique = [...new Set(turnIndices)];
            assert.ok(unique.length <= 1,
              `learner block ${si} has mixed turnIndex values: ${JSON.stringify(unique)}`);
          }
        });
      } else {
        // Unified learners have two valid trace patterns:
        // - YAML-scripted (single-prompt, or pre-fix messages): 1 entry (learner/turn_action)
        // - LLM single-agent (messages-mode post-fix): 2 entries (learner_*/deliberation + learner/final_output)
        const hasLLMLearnerEntries = trace.some(e => e.agent.startsWith('learner_') && e.agent !== 'learner');

        if (hasLLMLearnerEntries) {
          it('unified learner (LLM): each learner block has deliberation + final_output', () => {
            const segments = segmentTrace(trace).filter(s => s.type === 'learner');
            for (let si = 0; si < segments.length; si++) {
              const entries = segments[si].entries;
              assert.strictEqual(entries.length, 2,
                `unified learner block ${si} has ${entries.length} entries, expected 2`);
              assert.ok(entries[0].agent.startsWith('learner_'),
                `entry 0 agent should start with learner_, got ${entries[0].agent}`);
              assert.strictEqual(entries[0].action, 'deliberation',
                `entry 0 should be deliberation, got ${entries[0].action}`);
              assert.strictEqual(entries[1].agent, 'learner');
              assert.strictEqual(entries[1].action, 'final_output',
                `entry 1 should be learner/final_output, got ${entries[1].agent}/${entries[1].action}`);
            }
          });
        } else {
          it('unified learner (scripted): each learner block is a single learner/turn_action', () => {
            const segments = segmentTrace(trace).filter(s => s.type === 'learner');
            for (let si = 0; si < segments.length; si++) {
              const entries = segments[si].entries;
              assert.strictEqual(entries.length, 1,
                `unified learner block ${si} has ${entries.length} entries, expected 1`);
              assert.strictEqual(entries[0].agent, 'learner');
              assert.strictEqual(entries[0].action, 'turn_action',
                `expected learner/turn_action, got ${entries[0].agent}/${entries[0].action}`);
            }
          });
        }

        it('no ego_superego learner entries in trace', () => {
          const egoEntries = trace.filter(e =>
            e.agent === 'learner_ego_initial' ||
            e.agent === 'learner_superego' ||
            e.agent === 'learner_ego_revision');
          assert.strictEqual(egoEntries.length, 0,
            `expected 0 learner deliberation entries, found ${egoEntries.length}`);
        });
      }
    });
  }
});


// ═══════════════════════════════════════════════════════════════════════
// Group 4: Cross-Architecture Consistency (all cells)
// ═══════════════════════════════════════════════════════════════════════

describe('Group 4: cross-architecture consistency (all tutor-agents.yaml cells)', () => {
  let allProfiles;

  before(() => {
    const data = loadTutorAgents({ forceReload: true });
    assert.ok(data?.profiles, 'tutor-agents.yaml should have profiles');
    allProfiles = data.profiles;
  });

  it('every cell with multi_agent_tutor:true resolves superegoModel non-null', () => {
    for (const [name, profile] of Object.entries(allProfiles)) {
      if (profile.factors?.multi_agent_tutor !== true) continue;
      const resolved = resolveConfigModels({ profileName: name });
      // Only expect superegoModel if the profile actually configures a superego block
      if (profile.superego) {
        assert.ok(resolved.superegoModel,
          `${name}: multi_agent_tutor=true with superego configured, but superegoModel is null`);
      }
    }
  });

  it('every cell with multi_agent_tutor:false resolves superegoModel to null', () => {
    for (const [name, profile] of Object.entries(allProfiles)) {
      if (profile.factors?.multi_agent_tutor !== false) continue;
      const resolved = resolveConfigModels({ profileName: name });
      assert.strictEqual(resolved.superegoModel, null,
        `${name}: multi_agent_tutor=false but superegoModel is non-null`);
    }
  });

  it('ego_superego learner_architecture implies multi_agent_learner:true', () => {
    for (const [name, profile] of Object.entries(allProfiles)) {
      if (!profile.learner_architecture?.includes('ego_superego')) continue;
      assert.strictEqual(profile.factors?.multi_agent_learner, true,
        `${name}: learner_architecture="${profile.learner_architecture}" but multi_agent_learner is not true`);
    }
  });

  it('unified learner_architecture implies multi_agent_learner:false', () => {
    for (const [name, profile] of Object.entries(allProfiles)) {
      if (!profile.learner_architecture) continue;
      if (profile.learner_architecture.includes('ego_superego')) continue;
      if (!profile.learner_architecture.includes('unified')) continue;
      assert.strictEqual(profile.factors?.multi_agent_learner, false,
        `${name}: learner_architecture="${profile.learner_architecture}" but multi_agent_learner is not false`);
    }
  });

  it('every cell resolves egoModel', () => {
    for (const name of Object.keys(allProfiles)) {
      const resolved = resolveConfigModels({ profileName: name });
      assert.ok(resolved.egoModel,
        `${name}: egoModel should resolve`);
    }
  });

  it('cells with superego configured resolve superegoModel as {provider, model}', () => {
    for (const [name, profile] of Object.entries(allProfiles)) {
      if (!profile.superego) continue;
      if (profile.factors?.multi_agent_tutor === false) continue; // multi_agent_tutor:false forces null
      const resolved = resolveConfigModels({ profileName: name });
      assert.strictEqual(typeof resolved.superegoModel, 'object',
        `${name}: superegoModel should be an object`);
      assert.ok(resolved.superegoModel.provider,
        `${name}: superegoModel.provider should be set`);
      assert.ok(resolved.superegoModel.model,
        `${name}: superegoModel.model should be set`);
    }
  });
});
