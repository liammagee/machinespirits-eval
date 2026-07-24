/**
 * Dependency-free schema identifiers shared by tutor-stub response contracts.
 *
 * Keeping these identifiers outside the response, dramatic-release, and
 * source-accessibility implementations prevents schema checks from coupling
 * their orchestration graphs.
 */

export const TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA = 'machinespirits.tutor-stub.dramatic-release.v1';

export const TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA =
  'machinespirits.tutor-stub.source-accessibility-contract.v1';

export const TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA = 'machinespirits.tutor-stub.source-accessibility-audit.v1';
