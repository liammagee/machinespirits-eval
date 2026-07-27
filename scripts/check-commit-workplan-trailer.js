#!/usr/bin/env node
/**
 * Check that commits landing directly on main name a workplan item.
 *
 * `wp:pr-link` covers work that arrives through a pull request by reading the
 * PR body, and `.github/workflows/workplan-validate.yml` gates it on
 * `pull_request` events only. Nothing covered work pushed straight to main,
 * which is how the 2026-07-27 board audit turned up twelve feature commits with
 * no recorded card. This is the same rule on the other surface: it reads the
 * commit message, using the grammar in scripts/lib/workplanLink.js.
 *
 * It is a tripwire, not a gate. It runs after the push, so a failure is not
 * something you fix by amending a commit that is already on main — you fix it
 * by recording that commit on the card it belongs to. Run it before you push to
 * avoid the situation entirely:
 *
 *   npm run wp:commit-link -- --range origin/main..HEAD
 *
 * Write the link with git's own trailer support so the message stays canonical:
 *
 *   git commit --trailer "Workplan-item: some-card-id"
 *   git commit --trailer "Workplan-item: N/A"
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { findLinkedId, loadKnownItems } from './lib/workplanLink.js';

const ZERO_SHA = '0'.repeat(40);
const NAME = 'workplan-commit-link';

function fail(message) {
  console.error(`${NAME}: ${message}`);
  process.exit(1);
}

function flags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function commitExists(sha) {
  try {
    git(['cat-file', '-e', `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Which commits this invocation is responsible for.
 *
 * A push event carries `before` and `after`. Three cases make `before`
 * unusable: a brand-new ref (all zeros), a force-push that rewrote it away, and
 * a ref whose old tip this shallow-ish checkout cannot reach. In each we fall
 * back to the pushed tip alone rather than silently checking nothing — a
 * force-push is exactly when someone might hope the check looks away.
 */
function resolveCommits(opts) {
  if (typeof opts.range === 'string') {
    return { shas: revList(opts.range), source: `range ${opts.range}` };
  }
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) fail('pass --range <rev-range>, or run under a push GitHub event');
  let event;
  try {
    event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  } catch (err) {
    fail(`could not read GITHUB_EVENT_PATH: ${err.message}`);
  }
  if (event.deleted) return { shas: [], source: 'branch deletion' };

  const after = event.after && event.after !== ZERO_SHA ? event.after : 'HEAD';
  const before = event.before;
  const usableBefore = before && before !== ZERO_SHA && !event.forced && commitExists(before);
  if (!usableBefore) {
    const why = event.forced ? 'force-push' : 'no reachable previous tip';
    return { shas: [after], source: `pushed tip only (${why})` };
  }
  return { shas: revList(`${before}..${after}`), source: `push ${before.slice(0, 8)}..${after.slice(0, 8)}` };
}

/**
 * First-parent only. A merge brings a branch's own commits onto main, and those
 * were reviewed as a pull request; requiring a trailer on each of them would
 * make every PR author write the link once per commit.
 */
function revList(range) {
  try {
    return git(['rev-list', '--first-parent', range]).split('\n').filter(Boolean);
  } catch (err) {
    fail(`could not list commits for ${range}: ${String(err.stderr || err.message).trim()}`);
  }
}

function describe(sha) {
  const raw = git(['show', '-s', '--format=%H%x00%P%x00%s%x00%B', sha]);
  const [full, parents, subject, message] = raw.split('\0');
  let paths = [];
  if (parents.trim().split(/\s+/).filter(Boolean).length <= 1) {
    paths = git(['show', '--name-only', '--format=', sha]).split('\n').filter(Boolean);
  }
  return {
    sha: full.trim(),
    short: full.trim().slice(0, 8),
    parents: parents.trim().split(/\s+/).filter(Boolean),
    subject: subject.trim(),
    message: message ?? '',
    paths,
  };
}

/**
 * Reasons a commit on main legitimately carries no link of its own.
 *
 * The squash rule trusts GitHub's `(#123)` subject convention. That is a
 * convention, not a proof — someone could write it by hand — but this check
 * exists to keep honest work traceable, not to resist an author who is trying
 * to evade their own board. Exemptions are printed, so a suspicious one is
 * visible in the log rather than silent.
 */
function exemption(commit) {
  if (commit.parents.length > 1) return 'merge commit; the pull request body carries the link';
  if (/\(#\d+\)$/.test(commit.subject)) return 'squash-merged pull request; the PR body carries the link';
  if (commit.paths.length > 0 && commit.paths.every((p) => p.startsWith('workplan/')))
    return 'touches only workplan/, which is the record itself';
  return null;
}

function main() {
  const opts = flags(process.argv.slice(2));
  const { shas, source } = resolveCommits(opts);
  const knownIds = new Set(loadKnownItems().keys());

  const checked = [];
  const exempt = [];
  const missing = [];

  for (const sha of shas) {
    const commit = describe(sha);
    const why = exemption(commit);
    if (why) {
      exempt.push({ commit, why });
      continue;
    }
    const result = findLinkedId(commit.message, knownIds);
    if (result.ok) checked.push({ commit, result });
    else missing.push({ commit, result });
  }

  console.log(
    `${NAME}: ${shas.length} commit(s) on the first-parent line of ${source} — ` +
      `${checked.length} linked, ${exempt.length} exempt, ${missing.length} unlinked`,
  );
  for (const { commit, why } of exempt) console.log(`  exempt  ${commit.short}  ${commit.subject}  (${why})`);
  for (const { commit, result } of checked) {
    const target = result.kind === 'na' ? 'N/A' : result.id;
    console.log(`  linked  ${commit.short}  ${commit.subject}  -> ${target}`);
  }
  if (missing.length === 0) return;

  for (const { commit, result } of missing) {
    const seen = result.values.length ? `  saw: ${result.values.join(' | ')}` : '';
    console.error(`  UNLINKED ${commit.short}  ${commit.subject}${seen}`);
  }
  console.error('');
  console.error('Every commit that lands on main outside a pull request must name the card it');
  console.error('belongs to, or say N/A. Before pushing, write it into the message:');
  console.error('');
  console.error('  git commit --trailer "Workplan-item: <id>"      # an id from workplan/items/');
  console.error('  git commit --trailer "Workplan-item: N/A"       # genuinely boardless chore');
  console.error('');
  console.error('If these commits are already on main you cannot amend them. Record them on the');
  console.error('card they belong to instead, and create the card first if none exists:');
  console.error('');
  console.error('  node scripts/workplan.js add --title "..." --type infra --priority P2');
  process.exit(1);
}

main();
