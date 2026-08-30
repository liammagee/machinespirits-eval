// This emergency projection is deliberately browser-local: app.js cannot read
// server-side config/providers.yaml when the catalog request fails. The public
// catalog parity test locks its model default to the server-derived projection.
const EMERGENCY_MODEL = Object.freeze({ ref: 'codex.gpt-5.6-luna', label: 'Codex · GPT-5.6 Luna' });

export function fallbackCatalog() {
  return {
    defaults: {
      lab: 'pure_chat',
      world: 'none',
      tutor: 'dramatic-detective@v1',
      model: EMERGENCY_MODEL.ref,
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
    models: [EMERGENCY_MODEL],
    curricula: [],
  };
}

export default fallbackCatalog;
