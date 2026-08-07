import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  appendLocalCiEvidence,
  assertLocalCiReport,
  buildDefaultPrBody,
  hasHostedCiChecks,
  orchestratePrCreation,
  parsePrCreateArgs,
  validatePrBodyWorkplan,
} from '../scripts/create-pr.js';

const HEAD_SHA = '1234567890abcdef1234567890abcdef12345678';
const PR_URL = 'https://github.com/liammagee/machinespirits-eval/pull/999';
const WORKPLAN_ID = 'local-ci-pr-creation-gate';

function result(stdout = '', code = 0, stderr = '') {
  return { code, stdout, stderr, signal: null };
}

function makeOptions(overrides = {}) {
  return {
    ...parsePrCreateArgs(['--title', 'Add adaptive PR admission', '--workplan', WORKPLAN_ID]),
    waitSeconds: 0,
    ...overrides,
  };
}

function makeHarness({ hostedChecks = [], failProfile = null, revParse = [HEAD_SHA], status = [''] } = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'machinespirits-pr-create-test-'));
  const events = [];
  const gitCalls = [];
  const ghCalls = [];
  const ciProfiles = [];
  let ready = false;
  let revParseIndex = 0;
  let statusIndex = 0;
  let createdBody = '';
  let editedBody = '';

  const deps = {
    projectRoot,
    now: () => 0,
    sleep: async () => {},
    async git(args) {
      gitCalls.push(args);
      const command = args.join(' ');
      if (command === 'branch --show-current') return result('codex/local-ci-pr-create\n');
      if (command === 'status --porcelain=v1 --untracked-files=all') {
        const value = status[Math.min(statusIndex, status.length - 1)];
        statusIndex += 1;
        return result(value);
      }
      if (command === 'rev-parse HEAD') {
        const value = revParse[Math.min(revParseIndex, revParse.length - 1)];
        revParseIndex += 1;
        return result(`${value}\n`);
      }
      if (command === 'fetch origin main --prune') return result();
      if (command === 'merge-base --is-ancestor origin/main HEAD') return result();
      if (command === 'rev-list --count origin/main..HEAD') return result('1\n');
      if (command === 'push -u origin HEAD:refs/heads/codex/local-ci-pr-create') {
        events.push('push');
        return result();
      }
      if (command === 'ls-remote --heads origin refs/heads/codex/local-ci-pr-create') {
        return result(`${HEAD_SHA}\trefs/heads/codex/local-ci-pr-create\n`);
      }
      throw new Error(`unexpected git call: ${command}`);
    },
    async gh(args) {
      ghCalls.push(args);
      const command = args.slice(0, 2).join(' ');
      if (command === 'pr list') return result('[]\n');
      if (command === 'pr create') {
        events.push('create');
        createdBody = fs.readFileSync(args[args.indexOf('--body-file') + 1], 'utf8');
        return result(`${PR_URL}\n`);
      }
      if (command === 'pr view') {
        return result(
          JSON.stringify({
            number: 999,
            url: PR_URL,
            isDraft: !ready,
            headRefOid: HEAD_SHA,
            statusCheckRollup: hostedChecks,
            state: 'OPEN',
          }),
        );
      }
      if (command === 'pr edit') {
        events.push('edit');
        editedBody = fs.readFileSync(args[args.indexOf('--body-file') + 1], 'utf8');
        return result();
      }
      if (command === 'pr ready') {
        events.push('ready');
        ready = true;
        return result();
      }
      throw new Error(`unexpected gh call: ${args.join(' ')}`);
    },
    async localCi({ profile }) {
      events.push(`ci:${profile}`);
      ciProfiles.push(profile);
      if (profile === failProfile) throw new Error(`${profile} local CI failed`);
      return { status: 'passed', sourceSha: HEAD_SHA, profile };
    },
  };

  return {
    deps,
    events,
    gitCalls,
    ghCalls,
    ciProfiles,
    get createdBody() {
      return createdBody;
    },
    get editedBody() {
      return editedBody;
    },
  };
}

function knownItems() {
  return new Map([[WORKPLAN_ID, { id: WORKPLAN_ID, branch: 'codex/local-ci-pr-create' }]]);
}

test('PR creation arguments expose adaptive admission controls', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  assert.equal(manifest.scripts['pr:create'], 'node scripts/create-pr.js');
  const options = parsePrCreateArgs([
    '--title=Safe handoff',
    `--workplan=${WORKPLAN_ID}`,
    '--ci=full',
    '--base=release',
    '--wait-seconds=12',
    '--poll-seconds=2',
    '--offline',
    '--no-install',
    '--draft',
  ]);
  assert.equal(options.title, 'Safe handoff');
  assert.equal(options.ci, 'full');
  assert.equal(options.base, 'release');
  assert.equal(options.waitSeconds, 12);
  assert.equal(options.pollSeconds, 2);
  assert.equal(options.offline, true);
  assert.equal(options.noInstall, true);
  assert.equal(options.draft, true);
  assert.throws(() => parsePrCreateArgs(['--title', 'x']), /--workplan is required/u);
  assert.throws(
    () => parsePrCreateArgs(['--title', 'x', '--workplan', WORKPLAN_ID, '--ci', 'maybe']),
    /Unknown PR CI mode/u,
  );
});

test('generated and supplied PR bodies must name the expected workplan item', () => {
  const body = buildDefaultPrBody({ title: 'Safe handoff', workplan: WORKPLAN_ID });
  assert.equal(validatePrBodyWorkplan(body, WORKPLAN_ID, knownItems()).id, WORKPLAN_ID);
  assert.throws(() => validatePrBodyWorkplan(body, 'different-item', knownItems()), /expected different-item/u);
  assert.equal(validatePrBodyWorkplan('Workplan item: N/A\n', 'N/A', knownItems()).kind, 'na');
});

