/**
 * Recorded source provenance.
 *
 * CLAUDE.md (2026-08-21): provenance is recorded, not enforced. Write down the
 * commit, the tree and whether the checkout was dirty. Never refuse to run over
 * it. Several run scripts used to throw on a dirty tree, which turned a one-line
 * defect correction into a re-approval ceremony before the batch could restart.
 *
 * The parser exists because four copies of the same three lines each trimmed the
 * whole `git status --porcelain` output first. That strips the leading space of
 * the ` M path` status column, so the first path lost its first character.
 */

/** Split `git status --porcelain=v1` output into the paths it names. */
export function parseGitPorcelainPaths(statusOutput) {
  return String(statusOutput || '')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

/**
 * Record a working-tree status. Prints one stderr line when the tree is dirty
 * and returns the record; it never throws.
 */
export function recordSourceStatus({ label, statusOutput }) {
  const dirtyPaths = parseGitPorcelainPaths(statusOutput);
  if (dirtyPaths.length) {
    process.stderr.write(`${label} source is dirty: ${dirtyPaths.length} path(s) ${dirtyPaths.join(' ')}\n`);
  }
  return { dirty: dirtyPaths.length > 0, dirtyPaths };
}
