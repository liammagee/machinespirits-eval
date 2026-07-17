import { sha256 } from '../experimentRunArtifacts.js';

const TRANSITION_ATOMIC_SURFACE_OVERRIDES = Object.freeze([
  Object.freeze({
    question: 'Whose hand felled the Hethel bridge span that carried the drovers down?',
    source_surface_sha256: '02deb8a883a915855814724f239f152c69d9cf9f1fe0751d0206a60006b01e5e',
    public_surface:
      'The crown-bed mortar was still green to the knife and bears the material trace of centering struck away while the bed was soft.',
  }),
]);

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Project an authored evidence surface to the single public premise carried by
 * its transition. The exact question and source hash keep this fail-closed:
 * any world edit stops matching instead of silently rewriting new prose.
 */
export function adaptiveStateTransitionAtomicSurface({ question, surface } = {}) {
  const value = String(surface || '').trim();
  const match = TRANSITION_ATOMIC_SURFACE_OVERRIDES.find(
    (row) => row.question === String(question || '').trim() && row.source_surface_sha256 === sha256(value),
  );
  return match ? match.public_surface : value;
}

/**
 * Pure public projection shared by the zero-call harness and paid realizer.
 * Shape and leakage validation remain the responsibility of their respective
 * boundary adapters so this module has no provider or live-analyzer imports.
 */
export function isolateAdaptiveStatePublicRealizerInput(input) {
  const isolated = clone(input);
  const question = isolated?.publicWorldVocabulary?.question;
  const isolate = (surface) => adaptiveStateTransitionAtomicSurface({ question, surface });
  for (const event of isolated?.currentPublicActEnvelope?.events || []) {
    if (typeof event.evidence_surface === 'string') event.evidence_surface = isolate(event.evidence_surface);
  }
  if (Array.isArray(isolated?.publicWorldVocabulary?.released_evidence_surfaces)) {
    isolated.publicWorldVocabulary.released_evidence_surfaces =
      isolated.publicWorldVocabulary.released_evidence_surfaces.map(isolate);
  }
  return isolated;
}
