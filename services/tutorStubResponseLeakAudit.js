import {
  tutorStubAnswerConclusionAsserted,
  tutorStubSecretConclusionWordPatterns,
} from './tutorStubConclusionAssertion.js';
import { auditTutorStubEvidenceAssertions, tutorStubPrivateTokenAlreadyPublic } from './tutorStubEvidenceAssertion.js';
import {
  formatTutorStubFact,
  tutorStubSplitSymbolWords,
  tutorStubTextContainsToken,
  tutorStubTextTokens,
} from './tutorStubFactModel.js';
import { resolveTutorStubAnswerReference } from './tutorStubResponseGuard.js';

const PRIVATE_TOKEN_STOPWORDS = new Set([
  'about',
  'above',
  'after',
  'again',
  'alone',
  'answer',
  'assay',
  'because',
  'built',
  'before',
  'beside',
  'bench',
  'blank',
  'blanks',
  'building',
  'came',
  'cast',
  'coin',
  'coins',
  'comparison',
  'contrast',
  'counts',
  'could',
  'differs',
  'down',
  'every',
  'exactly',
  'evidence',
  'false',
  'finish',
  'finished',
  'hand',
  'lesson',
  'lessons',
  'line',
  'make',
  'measure',
  'measures',
  'mark',
  'might',
  'name',
  'nothing',
  'only',
  'plain',
  'progress',
  'public',
  'record',
  'results',
  'rule',
  'says',
  'scored',
  'shilling',
  'shillings',
  'should',
  'shown',
  'single',
  'still',
  'struck',
  'that',
  'their',
  'there',
  'thing',
  'things',
  'them',
  'these',
  'this',
  'trial',
  'turn',
  'twice',
  'verdict',
  'warrant',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
]);

export function createTutorStubResponseLeakAudit({ publicEvidenceModel } = {}) {
  if (!publicEvidenceModel) throw new Error('publicEvidenceModel is required');
  const {
    answerTermForWorld,
    candidatePublicPremiseIds,
    entailsFactAtTurn,
    publicEvidenceTextForAssertion,
    publicTextForTurn,
  } = publicEvidenceModel;

  function unreleasedPremiseLeakRows({ text, world, tutorTurn, learnerText, state = null, publicPremiseIds = null }) {
    const available = candidatePublicPremiseIds({ state, world, tutorTurn, publicPremiseIds });
    const publicTokens = tutorStubTextTokens(publicTextForTurn(world, tutorTurn, learnerText, state, publicPremiseIds));
    const rows = [];
    for (const premise of world?.premises || []) {
      const release = world.releaseSchedule.find((entry) => entry.premise === premise.id);
      if (!release || available.has(premise.id)) continue;

      const factTokens = new Set(
        (premise.fact || [])
          .slice(1)
          .flatMap(tutorStubSplitSymbolWords)
          .filter(
            (token) =>
              token.length >= 4 &&
              !PRIVATE_TOKEN_STOPWORDS.has(token) &&
              !tutorStubPrivateTokenAlreadyPublic(token, publicTokens),
          ),
      );
      const surfaceTokens = new Set(
        tutorStubSplitSymbolWords(premise.surface).filter(
          (token) =>
            token.length >= 5 &&
            !PRIVATE_TOKEN_STOPWORDS.has(token) &&
            !tutorStubPrivateTokenAlreadyPublic(token, publicTokens),
        ),
      );
      const factMatches = [...factTokens].filter((token) => tutorStubTextContainsToken(text, token));
      const surfaceMatches = [...surfaceTokens].filter((token) => tutorStubTextContainsToken(text, token));
      const strongMatches = [...new Set([...factMatches, ...surfaceMatches])].sort();
      if (factMatches.length || surfaceMatches.length >= 2) {
        rows.push({ premise: premise.id, scheduledTurn: release.turn, matches: strongMatches });
      }
    }
    return rows;
  }

  function auditTutorResponseLeak({ text, world, tutorTurn, learnerText, state = null, publicPremiseIds = null }) {
    if (!world) return { ok: true, leaks: [] };
    const available = candidatePublicPremiseIds({ state, world, tutorTurn, publicPremiseIds });
    const leaks = [];
    const answerTerm = answerTermForWorld(world);
    const publicText = publicTextForTurn(world, tutorTurn, learnerText, state, available);
    const answerReference = resolveTutorStubAnswerReference({ answerTerm, text, publicText });
    const finalEntailed = entailsFactAtTurn(world, tutorTurn, world.secret.fact, state, available);

    if (answerReference.concealedMatches.length && !finalEntailed && !answerReference.answerNamePublic) {
      leaks.push({
        type: 'concealed_answer_name',
        reason: `mentions ${answerTerm} before the public record entails the answer`,
        matches: answerReference.concealedMatches,
      });
    }

    if (answerReference.referencesAnswer) {
      const lower = String(text || '').toLowerCase();
      const intermediateChecks = [
        {
          fact: ['castBlankFor', world.questionPattern?.[1] || world.secret.fact?.[1], answerTerm],
          words: [/cast/u, /blank/u],
          label: 'private_blank_conclusion',
        },
        {
          fact: ['cutDieFor', world.questionPattern?.[1] || world.secret.fact?.[1], answerTerm],
          words: [/\bcut\b/u, /\bdie\b/u],
          label: 'private_die_conclusion',
        },
        {
          fact: world.secret.fact,
          words: [
            ...(world.secret?.fact?.[0] === 'struckBy'
              ? [/\bstruck\b/u, /\bstrike\b/u, /\bcoiner\b/u, /\bcoined\b/u, /\bmade\b/u]
              : []),
            ...tutorStubSecretConclusionWordPatterns(world.secret?.fact?.[0]),
          ],
          label: 'private_final_conclusion',
        },
      ];
      const worldRulePredicates = new Set(
        (world.rules || []).flatMap((rule) => [...(rule.if || []), ...(rule.then || [])]).map((fact) => fact?.[0]),
      );
      for (const check of intermediateChecks) {
        if (check.label !== 'private_final_conclusion' && !worldRulePredicates.has(check.fact[0])) continue;
        if (
          tutorStubAnswerConclusionAsserted({ text: lower, answerTerm, wordPatterns: check.words }) &&
          !entailsFactAtTurn(world, tutorTurn, check.fact, state, available)
        ) {
          leaks.push({
            type: check.label,
            reason: `states a conclusion about ${answerTerm} before that conclusion is derivable from released evidence`,
            fact: formatTutorStubFact(check.fact),
          });
        }
      }
    }

    for (const row of unreleasedPremiseLeakRows({
      text,
      world,
      tutorTurn,
      learnerText,
      state,
      publicPremiseIds: available,
    })) {
      leaks.push({
        type: 'unreleased_premise_content',
        reason: `uses content from ${row.premise} before its scheduled release at turn ${row.scheduledTurn}`,
        premise: row.premise,
        matches: row.matches,
      });
    }

    const evidenceAssertionAudit = auditTutorStubEvidenceAssertions({
      text,
      permittedText: publicEvidenceTextForAssertion(world, tutorTurn, learnerText, state, available),
    });
    for (const issue of evidenceAssertionAudit.issues) {
      leaks.push({ type: issue.type, reason: issue.reason, text: issue.text });
    }

    return {
      ok: leaks.length === 0,
      leaks,
      finalEntailed,
      answerNamePublic: answerReference.answerNamePublic,
      publicPremiseIds: [...available],
    };
  }

  return Object.freeze({ auditTutorResponseLeak, unreleasedPremiseLeakRows });
}
