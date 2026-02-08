
import { jsonrepair } from 'jsonrepair';

function repairUnescapedQuotes(jsonStr) {
  let result = '';
  let i = 0;
  const len = jsonStr.length;
  while (i < len) {
    const ch = jsonStr[i];
    if (ch === '"') {
      result += '"';
      i++;
      while (i < len) {
        const c = jsonStr[i];
        if (c === '\\') {
          result += jsonStr[i] + (jsonStr[i + 1] || '');
          i += 2;
          continue;
        }
        if (c === '"') {
          const after = jsonStr.slice(i + 1).trimStart();
          if (after[0] === ':' || after[0] === ',' || after[0] === '}' || after[0] === ']' || after.length === 0) {
            result += '"';
            i++;
            break;
          } else {
            result += "'";
            i++;
            continue;
          }
        }
        result += c;
        i++;
      }
    } else {
      result += ch;
      i++;
    }
  }
  return result;
}

function regexScoreRescue(text) {
  const dimensionNames = [
    'relevance', 'specificity', 'pedagogical_soundness', 'personalization',
    'actionability', 'tone', 'mutual_recognition', 'dialectical_responsiveness',
    'memory_integration', 'transformative_potential',
  ];
  const scores = {};
  for (const dim of dimensionNames) {
    const pattern = new RegExp(`"${dim}"\\s*:\\s*\\{?\\s*"?score"?\\s*:\\s*(\\d)`, 'i');
    const match = text.match(pattern);
    if (match) {
      scores[dim] = { score: parseInt(match[1], 10), reasoning: null };
    }
  }
  if (Object.keys(scores).length < 3) return null;
  const overallMatch = text.match(/"overall_score"\s*:\s*(\d+)/);
  const summaryMatch = text.match(/"summary"\s*:\s*"([^"]+)"/);
  return {
    scores,
    validation: { passes_required: true, required_missing: [], passes_forbidden: true, forbidden_found: [] },
    overall_score: overallMatch ? parseInt(overallMatch[1], 10) : null,
    summary: summaryMatch ? summaryMatch[1] : 'Partial scores recovered via regex rescue',
  };
}

export function parseJudgeResponse(responseText) {
  let jsonMatch = responseText.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
  if (!jsonMatch) {
    const firstBrace = responseText.indexOf('{');
    const lastBrace = responseText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonMatch = [null, responseText.slice(firstBrace, lastBrace + 1)];
    }
  }
  if (!jsonMatch) {
    throw new Error('Could not parse judge response as JSON');
  }
  const jsonStr = jsonMatch[1] || jsonMatch[0];
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    const cleaned = jsonStr
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\x00-\x1f]/g, m =>
        m === '\n' ? '\\n' : m === '\t' ? '\\t' : m === '\r' ? '\\r' : '');
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      try {
        const repaired = repairUnescapedQuotes(cleaned);
        return JSON.parse(repaired);
      } catch (e3) {
        try {
          const robustRepaired = jsonrepair(jsonStr);
          return JSON.parse(robustRepaired);
        } catch (e4) {
          const rescued = regexScoreRescue(jsonStr);
          if (rescued) return rescued;
          throw new Error('Could not parse judge response as JSON');
        }
      }
    }
  }
}
