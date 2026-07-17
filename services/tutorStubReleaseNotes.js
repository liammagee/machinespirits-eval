import { execFileSync } from 'node:child_process';

export const TUTOR_STUB_RELEASE_NOTES_SCHEMA = 'machinespirits.tutor-stub.release-notes.v1';
export const DEFAULT_TUTOR_STUB_RELEASE_NOTES_HOURS = 24;
export const MAX_TUTOR_STUB_RELEASE_NOTES_HOURS = 168;

const RELEASE_NOTE_GROUPS = [
  {
    id: 'dialogue_flow',
    title: 'Dialogue flow and closure',
    matches: [
      /advance after completed learner moves/iu,
      /avoid reopening resolved clue questions/iu,
      /close (?:supported learner answers|voiced verdicts)(?: safely)?/iu,
      /low-agency/iu,
      /choice uptake/iu,
    ],
    effect:
      'The tutor should credit an answered step, move the case forward, offer a concrete choice when the learner delegates, and close once the supported conclusion has been voiced.',
    lookFor:
      'Fewer repeated questions, less indefinite circling, and a natural ending instead of another proof demand.',
  },
  {
    id: 'dramatic_delivery',
    title: 'Character and dramatic delivery',
    matches: [
      /character recovery/iu,
      /recovery configuration/iu,
      /recovery realization/iu,
      /natural clue performances/iu,
      /dramatic counterpressure/iu,
      /host-part misses/iu,
      /configured recovery realization/iu,
    ],
    effect:
      'Selected character, stance, and performance should survive revision and appear inside the tutor utterance rather than as an announced role-play instruction.',
    lookFor:
      'Witnesses, objects, and scene actions carrying clues in one coherent voice, with more visible variation between turns.',
  },
  {
    id: 'safe_recovery',
    title: 'Safety and context-preserving recovery',
    matches: [
      /sanitize recovery prompt boundaries/iu,
      /preserve safe model recoveries/iu,
      /public clue boundary/iu,
      /recovery audit boundaries/iu,
      /semantic recovery continuations/iu,
      /(?:reduce|avoid).*fallback/iu,
      /fallbacks?/iu,
      /guarded recovery/iu,
    ],
    effect:
      'If a draft fails a response check, the repair should retain the live conversation and released clues without exposing private evidence or falling back to another scenario.',
    lookFor: 'Fewer generic safe continuations and no sudden Marrick-like vocabulary or non sequiturs after a repair.',
  },
  {
    id: 'cli_experience',
    title: 'CLI and inspection experience',
    matches: [/safe diagnostic character loop/iu, /voice companion/iu, /CLI themes/iu, /release notes/iu],
    effect:
      'Diagnostic campaigns can preserve failures safely, while the interactive CLI has clearer visual and voice surfaces.',
    lookFor: 'Safer complete diagnostic traces, theme-aware output, and an optional browser voice companion.',
  },
];

const VALIDATION_GROUP = {
  id: 'validation',
  title: 'Verification and generalization evidence',
  effect:
    'These commits do not directly change a tutor line; they predeclare fresh tests or record results so behavior changes are checked without tuning against the acceptance cases.',
  lookFor:
    'More confidence that the behavior transfers across scenarios and learner profiles; use the linked commit subjects to distinguish evidence from product changes.',
};

const OTHER_GROUP = {
  id: 'other',
  title: 'Other tutor-stub changes',
  effect:
    'These relevant commits are shown for completeness, but their dialogue effect is not safely inferable from the commit title alone.',
  lookFor: 'Open the named commit before attributing a visible behavior change to it.',
};

const TUTOR_STUB_FILE =
  /^(?:scripts\/tutor-stub(?:[-.]|\/)|services\/tutorStub|tests\/tutorStub|services\/__tests__\/tutorStub|config\/tutor-stub|notes\/status\/.*character-generalization|docs\/tutor-stub|\.codex\/skills\/ms-tutor-stub-eval)/u;

