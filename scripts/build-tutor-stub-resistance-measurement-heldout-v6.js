#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import { runTutorStubResistanceMeasurementHeldoutCli } from './lib/tutorStubResistanceMeasurementHeldoutBuilder.js';
import { TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_V6 } from './lib/tutorStubResistanceMeasurementHeldoutVersions.js';

export const TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_DESCRIPTOR = TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_V6;

export function runTutorStubResistanceMeasurementHeldoutV6Cli(options) {
  return runTutorStubResistanceMeasurementHeldoutCli(TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_DESCRIPTOR, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTutorStubResistanceMeasurementHeldoutV6Cli();
}
