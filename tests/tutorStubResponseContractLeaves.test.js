import assert from 'node:assert/strict';
import test from 'node:test';

import * as dramaticRelease from '../services/tutorStubDramaticRelease.js';
import * as responseConfiguration from '../services/tutorStubResponseConfiguration.js';
import * as responseContractSchemas from '../services/tutorStubResponseContractSchemas.js';
import * as roleVisibility from '../services/tutorStubRoleVisibility.js';
import * as sourceAccessibility from '../services/tutorStubSourceAccessibilityContract.js';
import * as surfaceAccessibility from '../services/tutorStubSurfaceAccessibility.js';

test('response contract facades re-export the exact extracted leaf bindings', () => {
  assert.equal(
    dramaticRelease.TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA,
    responseContractSchemas.TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA,
  );
  assert.equal(dramaticRelease.tutorStubRoleStageDirectionVisible, roleVisibility.tutorStubRoleStageDirectionVisible);
  assert.equal(
    dramaticRelease.tutorStubFirstPersonRoleVoiceVisible,
    roleVisibility.tutorStubFirstPersonRoleVoiceVisible,
  );
  assert.equal(
    responseConfiguration.measureTutorStubSurfaceSentenceAccessibility,
    surfaceAccessibility.measureTutorStubSurfaceSentenceAccessibility,
  );
  assert.equal(
    sourceAccessibility.TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA,
    responseContractSchemas.TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA,
  );
  assert.equal(
    sourceAccessibility.TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA,
    responseContractSchemas.TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA,
  );
});
