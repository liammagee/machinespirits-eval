import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildOntologyView, ALL_MODULES, DEFAULT_MODULES } from '../services/ontology/ontologyView.js';

// The viewer is a pure, read-only projection of the shared TBox (config/ontology/*.ttl)
// into three lenses. These tests pin the role-faithful invariants the poetics script
// editor relies on: the tutor↔learner asymmetry (only the tutor has an Id and a
// policy/guard decision layer), and that the projection is driven declaratively
// (performedByRole + Tutor*/Learner* class naming), so module scoping changes the
// surface area without any per-module special-casing.

describe('ontologyView — system lens', () => {
  const sys = buildOntologyView({ view: 'system' });

  it('loads the four authored ontologies as a single shared vocabulary', () => {
    assert.equal(sys.view, 'system');
    const ids = sys.ontologies.map((o) => o.id);
    assert.ok(ids.includes('ReasoningRecognitionOntology'), 'reasoning-core ontology present');
    assert.ok(ids.includes('PoeticsDramaturgyOntology'), 'poetics-core ontology present');
    assert.ok(ids.includes('DiscursiveGameOntology'), 'discursive-game ontology present');
  });

  it('reports non-trivial taxonomy counts and a populated class forest', () => {
    assert.ok(sys.counts.classes > 50, `expected many classes, got ${sys.counts.classes}`);
    assert.ok(sys.counts.individuals > 0, 'expected named individuals');
    assert.ok(sys.counts.objectProperties > 0, 'expected object properties');
    assert.ok(Array.isArray(sys.classTree) && sys.classTree.length > 0, 'class tree is a non-empty forest');
  });

  it('surfaces the four role-views symmetrically (tutor + learner × ego + superego)', () => {
    assert.deepEqual(sys.roleViews, ['learner_ego', 'learner_superego', 'tutor_ego', 'tutor_superego']);
  });

  it('exposes the role-projection predicate (performedByRole) among object properties', () => {
    const props = sys.objectProperties.map((p) => p.id);
    assert.ok(props.includes('performedByRole'), 'performedByRole drives the move→role projection');
  });
});

describe('ontologyView — tutor lens', () => {
  const tut = buildOntologyView({ view: 'tutor' });

  it('projects the tutor role and its character', () => {
    assert.equal(tut.view, 'tutor');
    assert.equal(tut.role, 'tutor');
    assert.equal(tut.character?.id, 'TutorCharacter');
    assert.equal(tut.roleClass?.id, 'TutorRole');
  });

  it('gives the tutor an Id (the asymmetric third agency)', () => {
    assert.deepEqual(tut.interiorAgencies, ['Ego', 'Id', 'Superego']);
  });

  it('lists tutor moves via performedByRole and excludes learner-only moves', () => {
    const moves = tut.moves.map((m) => m.id);
    assert.ok(moves.includes('StockTake'), 'StockTake is a tutor move');
    assert.ok(moves.includes('RouteChange'), 'RouteChange is a tutor move');
    assert.ok(!moves.includes('GenuineAnagnorisis'), 'GenuineAnagnorisis is a learner move, not a tutor move');
  });

  it('carries the decision layer: policy actions, the tactic space, and the evidence→policy guards', () => {
    assert.ok(tut.policyActions.length > 0, 'tutor has a PolicyAction repertoire');
    assert.ok(
      tut.tactics.some((t) => t.id === 'DiscursiveTactic'),
      'DiscursiveTactic ⊑ PolicyAction is pulled into the tactic space',
    );
    const affirming = tut.guards.find((g) => g.state === 'AffirmingConsequent');
    assert.ok(affirming, 'AffirmingConsequent is a guard state');
    assert.ok(
      affirming.supportsPolicy.includes('pose_counterexample'),
      'affirming-the-consequent evidence supports posing a counterexample',
    );
    assert.ok(
      affirming.indicatesMissingKC.includes('DistinguishNecessarySufficient'),
      'the guard names the missing knowledge component',
    );
  });

  it('does not expose learner-only state families', () => {
    assert.equal('stateFamilies' in tut, false, 'stateFamilies is a learner-lens-only field');
  });
});

describe('ontologyView — learner lens', () => {
  const lrn = buildOntologyView({ view: 'learner' });

  it('projects the learner role and its character', () => {
    assert.equal(lrn.view, 'learner');
    assert.equal(lrn.role, 'learner');
    assert.equal(lrn.character?.id, 'LearnerCharacter');
    assert.equal(lrn.roleClass?.id, 'LearnerRole');
  });

  it('gives the learner only Ego + Superego (no Id — the tutor↔learner asymmetry)', () => {
    assert.deepEqual(lrn.interiorAgencies, ['Ego', 'Superego']);
  });

  it('lists learner moves via performedByRole and excludes tutor-only moves', () => {
    const moves = lrn.moves.map((m) => m.id);
    assert.ok(moves.includes('GenuineAnagnorisis'), 'GenuineAnagnorisis is a learner move');
    assert.ok(moves.includes('Reframe'), 'Reframe is a learner move');
    assert.ok(!moves.includes('StockTake'), 'StockTake is a tutor move, not a learner move');
  });

  it('exposes the learner state-space, including ReasoningError ⊇ AffirmingConsequent', () => {
    const reasoningError = lrn.stateFamilies.find((f) => f.family === 'ReasoningError');
    assert.ok(reasoningError, 'ReasoningError is a learner state family');
    const members = reasoningError.members.map((m) => m.id);
    assert.ok(members.includes('AffirmingConsequent'), 'AffirmingConsequent is a reasoning error the learner can hold');
    const families = lrn.stateFamilies.map((f) => f.family);
    assert.ok(families.includes('RecognitionState'), 'RecognitionState family present');
    assert.ok(families.includes('KnowledgeComponent'), 'KnowledgeComponent family present');
  });

  it('does not expose tutor-only decision-layer fields', () => {
    assert.equal('policyActions' in lrn, false, 'policyActions is a tutor-lens-only field');
    assert.equal('guards' in lrn, false, 'guards is a tutor-lens-only field');
  });
});

describe('ontologyView — module scoping', () => {
  it('exposes the module manifest with a sane default subset', () => {
    assert.ok(ALL_MODULES.length >= DEFAULT_MODULES.length, 'defaults are a subset of all modules');
    for (const m of DEFAULT_MODULES) assert.ok(ALL_MODULES.includes(m), `default module ${m} is a known module`);
  });

  it('scopes the projection: poetics-only keeps moves but drops the reasoning-core guard table', () => {
    const poeticsOnly = buildOntologyView({ view: 'tutor', modules: ['poetics'] });
    assert.deepEqual(
      poeticsOnly.modules.map((m) => m.name),
      ['poetics'],
      'only the requested module is loaded',
    );
    assert.ok(poeticsOnly.moves.length > 0, 'poetics carries the dramaturgical move repertoire');
    assert.equal(poeticsOnly.guards.length, 0, 'guards live in reasoning-core, so poetics-only yields none');
  });

  it('rejects an unknown module name rather than silently falling back', () => {
    assert.throws(() => buildOntologyView({ view: 'system', modules: ['no-such-module'] }), /Unknown ontology module/);
  });
});