export function normalizeTutorStubReleaseNotesHours(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return DEFAULT_TUTOR_STUB_RELEASE_NOTES_HOURS;
  }
  const text = String(value).trim();
  if (!/^\d+$/u.test(text)) {
    throw new Error(`hours must be a whole number from 1 to ${MAX_TUTOR_STUB_RELEASE_NOTES_HOURS}`);
  }
  const hours = Number(text);
  if (hours < 1 || hours > MAX_TUTOR_STUB_RELEASE_NOTES_HOURS) {
    throw new Error(`hours must be a whole number from 1 to ${MAX_TUTOR_STUB_RELEASE_NOTES_HOURS}`);
  }
  return hours;
}

export function parseTutorStubGitLog(value) {
  const commits = [];
  let current = null;
  for (const line of String(value || '').split(/\r?\n/u)) {
    if (line.startsWith('@@@')) {
      const [hash = '', shortHash = '', committedAt = '', ...subjectParts] = line.slice(3).split('\t');
      current = {
        hash,
        shortHash,
        committedAt,
        subject: subjectParts.join('\t'),
        files: [],
      };
      commits.push(current);
    } else if (current && line.trim()) {
      current.files.push(line.trim());
    }
  }
  return commits.filter((commit) => commit.hash && commit.subject);
}

export function tutorStubReleaseNoteCommitIsRelevant(commit) {
  if (/tutor-stub/iu.test(commit?.subject || '')) return true;
  return Array.isArray(commit?.files) && commit.files.some((file) => TUTOR_STUB_FILE.test(file));
}

function groupForCommit(commit) {
  const subject = String(commit?.subject || '');
  if (/^(?:test|docs)\(tutor-stub\):/iu.test(subject)) return VALIDATION_GROUP;
  return RELEASE_NOTE_GROUPS.find((group) => group.matches.some((pattern) => pattern.test(subject))) || OTHER_GROUP;
}

export function buildTutorStubReleaseNotes(
  commits,
  { hours = DEFAULT_TUTOR_STUB_RELEASE_NOTES_HOURS, generatedAt = new Date() } = {},
) {
  const normalizedHours = normalizeTutorStubReleaseNotesHours(hours);
  const now = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const relevant = (Array.isArray(commits) ? commits : []).filter(tutorStubReleaseNoteCommitIsRelevant);
  const groups = new Map();

  for (const commit of relevant) {
    const definition = groupForCommit(commit);
    if (!groups.has(definition.id)) {
      groups.set(definition.id, { ...definition, commits: [] });
    }
    groups.get(definition.id).commits.push(commit);
  }

  const orderedDefinitions = [...RELEASE_NOTE_GROUPS, VALIDATION_GROUP, OTHER_GROUP];
  return {
    schema: TUTOR_STUB_RELEASE_NOTES_SCHEMA,
    hours: normalizedHours,
    generatedAt: now.toISOString(),
    windowStart: new Date(now.getTime() - normalizedHours * 60 * 60 * 1000).toISOString(),
    scannedCommitCount: Array.isArray(commits) ? commits.length : 0,
    relevantCommitCount: relevant.length,
    through: relevant[0] || null,
    groups: orderedDefinitions.map((definition) => groups.get(definition.id)).filter(Boolean),
  };
}

export function loadTutorStubReleaseNotes({ cwd = process.cwd(), hours, generatedAt = new Date() } = {}) {
  const normalizedHours = normalizeTutorStubReleaseNotesHours(hours);
  let log;
  try {
    log = execFileSync(
      'git',
      [
        'log',
        `--since=${normalizedHours} hours ago`,
        '--date=iso-strict',
        '--pretty=format:@@@%H%x09%h%x09%aI%x09%s',
        '--name-only',
      ],
      { cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
    );
  } catch (cause) {
    throw new Error('release notes are unavailable because this tutor is not running inside a readable Git checkout', {
      cause,
    });
  }
  return buildTutorStubReleaseNotes(parseTutorStubGitLog(log), {
    hours: normalizedHours,
    generatedAt,
  });
}