test('hosted-check detection ignores unrelated bot checks', () => {
  assert.equal(hasHostedCiChecks([{ name: 'Copilot code review' }]), false);
  assert.equal(hasHostedCiChecks([{ workflowName: 'CI', name: 'Node 22 shard 1/2' }]), true);
  assert.equal(hasHostedCiChecks([{ name: 'Workplan validation' }]), true);
});

test('local CI evidence is replaceable and reports must match the admitted SHA', () => {
  const first = appendLocalCiEvidence('Summary\n', {
    reportPath: '.test-tmp/one/summary.md',
    sourceSha: HEAD_SHA,
    reason: 'Explicit full policy.',
  });
  const second = appendLocalCiEvidence(first, {
    reportPath: '.test-tmp/two/summary.md',
    sourceSha: HEAD_SHA,
  });
  assert.doesNotMatch(second, /one\/summary/u);
  assert.match(second, /two\/summary/u);
  assert.equal((second.match(/local-ci-pr-create:start/gu) || []).length, 1);
  assert.throws(
    () =>
      assertLocalCiReport(
        { status: 'passed', sourceSha: 'other', profile: 'quick' },
        { sourceSha: HEAD_SHA, profile: 'quick' },
      ),
    /expected 123456/u,
  );
});

test('auto mode uses hosted CI without duplicating the full local suite', async () => {
  const harness = makeHarness({ hostedChecks: [{ workflowName: 'CI', name: 'Node 22 shard 1/2' }] });
  const outcome = await orchestratePrCreation(makeOptions(), { deps: harness.deps, knownItems: knownItems() });
  assert.deepEqual(harness.ciProfiles, ['quick']);
  assert.deepEqual(harness.events, ['ci:quick', 'push', 'create', 'ready']);
  assert.match(harness.createdBody, /\[x\] Local PR admission gate passed/u);
  assert.equal(outcome.hostedChecksAttached, true);
  assert.equal(outcome.fallbackUsed, false);
  assert.equal(outcome.isDraft, false);
});

test('auto mode keeps the PR draft through a full local fallback when hosted CI is absent', async () => {
  const harness = makeHarness({ hostedChecks: [{ name: 'Copilot code review' }] });
  const outcome = await orchestratePrCreation(makeOptions(), { deps: harness.deps, knownItems: knownItems() });
  assert.deepEqual(harness.ciProfiles, ['quick', 'full']);
  assert.deepEqual(harness.events, ['ci:quick', 'push', 'create', 'ci:full', 'edit', 'ready']);
  assert.match(harness.editedBody, /GitHub hosted checks did not attach/u);
  assert.equal(outcome.hostedChecksAttached, false);
  assert.equal(outcome.fallbackUsed, true);
  assert.equal(outcome.isDraft, false);
});

test('explicit full mode admits locally before push and can preserve the draft', async () => {
  const harness = makeHarness();
  const outcome = await orchestratePrCreation(makeOptions({ ci: 'full', draft: true }), {
    deps: harness.deps,
    knownItems: knownItems(),
  });
  assert.deepEqual(harness.events, ['ci:quick', 'ci:full', 'push', 'create']);
  assert.match(harness.createdBody, /Full local admission was explicitly requested/u);
  assert.equal(outcome.isDraft, true);
});

test('a failed quick gate performs no remote write', async () => {
  const harness = makeHarness({ failProfile: 'quick' });
  await assert.rejects(
    orchestratePrCreation(makeOptions(), { deps: harness.deps, knownItems: knownItems() }),
    /quick local CI failed/u,
  );
  assert.deepEqual(harness.events, ['ci:quick']);
  assert.equal(
    harness.ghCalls.some((args) => args[1] === 'create'),
    false,
  );
});

test('a failed fallback leaves the created PR in draft and reports its URL', async () => {
  const harness = makeHarness({ failProfile: 'full' });
  await assert.rejects(
    orchestratePrCreation(makeOptions(), { deps: harness.deps, knownItems: knownItems() }),
    new RegExp(`full local CI failed; draft PR remains at ${PR_URL}`, 'u'),
  );
  assert.deepEqual(harness.events, ['ci:quick', 'push', 'create', 'ci:full']);
  assert.equal(
    harness.ghCalls.some((args) => args[1] === 'ready'),
    false,
  );
});

test('a changed HEAD after admission is rejected before push', async () => {
  const nextSha = 'abcdef1234567890abcdef1234567890abcdef12';
  const harness = makeHarness({ revParse: [HEAD_SHA, nextSha] });
  await assert.rejects(
    orchestratePrCreation(makeOptions({ ci: 'quick' }), { deps: harness.deps, knownItems: knownItems() }),
    /HEAD changed during local admission/u,
  );
  assert.deepEqual(harness.events, ['ci:quick']);
});

test('user-provided PR text remains one argument without shell interpolation', async () => {
  const title = 'Keep $(touch /tmp/not-created); quotes "literal"';
  const harness = makeHarness({ hostedChecks: [{ workflowName: 'Workplan validation' }] });
  await orchestratePrCreation(makeOptions({ title }), { deps: harness.deps, knownItems: knownItems() });
  const create = harness.ghCalls.find((args) => args[0] === 'pr' && args[1] === 'create');
  assert.equal(create[create.indexOf('--title') + 1], title);
});
