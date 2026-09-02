import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTION_OUTCOME_ELIGIBLE_SET_VERSION,
  canonicalActionOutcomeEligibleSet,
} from './adaptiveTutor/actionOutcomeComparability.js';
import { ACTION_OUTCOME_MEASUREMENT_POLICIES } from './adaptiveTutor/actionOutcomeReviewPacket.js';
import { allowedMoveFamiliesForScaffoldPhase } from './adaptiveTutor/scaffoldLifecycle.js';
import { TUTOR_STUB_MOVE_FAMILIES } from './adaptiveTutor/tutorStubActionAdapter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TUTOR_STUB_ACTION_OUTCOME_PROSPECTIVE_REDESIGN_PATH =
  'config/tutor-stub-action-outcome-prospective-redesign.v1.json';
export const TUTOR_STUB_ACTION_OUTCOME_PROSPECTIVE_REDESIGN_SCHEMA =
  'machinespirits.tutor-stub.action-outcome-prospective-redesign-preflight.v1';

function repositoryFile(root, value) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value)) {
    throw new Error('prospective redesign paths must be repository-relative');
  }
  const absolutePath = path.resolve(root, value);
  const relativePath = path.relative(root, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('prospective redesign paths must stay inside the repository');
  }
  return { absolutePath, relativePath: relativePath.split(path.sep).join('/') };
}

export function loadTutorStubActionOutcomeProspectiveRedesign({
  root = ROOT,
  designPath = TUTOR_STUB_ACTION_OUTCOME_PROSPECTIVE_REDESIGN_PATH,
} = {}) {
  const resolved = repositoryFile(root, designPath);
  const design = JSON.parse(fs.readFileSync(resolved.absolutePath, 'utf8'));
  return { root: path.resolve(root), path: resolved.absolutePath, relativePath: resolved.relativePath, design };
}

export function runTutorStubActionOutcomeProspectiveRedesignPreflight({ loaded } = {}) {
  if (!loaded?.design || !loaded?.root) throw new Error('prospective redesign preflight needs a loaded design');
  const { design } = loaded;
  const supported = design.comparability?.firstSupportedStratum;
  const supportedSet = canonicalActionOutcomeEligibleSet(supported?.families || []);
  const auditOnly = design.comparability?.auditOnlyCurrentStrata || [];
  const auditPath = repositoryFile(loaded.root, design.sourcePilot?.audit || '');
  const checks = {
    design_identity:
      design.documentType === 'prospective_action_outcome_redesign' &&
      design.version === 1 &&
      design.status === 'implemented_zero_call_design_seam',
    failed_pilot_frozen:
      design.sourcePilot?.disposition === 'closed_feasibility_failure' &&
      design.sourcePilot?.reuse === 'development_examples_only_never_memory_evidence_or_sample_top_up' &&
      fs.existsSync(auditPath.absolutePath),
    no_call_authority:
      design.modelCalls === 0 && design.futureCollection?.status === 'not_registered_no_launch_authority',
    exact_eligible_set_registered:
      design.comparability?.unit === 'exact_eligible_move_family_set' &&
      design.comparability?.minimumFamilies === 2 &&
      design.comparability?.runtimeEligibleSetVersion === ACTION_OUTCOME_ELIGIBLE_SET_VERSION &&
      supportedSet.comparative &&
      supportedSet.id === supported?.eligibleSetId,
    support_stratum_matches_runtime:
      supported?.scaffoldPhase === 'support' &&
      JSON.stringify(supportedSet.families) ===
        JSON.stringify(canonicalActionOutcomeEligibleSet(allowedMoveFamiliesForScaffoldPhase('support')).families),
    singleton_strata_are_audit_only: auditOnly.every((row) => {
      const runtimeFamilies = allowedMoveFamiliesForScaffoldPhase(row.scaffoldPhase);
      return (
        runtimeFamilies.length === 1 &&
        JSON.stringify(canonicalActionOutcomeEligibleSet(row.families).families) ===
          JSON.stringify(canonicalActionOutcomeEligibleSet(runtimeFamilies).families)
      );
    }),
    unsupported_families_are_real_singletons:
      JSON.stringify([...design.comparability.unsupportedComparativeFamilies].sort()) ===
      JSON.stringify(
        auditOnly
          .flatMap((row) => row.families)
          .filter((family) => TUTOR_STUB_MOVE_FAMILIES.includes(family))
          .sort(),
      ),
    human_semantic_authority_registered:
      design.measurement?.policy === ACTION_OUTCOME_MEASUREMENT_POLICIES.HUMAN_CONSENSUS_AUXILIARY_VETO_V2 &&
      design.measurement?.auxiliaryRules?.oppositeBinary === 'measurement_indeterminate' &&
      design.measurement?.auxiliaryRules?.inconclusiveOrNonbinary === 'nonconfirmatory_no_veto',
    held_out_worlds_preserved:
      design.heldOutControllerStudy?.status === 'not_yet_designed' &&
      design.heldOutControllerStudy?.worlds?.length === 2 &&
      design.heldOutControllerStudy?.assistedClosureIsNotAnEndpoint === true,
  };
  return {
    schema: TUTOR_STUB_ACTION_OUTCOME_PROSPECTIVE_REDESIGN_SCHEMA,
    status: Object.values(checks).every(Boolean) ? 'passed_zero_call' : 'failed',
    designPath: loaded.relativePath,
    checks,
    supportedEligibleSet: supportedSet,
    auditOnlyEligibleSets: auditOnly.map((row) => ({
      scaffoldPhase: row.scaffoldPhase,
      ...canonicalActionOutcomeEligibleSet(row.families),
    })),
    modelCalls: 0,
    productionWrites: 0,
  };
}
