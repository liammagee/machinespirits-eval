import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { buildConversationContext, buildPublicStateLedger } from '../learnerTutorInteractionEngine.js';

// Slice 7: validated state-ledger context mode. The ledger is derived ONLY from
// public turns; it carries early learner commitments forward and never leaks
// hidden provenance.
const HISTORY = [
  { role: 'learner', content: 'I claim 98% accuracy means the model is production-ready.' },
  { role: 'tutor', content: 'What evidence licenses that scope?' },
  { role: 'learner', content: 'The test set looked fine.', learnerReversalEvent: { id: 'rev1' } },
  { role: 'tutor', content: 'Which subgroup did you check?' },
  { role: 'learner', content: 'I did not split by supplier.' },
  { role: 'tutor', content: 'So what is missing from your claim?' },
  { role: 'learner', content: 'A subgroup breakdown, maybe.' },
  { role: 'tutor', content: 'Add the row and tell me what it shows.' },
];

describe('state-ledger context (Slice 7)', () => {
  it('carries an early learner commitment forward past the recent-turn window', () => {
    const ledger = buildPublicStateLedger(HISTORY, { recentTurns: 2 });
    assert.match(ledger.replace(/\n/g, ' '), /turn 1\].*98% accuracy/, 'turn-1 commitment must survive in the ledger');
    // and it must NOT be in the last-2 verbatim window (that is the whole point)
    const recent = buildConversationContext(HISTORY, { contextMode: 'ledger-recent', recentTurns: 2 });
    const recentTail = recent.split('Most recent turns:')[1] || '';
    assert.ok(
      !/98% accuracy/.test(recentTail),
      'the early commitment should live in the ledger, not the recent window',
    );
  });

  it('redacts hidden provenance even if a public turn echoes it', () => {
    const leaky = [
      { role: 'learner', content: 'see config sha256:deadbeef0123 and secret: the answer is B' },
      { role: 'tutor', content: 'a' },
      { role: 'tutor', content: 'b' },
    ];
    const ledger = buildPublicStateLedger(leaky, { recentTurns: 1 });
    assert.ok(!/sha256:[0-9a-f]+/.test(ledger), 'must not contain a raw sha256 hash');
    assert.ok(!/secret:\s*the answer/.test(ledger), 'must redact a secret value');
  });

  it('default last-six matches the prior verbatim behaviour', () => {
    const lastSix = buildConversationContext(HISTORY, { contextMode: 'last-six' });
    const expected = HISTORY.slice(-6)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
    assert.equal(lastSix, expected, 'last-six must be byte-identical to the legacy slice(-6) render');
  });

  it('full-public renders the entire transcript; ledger-recent adds a ledger header', () => {
    const full = buildConversationContext(HISTORY, { contextMode: 'full-public' });
    assert.ok(full.includes('A subgroup breakdown'), 'full-public includes late turns');
    assert.ok(full.includes('98% accuracy'), 'full-public includes the earliest turn');
    const ledgerRecent = buildConversationContext(HISTORY, { contextMode: 'ledger-recent', recentTurns: 3 });
    assert.ok(ledgerRecent.includes('STATE LEDGER'), 'ledger-recent prepends the ledger');
    assert.ok(ledgerRecent.includes('Most recent turns:'), 'ledger-recent keeps a recent verbatim window');
  });

  it('applies a content renderer (learner side extracts public speech)', () => {
    const withInternal = [
      { role: 'learner', content: 'PRIVATE: scheming\nFINAL:\nI think it is 42.' },
      { role: 'tutor', content: 'why?' },
      { role: 'tutor', content: 'go on' },
    ];
    const ctx = buildConversationContext(withInternal, {
      contextMode: 'full-public',
      renderContent: (c) => c.split('FINAL:').pop().trim(),
    });
    assert.ok(!ctx.includes('scheming'), 'renderer must strip private sections');
    assert.ok(ctx.includes('I think it is 42.'), 'renderer keeps public speech');
  });
});
