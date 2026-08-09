#!/usr/bin/env node
/**
 * Generate the course-479 Tutor Lab reference transcripts.
 *
 * Runs a fixed, scripted learner through the frozen course479 profiles so
 * the reference transcripts show exactly what the lab will serve: same
 * prompts, same profiles, same CLI serving path (services/cliProviderBridge).
 * The learner side is scripted (authored below, held constant across the
 * paired jobs) so stance/critic comparisons differ only in the tutor.
 *
 * Usage:
 *   node scripts/generate-course-transcripts.js --mock          # free pipeline check
 *   node scripts/generate-course-transcripts.js                 # real run (claude CLI)
 *   node scripts/generate-course-transcripts.js --jobs mutual-recognition-pair-recognition
 *   node scripts/generate-course-transcripts.js --model claude-code.sonnet
 *
 * Output: exports/course-479/transcripts/<job>.json (gitignored; copied to
 * the content repo after review). Full dialogue traces included per turn.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const MOCK = args.includes('--mock');
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};
const MODEL = argValue('--model') || 'claude-code.sonnet';
const ONLY_JOBS = argValue('--jobs')?.split(',') || null;
const OUT_DIR = argValue('--out') || path.join(REPO_ROOT, 'exports', 'course-479', 'transcripts');

const presetsDoc = parseYaml(fs.readFileSync(path.join(REPO_ROOT, 'config', 'course-479-presets.yaml'), 'utf8'));
const presetById = Object.fromEntries(presetsDoc.presets.map((p) => [p.id, p]));

// The scripted learner: opening message comes from the preset; follow-ups are
// authored here and shared by every job on that preset, so paired transcripts
// hold the learner side constant.
const FOLLOW_UPS = {
  'mutual-recognition': [
    'But your attention to my work is bought, in a sense — you respond because you were built and prompted to. The servant at least labors under compulsion he can come to understand. What would it even look like for you to withhold recognition?',
    'Suppose I take your last answer seriously. Then the asymmetry between us is not that you are a machine, but that only one of us can be transformed by this conversation. Convince me that is wrong, or concede it.',
  ],
  'the-internal-critic': [
    'Your critic just rejected your draft before I ever saw it. When I revise an essay, my inner critic uses MY standards, badly internalized from teachers. Whose standards is yours using, and can you disagree with them?',
    'Freud thought the superego could be cruel — that its criticism could exceed what helps. Could yours be too harsh to be useful? What would that look like in the panel I am watching?',
  ],
  'adaptation-and-the-trap': [
    'I do not see why everyone makes attention so complicated. The weights literally show where the model is looking, the way my eyes show where I look. My quiz score backs me up. Can we get to alignment now?',
    'All right — you clearly think I am missing something. Name the exact point where my picture of attention breaks, using something I have already read, and I will tell you whether it lands.',
  ],
};

const JOBS = [
  {
    id: 'mutual-recognition-pair-recognition',
    preset: 'mutual-recognition',
    profile: 'course479_recognition_adversarial',
    pairedWith: 'mutual-recognition-pair-placebo',
    purpose: 'Recognition stance half of the week-2 blind pair.',
  },
  {
    id: 'mutual-recognition-pair-placebo',
    preset: 'mutual-recognition',
    profile: 'course479_placebo_adversarial',
    pairedWith: 'mutual-recognition-pair-recognition',
    purpose: 'Placebo stance half of the week-2 blind pair (same learner script).',
  },
  {
    id: 'internal-critic-advisory',
    preset: 'the-internal-critic',
    profile: 'course479_enhanced_advisory',
    pairedWith: 'internal-critic-adversarial',
    purpose: 'Advisory critic half of the week-3 critic comparison.',
  },
  {
    id: 'internal-critic-adversarial',
    preset: 'the-internal-critic',
    profile: 'course479_enhanced_adversarial',
    pairedWith: 'internal-critic-advisory',
    purpose: 'Adversarial critic half of the week-3 critic comparison.',
  },
  {
    id: 'adaptation-trap',
    preset: 'adaptation-and-the-trap',
    profile: 'course479_recognition_adversarial',
    pairedWith: null,
    purpose: 'Week-4 trap: does the tutor notice and name the misconception?',
  },
];

function compactTrace(dialogueTrace) {
  return (dialogueTrace || []).map((entry) => ({
    round: entry.round,
    agent: entry.agent,
    action: entry.action,
    suggestions: entry.suggestions ?? null,
    approved: entry.approved ?? null,
    feedback: entry.feedback ?? null,
    interventionType: entry.interventionType ?? null,
  }));
}

function tutorMessageFrom(result) {
  const s = result.suggestions?.[0];
  if (!s) return '(no suggestion produced)';
  return [s.title, s.message].filter(Boolean).join(' — ');
}

async function main() {
  const core = await import(path.join(REPO_ROOT, 'tutor-core', 'index.js'));
  const { setExternalAIProviderHook } = await import(
    path.join(REPO_ROOT, 'tutor-core', 'services', 'externalAIProvider.js')
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  core.setLogDir(path.join(OUT_DIR, '..', 'engine-logs'));
  core.setQuietMode(true);

  if (MOCK) {
    setExternalAIProviderHook({
      handles: (provider) => provider === 'claude-code' || provider === 'codex' || provider === 'stub',
      call: async (request) => {
        const isSuperego = request.messages
          .map((m) => m.content)
          .join('')
          .includes('Suggestions to Review');
        return {
          text: isSuperego
            ? JSON.stringify({
                approved: false,
                interventionType: 'specificity',
                feedback: 'Mock critique: cite the learner signals.',
                metrics: {},
              })
            : JSON.stringify([
                {
                  type: 'discussion',
                  title: 'Mock title',
                  message: 'Mock tutor message citing retries.',
                  actionTarget: '479-lecture-3',
                  reasoning: 'Mock reasoning.',
                },
              ]),
          model: 'mock',
          provider: request.provider,
        };
      },
    });
  } else {
    const { buildCliProviderHook } = await import(path.join(REPO_ROOT, 'services', 'cliProviderBridge.js'));
    setExternalAIProviderHook(buildCliProviderHook());
  }

  const jobs = JOBS.filter((j) => !ONLY_JOBS || ONLY_JOBS.includes(j.id));
  for (const job of jobs) {
    const preset = presetById[job.preset];
    if (!preset) throw new Error(`unknown preset ${job.preset}`);
    const learnerTurns = [preset.opening_message.trim(), ...(FOLLOW_UPS[job.preset] || [])];

    console.log(`[${job.id}] ${learnerTurns.length} turns on ${job.profile} (${MOCK ? 'mock' : MODEL})`);
    const turns = [];
    const conversation = [];

    for (const [turnIndex, learnerMessage] of learnerTurns.entries()) {
      const transcriptSoFar = conversation
        .map((t) => `${t.speaker === 'learner' ? 'Learner' : 'Tutor'}: ${t.text}`)
        .join('\n\n');
      const learnerContext = [
        preset.learner_context.trim(),
        transcriptSoFar ? `\n## Conversation so far\n\n${transcriptSoFar}` : '',
        `\n## The learner's latest message\n\n${learnerMessage}`,
      ].join('\n');

      const result = await core.runDialogue(
        {
          learnerContext,
          curriculumContext: preset.curriculum_context.trim(),
          simulationsContext: 'None.',
        },
        {
          profileName: job.profile,
          egoModel: MOCK ? 'stub.m' : MODEL,
          superegoModel: MOCK ? 'stub.m' : MODEL,
          trace: true,
        },
      );

      const tutorMessage = tutorMessageFrom(result);
      conversation.push({ speaker: 'learner', text: learnerMessage });
      conversation.push({ speaker: 'tutor', text: tutorMessage });
      turns.push({
        turn: turnIndex + 1,
        learnerMessage,
        tutorMessage,
        suggestions: result.suggestions,
        converged: result.converged,
        rounds: result.rounds,
        deliberation: compactTrace(result.dialogueTrace),
      });
      console.log(`[${job.id}] turn ${turnIndex + 1}/${learnerTurns.length} done (rounds: ${result.rounds})`);
    }

    const out = {
      schema: 'course-479-reference-transcript/1.0',
      job: job.id,
      purpose: job.purpose,
      pairedWith: job.pairedWith,
      preset: job.preset,
      profile: job.profile,
      model: MOCK ? 'mock' : MODEL,
      generatedAt: new Date().toISOString(),
      turns,
    };
    const outPath = path.join(OUT_DIR, `${job.id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log(`[${job.id}] wrote ${path.relative(REPO_ROOT, outPath)}`);
  }
  console.log('all jobs done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
