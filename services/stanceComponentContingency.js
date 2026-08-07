/**
 * How a stance pass count splits against each part of the gate that produced it.
 *
 * Why this exists. A gate scores several parts and adds them up, so a pass count
 * is a summary of parts and can be carried by the wrong one. That happened: the
 * determinate sarcasm gate re-weighted the register marker down, which quietly
 * stopped the marker being necessary, and a run's "held the sarcastic manner"
 * count turned out to track "named a learner claim" exactly and the marker not
 * at all. Nothing in the report said so, because nothing printed the split.
 *
 * So print it. For every part of the gate: how many rows carried it and passed,
 * carried it and failed, lacked it and passed, lacked it and failed. Then say in
 * words when the pattern is wrong — a part the gate calls necessary that some
 * passing row lacked, or a part the gate does not require that predicts every
 * row's outcome on its own.
 *
 * Verdicts are grouped by gate, because counts from two gates are not
 * comparable and a multi-arm grid holds several.
 */

import { stanceGateComponents } from './registerStanceFidelity.js';

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function carries(verdict, key) {
  return !(verdict.missing || []).includes(key);
}

function tabulatePart(rows, part) {
  const presentPassed = count(rows, (row) => carries(row, part.key) && row.passed);
  const presentFailed = count(rows, (row) => carries(row, part.key) && !row.passed);
  const absentPassed = count(rows, (row) => !carries(row, part.key) && row.passed);
  const absentFailed = count(rows, (row) => !carries(row, part.key) && !row.passed);
  const present = presentPassed + presentFailed;
  const absent = absentPassed + absentFailed;
  return {
    key: part.key,
    weight: part.weight,
    required: part.required,
    presentPassed,
    presentFailed,
    absentPassed,
    absentFailed,
    // Did the rows differ on this part at all? If every row carried it, the
    // pass count says nothing about it either way.
    varied: present > 0 && absent > 0,
    passedWithoutIt: absentPassed > 0,
    // On its own, this part predicts every pass and every fail without error.
    decidesEveryRow: present > 0 && absent > 0 && presentFailed === 0 && absentPassed === 0,
  };
}

function warningsFor(parts, n) {
  const warnings = [];
  for (const part of parts) {
    if (part.required && part.passedWithoutIt) {
      warnings.push({
        severity: 'contradiction',
        part: part.key,
        message:
          `${part.absentPassed} of ${n} rows were counted faithful without ${part.key}, ` +
          'which this gate declares necessary — the gate and its own rows disagree',
      });
    }
    if (!part.required && part.decidesEveryRow) {
      warnings.push({
        severity: 'warning',
        part: part.key,
        message:
          `passing tracks ${part.key} exactly (${part.presentPassed} carried it and passed, ` +
          `${part.absentFailed} lacked it and failed), so this count is reporting ${part.key} ` +
          'rather than the gate as a whole',
      });
    }
    if (part.required && !part.varied && n > 0) {
      warnings.push({
        severity: 'note',
        part: part.key,
        message:
          `every row ${part.presentPassed + part.presentFailed ? 'carried' : 'lacked'} ${part.key}, ` +
          'so this count shows nothing about whether the requirement bites',
      });
    }
  }
  return warnings;
}

/**
 * @param {Array<object>} verdicts results of evaluateRegisterStanceFidelity
 * @returns {{n: number, gates: Array<object>, contradictions: Array<object>}}
 */
export function stanceComponentContingency(verdicts) {
  const applicable = (verdicts || []).filter((verdict) => verdict && verdict.applies);
  const byGate = new Map();
  for (const verdict of applicable) {
    const identity = `${verdict.gateRegister}@${verdict.gateVersion}`;
    if (!byGate.has(identity)) byGate.set(identity, []);
    byGate.get(identity).push(verdict);
  }

  const gates = [...byGate.entries()]
    // Plain codepoint order, not localeCompare: collation treats '@' and '_' as
    // punctuation and can reorder gate names between locales, which would make
    // the same rows print a different report on a different machine.
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([identity, rows]) => {
      const gateRegister = rows[0].gateRegister;
      const parts = stanceGateComponents(gateRegister).map((part) => tabulatePart(rows, part));
      return {
        gate: identity,
        gateRegister,
        gateVersion: rows[0].gateVersion,
        n: rows.length,
        passed: count(rows, (row) => row.passed),
        parts,
        warnings: warningsFor(parts, rows.length),
      };
    });

  return {
    n: applicable.length,
    gates,
    contradictions: gates.flatMap((gate) =>
      gate.warnings
        .filter((warning) => warning.severity === 'contradiction')
        .map((warning) => `${gate.gate}: ${warning.message}`),
    ),
  };
}

/** Markdown for a report, so every consumer prints the same table. */
export function renderStanceComponentContingency(contingency) {
  const lines = [];
  for (const gate of contingency.gates || []) {
    lines.push(`Gate \`${gate.gate}\`, ${gate.passed}/${gate.n} faithful.`);
    lines.push('');
    lines.push(
      '| Part | weight | required | had it & passed | had it & failed | lacked it & passed | lacked it & failed |',
    );
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const part of gate.parts) {
      lines.push(
        `| ${part.key} | ${part.weight} | ${part.required ? 'yes' : 'no'} | ${part.presentPassed} | ` +
          `${part.presentFailed} | ${part.absentPassed} | ${part.absentFailed} |`,
      );
    }
    lines.push('');
    if (gate.warnings.length) {
      for (const warning of gate.warnings) lines.push(`- **${warning.severity}** — ${warning.message}.`);
    } else {
      lines.push('- No part of this gate carries the count on its own, and no passing row lacked a required part.');
    }
    lines.push('');
  }
  return lines.join('\n');
}

export default { stanceComponentContingency, renderStanceComponentContingency };
