import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyProposalToState,
  chatMountInfo,
  featuresFromCell,
  normalizeAssistProposal,
  proposalRows,
} from '../public/chat/assist-helpers.js';

describe('chat assist helpers / applyProposalToState', () => {
  it('deep-merges a proposal without clearing unrelated state', () => {
    const next = applyProposalToState(
      {
        features: { approach: 'standard', critic: 'none', learnerModel: 'surface' },
        topic: 'old topic',
        lectureRef: '1001-lecture-1',
        curriculumRef: null,
        director: { mode: 'scene-card', act: 'setup', beat: 'opening', scene: 'desk', note: '' },
        personaId: 'eager_novice',
        mode: 'human',
      },
      {
        features: { approach: 'charismatic', charismaVariant: 'generalist' },
        topic: 'master-slave dialectic',
        personaId: 'struggling_anxious',
        mode: 'auto',
        director: { act: 'complication', beat: 'recognition_press' },
      },
    );

    assert.equal(next.features.approach, 'charismatic');
    assert.equal(next.features.critic, 'none');
    assert.equal(next.topic, 'master-slave dialectic');
    assert.equal(next.lectureRef, '1001-lecture-1');
    assert.equal(next.personaId, 'struggling_anxious');
    assert.equal(next.mode, 'auto');
    assert.equal(next.director.mode, 'scene-card');
    assert.equal(next.director.beat, 'recognition_press');
  });

  it('switches between curriculumRef and lectureRef mutually', () => {
    const next = applyProposalToState(
      { features: {}, lectureRef: '1001-lecture-1', curriculumRef: null, director: {} },
      { curriculumRef: 'module:AF1' },
    );
    assert.equal(next.curriculumRef, 'module:AF1');
    assert.equal(next.lectureRef, null);
  });
});

describe('chat assist helpers / normalizeAssistProposal', () => {
  it('drops invalid fields and keeps valid catalog ids', () => {
    const { proposal, dropped } = normalizeAssistProposal(
      {
        features: { approach: 'charismatic', critic: 'nonsense' },
        curriculumRef: 'module:AF1',
        lectureRef: 'missing',
        personaId: 'struggling_anxious',
        mode: 'observer',
        director: { act: 'recognition', beat: 'bad-beat' },
        action: 'start_scene',
      },
      {
        sceneRefs: ['module:AF1'],
        lectureRefs: ['1001-lecture-1'],
        personaIds: ['struggling_anxious'],
      },
    );

    assert.equal(proposal.features.approach, 'charismatic');
    assert.equal(proposal.curriculumRef, 'module:AF1');
    assert.equal(proposal.personaId, 'struggling_anxious');
    assert.equal(proposal.director.act, 'recognition');
    assert.equal(proposal.action, 'start_scene');
    assert.ok(dropped.includes('features.critic'));
    assert.ok(dropped.includes('lectureRef'));
    assert.ok(dropped.includes('mode'));
    assert.ok(dropped.includes('director.beat'));
  });

  it('renders proposal preview rows', () => {
    const rows = proposalRows({
      features: { approach: 'recognition' },
      topic: 'recognition',
      rationale: { 'features.approach': 'The user asked for Hegel.', topic: 'Use the prompt.' },
    });
    assert.deepEqual(
      rows.map((r) => r.field),
      ['features.approach', 'topic'],
    );
    assert.equal(rows[0].rationale, 'The user asked for Hegel.');
  });
});

describe('chat assist helpers / featuresFromCell', () => {
  it('maps id-director frontier cells to charismatic chips', () => {
    const out = featuresFromCell({
      idDirector: true,
      learnerArchitecture: 'unified',
      charismaProfile: { designPoint: 'charisma-specialist' },
    });

    assert.equal(out.manual, false);
    assert.equal(out.features.approach, 'charismatic');
    assert.equal(out.features.charismaVariant, 'charisma-specialist');
  });

  it('marks recognition dialectical cells lossy because chips cannot encode that pair', () => {
    const out = featuresFromCell({
      promptType: 'dialectical_suspicious',
      recognitionMode: true,
      learnerArchitecture: 'unified',
      superego: { model: 'x' },
    });

    assert.equal(out.manual, true);
    assert.equal(out.features.critic, 'dialectical');
    assert.equal(out.features.stance, 'suspicious');
  });
});

describe('chat assist helpers / chatMountInfo', () => {
  it('uses public API paths for standalone /chat', () => {
    assert.deepEqual(chatMountInfo('/chat/'), {
      apiBase: '/api/chat',
      runLauncherBase: '/admin/runs',
    });
  });

  it('uses root admin API paths for /admin/chat', () => {
    assert.deepEqual(chatMountInfo('/admin/chat/'), {
      apiBase: '/admin/api/chat',
      runLauncherBase: '/admin/runs',
    });
  });

  it('preserves nested app prefixes for poetics admin chat', () => {
    assert.deepEqual(chatMountInfo('/poetics/admin/chat/'), {
      apiBase: '/poetics/admin/api/chat',
      runLauncherBase: '/poetics/admin/runs',
    });
  });
});
