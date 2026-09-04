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
  const drifted = recorded !== null && recorded !== observedSha256;
  if (drifted) {
    process.stderr.write(
      `file digest drift: ${label} ${filePath} recorded ${recorded.slice(0, 12)} observed ${observedSha256.slice(0, 12)}\n`,
    );
  }
  return { label, path: filePath, recordedSha256: recorded, observedSha256, drifted };
}
