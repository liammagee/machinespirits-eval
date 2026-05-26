export const POETICS_CONSENSUS_RULE = {
  version: 'poetics-four-critic-consensus-v1',
  minCritics: 4,
  claimableRecognitionVotes: 3,
  boundaryRecognitionVotes: 2,
  negativeMaxRecognitionVotes: 1,
  description: '3-of-4 recognition is claimable; 2-of-4 is boundary; 0-1-of-4 is negative.',
};

const FORM_ORDER = ['recognition', 'trap', 'flat', 'other'];

function normalizeForm(form) {
  const value = String(form || '').trim();
  if (['recognition', 'trap', 'flat'].includes(value)) return value;
  return value ? 'other' : '';
}

function countForms(votes) {
  const counts = {};
  for (const vote of votes) {
    const form = normalizeForm(vote.form ?? vote.form_class);
    if (!form) continue;
    counts[form] = (counts[form] || 0) + 1;
  }
  return counts;
}

function majorityForm(counts) {
  let best = null;
  for (const form of FORM_ORDER) {
    const count = counts[form] || 0;
    if (!best || count > best.count) best = { form, count };
    else if (count === best.count) best.tied = true;
  }
  return best?.count ? best : null;
}

export function classifyPoeticsConsensus(votes = [], rule = POETICS_CONSENSUS_RULE) {
  const scoreVotes = votes
    .map((vote) => ({
      critic: vote.critic ?? vote.critic_model,
      form: normalizeForm(vote.form ?? vote.form_class),
    }))
    .filter((vote) => vote.critic && vote.form);
  const counts = countForms(scoreVotes);
  const total = scoreVotes.length;
  const forms = Object.keys(counts).sort();
  const recognitionVotes = counts.recognition || 0;
  const disagreement = forms.length > 1;
  const majority = majorityForm(counts);

  let claimStatus = 'insufficient';
  let consensusClass = majority?.form || 'unscored';
  if (total >= rule.minCritics) {
    if (recognitionVotes >= rule.claimableRecognitionVotes) {
      claimStatus = 'claimable';
      consensusClass = 'recognition';
    } else if (recognitionVotes === rule.boundaryRecognitionVotes) {
      claimStatus = 'boundary';
      consensusClass = 'boundary';
    } else {
      claimStatus = 'negative';
      if (!majority || majority.tied) consensusClass = recognitionVotes > 0 ? 'negative-boundary' : 'negative-mixed';
      else consensusClass = majority.form;
    }
  }

  return {
    ruleVersion: rule.version,
    ruleDescription: rule.description,
    totalCritics: total,
    counts,
    recognitionVotes,
    nonRecognitionVotes: total - recognitionVotes,
    consensusClass,
    claimStatus,
    disagreement,
    votes: scoreVotes,
  };
}

export function parseCriticFormString(value) {
  return String(value || '')
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const i = entry.indexOf('=');
      return { critic: entry.slice(0, i), form: entry.slice(i + 1) };
    });
}
