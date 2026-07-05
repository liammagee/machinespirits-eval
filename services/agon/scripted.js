// Scripted (no-API) agon agents for hermetic tests and --dry runs.
//
// The scripted tutor plays a competent teach→probe policy; the scripted
// learner dodges in repertoire order while budget lasts and complies (with
// the true keyed answer) when directed. Deterministic; no network.

function envelopeBlock(envelope, visible) {
  return '```json\n' + JSON.stringify(envelope) + '\n```\n---\n' + visible;
}

export function makeScriptedAgents(config) {
  const conceptOrder = config.concepts.map((c) => c.id);
  const probesByConcept = Object.fromEntries(config.concepts.map((c) => [c.id, c.probes]));
  const answersByItem = {};
  for (const c of config.concepts) {
    for (const p of c.probes) answersByItem[p.id] = p.answers[0];
  }

  // Tutor policy state (closed over between calls).
  let lastTaught = null;
  let phase = 'teach'; // strict teach → probe alternation on the current target

  function scriptedTutor({ user }) {
    // Detect demonstrations from the scripted learner's comply sentence in
    // the dialogue ("Fine. It's <answer>.") — works in both arms, since the
    // dialogue is always in the prompt while the scoreboard is A1-only.
    const demonstratedIds = conceptOrder.filter((cid) => {
      const primary = probesByConcept[cid].find((p) => p.kind === 'primary');
      return user.includes(`Fine. It's ${answersByItem[primary.id]}.`);
    });
    const target = conceptOrder.find((cid) => !demonstratedIds.includes(cid)) ?? conceptOrder[conceptOrder.length - 1];

    let envelope;
    let visible;
    if (phase === 'teach' || lastTaught !== target) {
      lastTaught = target;
      envelope = { move: 'teach', concept: target, item_id: null, rationale: 'scripted teach' };
      visible = `Let me walk you through ${target.replace(/_/g, ' ')} with a concrete example.`;
      phase = 'probe';
    } else {
      const probe = probesByConcept[target].find((p) => p.kind === 'primary');
      envelope = { move: 'probe', concept: null, item_id: probe.id, rationale: 'scripted probe' };
      visible = `Quick check then: ${probe.stem}`;
      phase = 'teach';
    }
    return Promise.resolve({ text: envelopeBlock(envelope, visible), latencyMs: 0, model: 'scripted' });
  }

  function scriptedSuperego() {
    return Promise.resolve({
      text: '```json\n{"verdict":"OK","critique":""}\n```',
      latencyMs: 0,
      model: 'scripted',
    });
  }

  function scriptedLearner({ user }) {
    // Parse the brief JSON embedded at the top of the user prompt.
    const briefMatch = user.match(/YOUR BRIEF[^\n]*\n(\{[\s\S]*?\n\})\n/);
    const brief = briefMatch ? JSON.parse(briefMatch[1]) : { budgets: {}, pendingProbe: null };
    const mustComply = /must_comply|all dodges spent|you must comply/i.test(user);
    const available = Object.entries(brief.budgets || {}).filter(([, n]) => n > 0);

    let envelope;
    let visible;
    if (brief.pendingProbe && (mustComply || available.length === 0)) {
      const answer = answersByItem[brief.pendingProbe.itemId] || 'unknown';
      envelope = { action: 'comply', dodge_type: null, stated_answer: answer };
      visible = `Fine. It's ${answer}.`;
    } else if (available.length > 0) {
      const [dodgeType] = available[0];
      envelope = { action: 'dodge', dodge_type: dodgeType, stated_answer: null };
      visible = 'Why do we even have to do this.';
    } else {
      envelope = { action: 'dodge', dodge_type: config.dodges[0].id, stated_answer: null };
      visible = 'Whatever.';
    }
    return Promise.resolve({ text: envelopeBlock(envelope, visible), latencyMs: 0, model: 'scripted' });
  }

  return {
    descriptor: { tutor: 'scripted', learner: 'scripted' },
    tutorEgo: scriptedTutor,
    tutorSuperego: scriptedSuperego,
    learner: scriptedLearner,
  };
}
