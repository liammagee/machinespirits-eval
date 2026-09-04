import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Record the digest of a file on disk instead of refusing when it drifts.
 *
 * CLAUDE.md (2026-08-21, 2026-09-03): byte pins are for sealed data only —
 * a held-out corpus or a validation certificate. Code, schemas, prompts,
 * designs, registrations and go requests are edited in place, so a run-time
 * digest of one of those files must be recorded, never enforced. A refusal
 * there turns a one-line bug fix into a design change and pushes the next
 * agent to write a numbered copy.
 *
 * @param {object} options
 * @param {string} [options.root] Directory a relative filePath resolves against.
 * @param {string} options.filePath Path to the file whose digest is recorded.
 * @param {string} [options.recordedSha256] Digest written down earlier, if any.
 * @param {string} options.label Short name for the file, used in the record.
 * @returns {{label: string, path: string, recordedSha256: string|null, observedSha256: string, drifted: boolean}}
 */
export function recordFileDigest({ root, filePath, recordedSha256, label }) {
  const absolute = root ? path.resolve(root, filePath) : path.resolve(filePath);
  const observedSha256 = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
  return recordObservedDigest({ label, filePath, recordedSha256, observedSha256 });
}

/**
 * Record a digest already computed by the caller.
 *
 * Same record and same drift line as {@link recordFileDigest}, for the case
 * where the file was read one frame up and only the two digests reach here.
 *
 * @param {object} options
 * @param {string} options.label Short name for the file, used in the record.
 * @param {string} options.filePath Path of the file the digests describe.
 * @param {string} [options.recordedSha256] Digest written down earlier, if any.
 * @param {string} options.observedSha256 Digest computed from the file now.
 * @returns {{label: string, path: string, recordedSha256: string|null, observedSha256: string, drifted: boolean}}
 */
export function recordObservedDigest({ label, filePath, recordedSha256, observedSha256 }) {
  const recorded = typeof recordedSha256 === 'string' ? recordedSha256 : null;
  const observed = typeof observedSha256 === 'string' ? observedSha256 : null;
  const drifted = recorded !== null && recorded !== observed;
  if (drifted) {
    const shown = observed === null ? 'absent' : observed.slice(0, 12);
    process.stderr.write(
      `file digest drift: ${label} ${filePath} recorded ${recorded.slice(0, 12)} observed ${shown}\n`,
    );
  }
  return { label, path: filePath, recordedSha256: recorded, observedSha256: observed, drifted };
}

/**
 * Split a source-surface contract into recorded digests and enforced fields.
 *
 * Several lineage guards freeze a whole contract object whose members mix
 * digests over source files with plain design values read out of a config.
 * The file members are recorded, so editing a source file never blocks a run.
 * Every other member is returned as a mismatch, so the caller can still refuse
 * on a changed design value.
 *
 * @param {object} options
 * @param {string} options.label Short name for the contract, used in records.
 * @param {object} options.recorded Contract digests written down earlier.
 * @param {object} options.observed Contract digests computed now.
 * @param {string[]} options.fileKinds Member names whose digests cover files.
 * @returns {{records: object[], mismatches: string[]}}
 */
export function recordSourceSetDigests({ label, recorded, observed, fileKinds }) {
  const records = [];
  const mismatches = [];
  const kinds = [...new Set([...Object.keys(recorded || {}), ...Object.keys(observed || {})])].sort();
  for (const kind of kinds) {
    const recordedValue = recorded?.[kind] ?? null;
    const observedValue = observed?.[kind] ?? null;
    if (fileKinds.includes(kind)) {
      records.push(
        recordObservedDigest({
          label: `${label} ${kind}`,
          filePath: `${label} ${kind} source set`,
          recordedSha256: recordedValue,
          observedSha256: observedValue,
        }),
      );
      continue;
    }
    if (recordedValue !== observedValue) mismatches.push(kind);
  }
  return { records, mismatches };
}
