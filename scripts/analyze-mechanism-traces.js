#!/usr/bin/env node

/**
 * Mechanism Process Trace Analysis
 *
 * Extracts process measures from dialogue traces to identify which mechanisms
 * produce the most behavioral change in tutor output. Works on existing data
 * without requiring new LLM calls.
 *
 * Process measures:
 *   1. Revision magnitude — how much does superego feedback change ego output?
 *   2. Self-reflection specificity — does the reflection reference actual learner behavior?
 *   3. Cross-turn adaptation — how different is the tutor's message between turns?
 *   4. Profile richness — detail and evolution of other-ego profiles
 *   5. Intersubjective coordination — agreement vs pushback between ego and superego
 *   6. Between-run variance — does the mechanism produce different outputs across runs?
 *
 * Usage:
 *   node scripts/analyze-mechanism-traces.js <runId> [options]
 *
 * Options:
 *   --output <path>    Output file path (default: exports/mechanism-traces-<runId>.md)
 *   --json             Also output JSON data
 *   --verbose          Print per-dialogue details
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');
const DB_PATH = path.resolve(__dirname, '..', 'data', 'evaluations.db');

// ── Text Similarity ─────────────────────────────────────────────────────

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function jaccardSimilarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function cosineSimilarity(a, b) {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const freqA = {};
  const freqB = {};
  tokensA.forEach(t => { freqA[t] = (freqA[t] || 0) + 1; });
  tokensB.forEach(t => { freqB[t] = (freqB[t] || 0) + 1; });

  const allTokens = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
  let dot = 0, magA = 0, magB = 0;
  for (const t of allTokens) {
    const va = freqA[t] || 0;
    const vb = freqB[t] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function editDistance(a, b) {
  // Normalized Levenshtein on words (not chars) for efficiency
  const wa = tokenize(a);
  const wb = tokenize(b);
  if (wa.length === 0 && wb.length === 0) return 0;
  if (wa.length === 0 || wb.length === 0) return 1;

  // Use only first 200 words to avoid O(n^2) blowup
  const sa = wa.slice(0, 200);
  const sb = wb.slice(0, 200);

  const m = sa.length;
  const n = sb.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = sa[i - 1] === sb[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n] / Math.max(m, n);
}

// ── Mechanism Detection ─────────────────────────────────────────────────

function detectMechanism(profileName) {
  if (!profileName) return 'unknown';
  const name = profileName.toLowerCase();
  if (name.includes('_combined')) return 'combined';
  if (name.includes('_quantitative')) return 'quantitative';
  if (name.includes('_erosion')) return 'erosion';
  if (name.includes('_intersubjective')) return 'intersubjective';
  if (name.includes('_profile_bidirectional_full')) return 'profile_bidir_full';
  if (name.includes('_profile_bidirectional_strategy')) return 'profile_bidir_strategy';
  if (name.includes('_profile_bidirectional')) return 'profile_bidirectional';
  if (name.includes('_profile_tutor')) return 'profile_tutor';
  if (name.includes('_advocate')) return 'advocate';
  if (name.includes('_adversary')) return 'adversary';
  if (name.includes('_selfreflect')) return 'self_reflection';
  if (name.includes('_suspicious') && name.includes('_superego')) return 'self_reflection';
  if (name.includes('_suspicious')) return 'suspicious';
  return 'unknown';
}

function isRecognition(profileName) {
  return profileName?.includes('recog') || false;
}

// ── Measure 1: Ego Revision Magnitude ───────────────────────────────────

function measureRevisionMagnitude(trace) {
  const results = [];
  // Group by round pairs: generate at round N, revise at round N+1
  const generates = trace.filter(e => e.agent === 'ego' && e.action === 'generate');
  const revisions = trace.filter(e => e.agent === 'ego' && e.action === 'revise');

  for (const gen of generates) {
    const genMsg = gen.suggestions?.[0]?.message || '';
    // Find the revision that follows this generation (same or next round)
    const rev = revisions.find(r => r.round >= gen.round);
    if (!rev) continue;
    const revMsg = rev.suggestions?.[0]?.message || '';
    if (!genMsg || !revMsg) continue;

    results.push({
      round: gen.round,
      jaccard: 1 - jaccardSimilarity(genMsg, revMsg),
      cosine: 1 - cosineSimilarity(genMsg, revMsg),
      editDist: editDistance(genMsg, revMsg),
      genLength: tokenize(genMsg).length,
      revLength: tokenize(revMsg).length,
    });
  }
  return results;
}

// ── Measure 2: Self-Reflection Specificity ──────────────────────────────

const LEARNER_SPECIFIC_PATTERNS = [
  /the learner/gi, /they said/gi, /they asked/gi, /their (?:question|response|point|insight|critique)/gi,
  /the student/gi, /learner's/gi, /their (?:argument|claim|objection)/gi,
  /you (?:said|asked|raised|pointed|mentioned|noted)/gi,
  /your (?:question|response|point|insight|critique|argument|claim)/gi,
  /specific(?:ally)/gi, /in this case/gi, /this particular/gi,
  /when they/gi, /after they/gi, /because they/gi,
];

const GENERIC_PEDAGOGY_PATTERNS = [
  /in general/gi, /typically/gi, /usually/gi, /always/gi,
  /best practice/gi, /should (?:always|generally|typically)/gi,
  /it's important to/gi, /one should/gi, /a good (?:tutor|teacher)/gi,
  /pedagogical(?:ly)?/gi, /scaffolding/gi, /next time/gi,
];

function measureReflectionSpecificity(trace) {
  const reflections = trace.filter(e =>
    e.agent === 'ego_self_reflection' || e.agent === 'superego_self_reflection'
  );

  return reflections.map(r => {
    const text = r.detail || '';
    const words = tokenize(text).length;

    let specificCount = 0;
    for (const p of LEARNER_SPECIFIC_PATTERNS) {
      const matches = text.match(p);
      specificCount += matches ? matches.length : 0;
    }

    let genericCount = 0;
    for (const p of GENERIC_PEDAGOGY_PATTERNS) {
      const matches = text.match(p);
      genericCount += matches ? matches.length : 0;
    }

    const total = specificCount + genericCount;
    return {
      agent: r.agent,
      turnIndex: r.turnIndex ?? -1,
      wordCount: words,
      specificCount,
      genericCount,
      specificityRatio: total > 0 ? specificCount / total : 0,
    };
  });
}

// ── Measure 3: Cross-Turn Adaptation ────────────────────────────────────

function measureCrossTurnAdaptation(trace) {
  // Find final suggestions per turn (last ego revise or generate before final_output/turn_action)
  const finalOutputs = [];
  let currentTurnSuggestions = null;
  let currentTurnIndex = -1;

  for (const entry of trace) {
    if (entry.agent === 'ego' && (entry.action === 'generate' || entry.action === 'revise')) {
      const msg = entry.suggestions?.[0]?.message;
      if (msg) {
        // Track turn index from nearby entries
        const turnIdx = entry.turnIndex ?? currentTurnIndex;
        currentTurnSuggestions = { message: msg, turnIndex: turnIdx, round: entry.round };
      }
    }
    if (entry.action === 'final_output' || entry.action === 'turn_action') {
      if (currentTurnSuggestions) {
        finalOutputs.push(currentTurnSuggestions);
        currentTurnSuggestions = null;
      }
      if (entry.action === 'turn_action') {
        currentTurnIndex++;
      }
    }
  }
  // Catch last turn if no final_output marker
  if (currentTurnSuggestions) {
    finalOutputs.push(currentTurnSuggestions);
  }

  const adaptations = [];
  for (let i = 1; i < finalOutputs.length; i++) {
    const prev = finalOutputs[i - 1].message;
    const curr = finalOutputs[i].message;
    adaptations.push({
      fromTurn: i - 1,
      toTurn: i,
      jaccard: 1 - jaccardSimilarity(prev, curr),
      cosine: 1 - cosineSimilarity(prev, curr),
      editDist: editDistance(prev, curr),
    });
  }
  return adaptations;
}

// ── Measure 4: Profile Richness & Evolution ─────────────────────────────

function measureProfileRichness(trace) {
  const profiles = trace.filter(e =>
    e.agent === 'tutor_other_ego' || e.agent === 'learner_other_ego'
  );

  if (profiles.length === 0) return { profiles: [], evolution: [] };

  const profileData = profiles.map(p => {
    const text = p.detail || '';
    const words = tokenize(text).length;
    // Count dimensions mentioned (numbered sections or bold headers)
    const dimensions = (text.match(/\*\*\d+\./g) || []).length;
    // Check for prediction
    const hasPrediction = /prediction/i.test(text);
    // Check for confidence
    const hasConfidence = /confidence/i.test(text);
    // Check for [REVISED] markers
    const revisedCount = (text.match(/\[REVISED\]/g) || []).length;

    return {
      agent: p.agent,
      turnIndex: p.turnIndex ?? -1,
      wordCount: words,
      dimensions,
      hasPrediction,
      hasConfidence,
      revisedCount,
    };
  });

  // Measure evolution between consecutive profiles of same agent
  const evolution = [];
  const byAgent = {};
  for (const p of profiles) {
    if (!byAgent[p.agent]) byAgent[p.agent] = [];
    byAgent[p.agent].push(p);
  }
  for (const [agent, agentProfiles] of Object.entries(byAgent)) {
    agentProfiles.sort((a, b) => (a.turnIndex ?? 0) - (b.turnIndex ?? 0));
    for (let i = 1; i < agentProfiles.length; i++) {
      const prev = agentProfiles[i - 1].detail || '';
      const curr = agentProfiles[i].detail || '';
      evolution.push({
        agent,
        fromTurn: agentProfiles[i - 1].turnIndex ?? i - 1,
        toTurn: agentProfiles[i].turnIndex ?? i,
        editDist: editDistance(prev, curr),
        cosine: 1 - cosineSimilarity(prev, curr),
      });
    }
  }

  return { profiles: profileData, evolution };
}

// ── Measure 5: Intersubjective Coordination ─────────────────────────────

const AGREEMENT_MARKERS = [
  /i agree/gi, /you're right/gi, /fair point/gi, /well said/gi,
  /exactly/gi, /that's true/gi, /good catch/gi, /you're correct/gi,
  /i'm relieved/gi, /helpful/gi,
];

const DISAGREEMENT_MARKERS = [
  /i(?:'d| would) push back/gi, /i disagree/gi, /where i(?:'d| would) challenge/gi,
  /but i think/gi, /i(?:'d| would) argue/gi, /that's not quite/gi,
  /i(?:'m| am) not sure/gi, /overcorrect/gi, /too (?:strict|harsh|rigid)/gi,
  /missed the point/gi, /doesn't capture/gi, /oversimplif/gi,
];

function measureIntersubjectiveCoordination(trace) {
  const responses = trace.filter(e => e.agent === 'ego_intersubjective');

  return responses.map(r => {
    const text = r.detail || '';
    const words = tokenize(text).length;

    let agreeCount = 0;
    for (const p of AGREEMENT_MARKERS) {
      const matches = text.match(p);
      agreeCount += matches ? matches.length : 0;
    }

    let disagreeCount = 0;
    for (const p of DISAGREEMENT_MARKERS) {
      const matches = text.match(p);
      disagreeCount += matches ? matches.length : 0;
    }

    const total = agreeCount + disagreeCount;
    return {
      turnIndex: r.turnIndex ?? -1,
      wordCount: words,
      agreeCount,
      disagreeCount,
      disagreementRatio: total > 0 ? disagreeCount / total : 0,
    };
  });
}

// ── Measure 6: Behavioral Parameter Evolution ───────────────────────────

function measureBehavioralEvolution(trace) {
  const overrides = trace.filter(e => e.agent === 'behavioral_overrides');

  const parsed = overrides.map(o => {
    try {
      const params = JSON.parse(o.detail);
      return {
        turnIndex: o.turnIndex ?? -1,
        rejectionThreshold: params.rejection_threshold,
        maxRejections: params.max_rejections,
        priorityCriteria: params.priority_criteria || [],
        deprioritizedCriteria: params.deprioritized_criteria || [],
      };
    } catch {
      return null;
    }
  }).filter(Boolean);

  const evolution = [];
  for (let i = 1; i < parsed.length; i++) {
    const prev = parsed[i - 1];
    const curr = parsed[i];
    const prioChange = new Set([
      ...curr.priorityCriteria.filter(c => !prev.priorityCriteria.includes(c)),
      ...prev.priorityCriteria.filter(c => !curr.priorityCriteria.includes(c)),
    ]).size;

    evolution.push({
      fromTurn: prev.turnIndex,
      toTurn: curr.turnIndex,
      thresholdDelta: curr.rejectionThreshold - prev.rejectionThreshold,
      priorityCriteriaChanged: prioChange,
    });
  }

  return { params: parsed, evolution };
}

// ── Data Loading ────────────────────────────────────────────────────────

function loadDialogueTrace(dialogueId) {
  if (!dialogueId) return null;
  const files = fs.readdirSync(LOGS_DIR).filter(f => f.includes(dialogueId));
  if (files.length === 0) return null;

  try {
    const data = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf-8'));
    return data.dialogueTrace || [];
  } catch {
    return null;
  }
}

// ── Aggregation ─────────────────────────────────────────────────────────

function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function sd(arr) {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1));
}

function aggregateMeasures(allMeasures) {
  const groups = {};
  for (const m of allMeasures) {
    const key = `${m.mechanism}|${m.condition}`;
    if (!groups[key]) {
      groups[key] = { mechanism: m.mechanism, condition: m.condition, measures: [] };
    }
    groups[key].measures.push(m);
  }

  const summary = [];
  for (const [, group] of Object.entries(groups)) {
    const measures = group.measures;
    const n = measures.length;

    // Revision magnitude
    const revisions = measures.flatMap(m => m.revisionMagnitude);
    const revEditDists = revisions.map(r => r.editDist);

    // Self-reflection specificity
    const reflections = measures.flatMap(m => m.reflectionSpecificity);
    const egoReflections = reflections.filter(r => r.agent === 'ego_self_reflection');
    const superegoReflections = reflections.filter(r => r.agent === 'superego_self_reflection');

    // Cross-turn adaptation
    const adaptations = measures.flatMap(m => m.crossTurnAdaptation);
    const adaptEditDists = adaptations.map(a => a.editDist);

    // Profile richness
    const profiles = measures.flatMap(m => m.profileRichness.profiles);
    const profileEvolutions = measures.flatMap(m => m.profileRichness.evolution);

    // Intersubjective
    const intersubjective = measures.flatMap(m => m.intersubjectiveCoordination);

    // Behavioral
    const behavioralEvolutions = measures.flatMap(m => m.behavioralEvolution.evolution);

    // Between-run variance of final output
    const _finalMessages = measures.map(m => {
      // Get last ego suggestion message
      const revs = m.revisionMagnitude;
      return revs.length > 0 ? revs[revs.length - 1] : null;
    }).filter(Boolean);

    // Pairwise cosine distances between runs
    const pairwiseDists = [];
    for (let i = 0; i < measures.length; i++) {
      for (let j = i + 1; j < measures.length; j++) {
        const mi = measures[i].finalMessage;
        const mj = measures[j].finalMessage;
        if (mi && mj) {
          pairwiseDists.push(1 - cosineSimilarity(mi, mj));
        }
      }
    }

    summary.push({
      mechanism: group.mechanism,
      condition: group.condition,
      n,
      revision: {
        count: revisions.length,
        avgEditDist: avg(revEditDists),
        sdEditDist: sd(revEditDists),
      },
      egoReflection: {
        count: egoReflections.length,
        avgSpecificity: avg(egoReflections.map(r => r.specificityRatio)),
        avgWordCount: avg(egoReflections.map(r => r.wordCount)),
      },
      superegoReflection: {
        count: superegoReflections.length,
        avgSpecificity: avg(superegoReflections.map(r => r.specificityRatio)),
        avgWordCount: avg(superegoReflections.map(r => r.wordCount)),
      },
      adaptation: {
        count: adaptations.length,
        avgEditDist: avg(adaptEditDists),
        sdEditDist: sd(adaptEditDists),
      },
      profiles: {
        count: profiles.length,
        avgWordCount: avg(profiles.map(p => p.wordCount)),
        avgDimensions: avg(profiles.map(p => p.dimensions)),
        evolutionCount: profileEvolutions.length,
        avgEvolutionDist: avg(profileEvolutions.map(e => e.editDist)),
      },
      intersubjective: {
        count: intersubjective.length,
        avgDisagreement: avg(intersubjective.map(i => i.disagreementRatio)),
        avgWordCount: avg(intersubjective.map(i => i.wordCount)),
      },
      behavioral: {
        evolutionCount: behavioralEvolutions.length,
        avgThresholdDelta: avg(behavioralEvolutions.map(e => e.thresholdDelta)),
        avgCriteriaChanged: avg(behavioralEvolutions.map(e => e.priorityCriteriaChanged)),
      },
      betweenRunVariance: {
        pairCount: pairwiseDists.length,
        avgPairwiseDist: avg(pairwiseDists),
      },
    });
  }

  return summary.sort((a, b) => a.mechanism.localeCompare(b.mechanism) || a.condition.localeCompare(b.condition));
}

// ── Report Generation ───────────────────────────────────────────────────

function generateReport(runId, summary, allMeasures) {
  const lines = [];
  lines.push(`# Mechanism Process Trace Analysis: ${runId}`);
  lines.push(`\nGenerated: ${new Date().toISOString()}`);
  lines.push(`\nTotal dialogues analyzed: ${allMeasures.length}`);

  // Overview table
  lines.push('\n## Summary by Mechanism × Condition\n');
  lines.push('| Mechanism | Cond | N | Rev Δ | Ego Spec | SE Spec | Adapt Δ | Profile WC | Intersub Disagree | Run Var |');
  lines.push('|-----------|------|---|-------|----------|---------|---------|------------|-------------------|---------|');

  for (const s of summary) {
    lines.push([
      '',
      s.mechanism,
      s.condition,
      s.n,
      s.revision.count > 0 ? s.revision.avgEditDist.toFixed(3) : '—',
      s.egoReflection.count > 0 ? s.egoReflection.avgSpecificity.toFixed(2) : '—',
      s.superegoReflection.count > 0 ? s.superegoReflection.avgSpecificity.toFixed(2) : '—',
      s.adaptation.count > 0 ? s.adaptation.avgEditDist.toFixed(3) : '—',
      s.profiles.count > 0 ? s.profiles.avgWordCount.toFixed(0) : '—',
      s.intersubjective.count > 0 ? s.intersubjective.avgDisagreement.toFixed(2) : '—',
      s.betweenRunVariance.pairCount > 0 ? s.betweenRunVariance.avgPairwiseDist.toFixed(3) : '—',
      '',
    ].join(' | '));
  }

  // Column legend
  lines.push('\n**Column key:**');
  lines.push('- **Rev Δ**: Avg normalized edit distance between ego generate → revise (0=identical, 1=completely different)');
  lines.push('- **Ego Spec**: Ego self-reflection specificity ratio (learner-specific / total references)');
  lines.push('- **SE Spec**: Superego self-reflection specificity ratio');
  lines.push('- **Adapt Δ**: Avg cross-turn adaptation (edit distance between consecutive turn outputs)');
  lines.push('- **Profile WC**: Avg word count of other-ego profiles');
  lines.push('- **Intersub Disagree**: Avg disagreement ratio in intersubjective responses');
  lines.push('- **Run Var**: Avg pairwise cosine distance between runs (higher = more between-run variance)');

  // Detailed sections
  lines.push('\n## Revision Magnitude by Mechanism\n');
  lines.push('How much does superego feedback actually change the ego\'s output?\n');
  for (const s of summary) {
    if (s.revision.count === 0) continue;
    lines.push(`- **${s.mechanism}** (${s.condition}): edit_dist=${s.revision.avgEditDist.toFixed(3)} ±${s.revision.sdEditDist.toFixed(3)} (N=${s.revision.count})`);
  }

  lines.push('\n## Self-Reflection Specificity\n');
  lines.push('Does the reflection reference actual learner behavior (specific) or generic pedagogy?\n');
  for (const s of summary) {
    if (s.egoReflection.count === 0) continue;
    lines.push(`- **${s.mechanism}** (${s.condition}): ego_specificity=${s.egoReflection.avgSpecificity.toFixed(2)}, ` +
      `superego_specificity=${s.superegoReflection.avgSpecificity.toFixed(2)}, ` +
      `ego_words=${s.egoReflection.avgWordCount.toFixed(0)}, superego_words=${s.superegoReflection.avgWordCount.toFixed(0)}`);
  }

  lines.push('\n## Cross-Turn Adaptation\n');
  lines.push('How much does the tutor\'s output change between turns?\n');
  for (const s of summary) {
    if (s.adaptation.count === 0) continue;
    lines.push(`- **${s.mechanism}** (${s.condition}): edit_dist=${s.adaptation.avgEditDist.toFixed(3)} ±${s.adaptation.sdEditDist.toFixed(3)} (N=${s.adaptation.count})`);
  }

  lines.push('\n## Profile Richness & Evolution\n');
  lines.push('How detailed are other-ego profiles and how much do they change?\n');
  for (const s of summary) {
    if (s.profiles.count === 0) continue;
    lines.push(`- **${s.mechanism}** (${s.condition}): avg_words=${s.profiles.avgWordCount.toFixed(0)}, ` +
      `avg_dimensions=${s.profiles.avgDimensions.toFixed(1)}, ` +
      `evolution_dist=${s.profiles.avgEvolutionDist.toFixed(3)} (N_profiles=${s.profiles.count}, N_evolutions=${s.profiles.evolutionCount})`);
  }

  lines.push('\n## Intersubjective Coordination\n');
  lines.push('Does the ego agree with or push back against the superego?\n');
  for (const s of summary) {
    if (s.intersubjective.count === 0) continue;
    lines.push(`- **${s.mechanism}** (${s.condition}): disagreement=${s.intersubjective.avgDisagreement.toFixed(2)}, ` +
      `avg_words=${s.intersubjective.avgWordCount.toFixed(0)} (N=${s.intersubjective.count})`);
  }

  lines.push('\n## Between-Run Variance\n');
  lines.push('Does the mechanism produce different outputs across runs of the same cell?\n');
  for (const s of summary) {
    if (s.betweenRunVariance.pairCount === 0) continue;
    lines.push(`- **${s.mechanism}** (${s.condition}): avg_pairwise_cosine_dist=${s.betweenRunVariance.avgPairwiseDist.toFixed(3)} (${s.betweenRunVariance.pairCount} pairs)`);
  }

  lines.push('\n## Interpretation Guide\n');
  lines.push('A mechanism that matters should show:');
  lines.push('1. **High revision magnitude** — superego feedback actually changes output');
  lines.push('2. **High specificity** — reflections reference THIS learner, not generic pedagogy');
  lines.push('3. **High cross-turn adaptation** — tutor genuinely changes approach between turns');
  lines.push('4. **Profile evolution** — profiles update with new information each turn');
  lines.push('5. **Productive disagreement** — ego pushes back on superego, not just complying');
  lines.push('6. **High between-run variance** — mechanism is context-sensitive, not formulaic');
  lines.push('\nA mechanism that doesn\'t matter shows low/uniform values across all measures.');

  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const runId = args.find(a => !a.startsWith('--'));
  if (!runId) {
    console.error('Usage: node scripts/analyze-mechanism-traces.js <runId> [--output <path>] [--json] [--verbose]');
    process.exit(1);
  }

  const outputPath = args.includes('--output')
    ? args[args.indexOf('--output') + 1]
    : `exports/mechanism-traces-${runId}.md`;
  const outputJson = args.includes('--json');
  const verbose = args.includes('--verbose');

  const db = new Database(DB_PATH, { readonly: true });

  // Load multi-turn results with dialogue IDs
  const rows = db.prepare(`
    SELECT id, scenario_id, profile_name, overall_score, dialogue_id, dialogue_rounds
    FROM evaluation_results
    WHERE run_id = ? AND success = 1 AND dialogue_id IS NOT NULL
    ORDER BY profile_name, scenario_id
  `).all(runId);

  console.log(`Found ${rows.length} multi-turn dialogues for ${runId}`);

  if (rows.length === 0) {
    console.error('No multi-turn dialogues found. This script requires multi-turn data with dialogue traces.');
    process.exit(1);
  }

  const allMeasures = [];
  let loaded = 0;
  let skipped = 0;

  for (const row of rows) {
    const trace = loadDialogueTrace(row.dialogue_id);
    if (!trace || trace.length === 0) {
      skipped++;
      continue;
    }
    loaded++;

    const mechanism = detectMechanism(row.profile_name);
    const condition = isRecognition(row.profile_name) ? 'recog' : 'base';

    const revisionMagnitude = measureRevisionMagnitude(trace);
    const reflectionSpecificity = measureReflectionSpecificity(trace);
    const crossTurnAdaptation = measureCrossTurnAdaptation(trace);
    const profileRichness = measureProfileRichness(trace);
    const intersubjectiveCoordination = measureIntersubjectiveCoordination(trace);
    const behavioralEvolution = measureBehavioralEvolution(trace);

    // Get final message for between-run variance
    const lastRevision = [...trace].reverse().find(e =>
      e.agent === 'ego' && (e.action === 'revise' || e.action === 'generate')
    );
    const finalMessage = lastRevision?.suggestions?.[0]?.message || '';

    const measures = {
      dialogueId: row.dialogue_id,
      profileName: row.profile_name,
      scenarioId: row.scenario_id,
      score: row.overall_score,
      mechanism,
      condition,
      revisionMagnitude,
      reflectionSpecificity,
      crossTurnAdaptation,
      profileRichness,
      intersubjectiveCoordination,
      behavioralEvolution,
      finalMessage,
    };

    allMeasures.push(measures);

    if (verbose) {
      console.log(`  ${row.profile_name} | ${row.scenario_id} | ` +
        `rev=${revisionMagnitude.length} refl=${reflectionSpecificity.length} ` +
        `adapt=${crossTurnAdaptation.length} prof=${profileRichness.profiles.length} ` +
        `inter=${intersubjectiveCoordination.length}`);
    }
  }

  console.log(`Loaded: ${loaded}, Skipped (no trace): ${skipped}`);

  // Aggregate
  const summary = aggregateMeasures(allMeasures);

  // Generate report
  const report = generateReport(runId, summary, allMeasures);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(outputPath, report);
  console.log(`\nReport written to: ${outputPath}`);

  if (outputJson) {
    const jsonPath = outputPath.replace(/\.md$/, '.json');
    // Remove finalMessage from JSON output (too large)
    const cleanMeasures = allMeasures.map(m => {
      const { finalMessage: _finalMessage, ...rest } = m;
      return rest;
    });
    fs.writeFileSync(jsonPath, JSON.stringify({ runId, summary, measures: cleanMeasures }, null, 2));
    console.log(`JSON written to: ${jsonPath}`);
  }

  // Print quick summary to console
  console.log('\n── Quick Summary ──────────────────────────────────────');
  console.log(`${'Mechanism'.padEnd(25)} ${'Cond'.padEnd(6)} ${'N'.padEnd(4)} ${'RevΔ'.padEnd(7)} ${'EgoSpec'.padEnd(8)} ${'AdaptΔ'.padEnd(7)} ${'RunVar'.padEnd(7)}`);
  console.log('─'.repeat(70));
  for (const s of summary) {
    console.log([
      s.mechanism.padEnd(25),
      s.condition.padEnd(6),
      String(s.n).padEnd(4),
      s.revision.count > 0 ? s.revision.avgEditDist.toFixed(3).padEnd(7) : '—'.padEnd(7),
      s.egoReflection.count > 0 ? s.egoReflection.avgSpecificity.toFixed(2).padEnd(8) : '—'.padEnd(8),
      s.adaptation.count > 0 ? s.adaptation.avgEditDist.toFixed(3).padEnd(7) : '—'.padEnd(7),
      s.betweenRunVariance.pairCount > 0 ? s.betweenRunVariance.avgPairwiseDist.toFixed(3) : '—',
    ].join(' '));
  }

  db.close();
}

main();
