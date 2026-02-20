/**
 * CLI Color Theme
 *
 * Centralized semantic color functions for the eval CLI.
 * Uses chalk v5 (ESM-native). Automatically handles NO_COLOR,
 * piped output, and terminal capability detection.
 */

import chalk from 'chalk';

// ── Status colors ──────────────────────────────────────────────

export function status(text) {
  const lower = String(text).toLowerCase();
  if (lower === 'running') return chalk.yellow(text);
  if (lower === 'completed') return chalk.green(text);
  if (lower === 'failed') return chalk.red(text);
  if (lower.includes('stale')) return chalk.red(text);
  return chalk.dim(text);
}

// ── Score colors (80+ green, 60+ yellow, 40+ red, <40 dim red) ─

export function score(value) {
  if (value == null || value === '--') return chalk.dim('--');
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return chalk.dim(String(value));
  const str = typeof value === 'number' ? value.toFixed(1) : String(value);
  if (num >= 80) return chalk.green(str);
  if (num >= 60) return chalk.yellow(str);
  if (num >= 40) return chalk.red(str);
  return chalk.redBright(str);
}

// ── Agent role colors ──────────────────────────────────────────

export function tutorEgo(text) {
  return chalk.cyan(text);
}

export function tutorSuperego(text) {
  return chalk.magenta(text);
}

export function learnerEgo(text) {
  return chalk.green(text);
}

export function learnerSuperego(text) {
  return chalk.yellow(text);
}

export function human(text) {
  return chalk.whiteBright.bold(text);
}

export function agentRole(role, text) {
  const colorMap = {
    tutor_ego: tutorEgo,
    tutor_superego: tutorSuperego,
    learner_ego: learnerEgo,
    learner_ego_initial: learnerEgo,
    learner_ego_revision: learnerEgo,
    learner_superego: learnerSuperego,
    human: human,
  };
  return (colorMap[role] || chalk.white)(text);
}

// ── Structural colors ──────────────────────────────────────────

export function header(text) {
  return chalk.bold(text);
}

export function dim(text) {
  return chalk.dim(text);
}

export function model(text) {
  return chalk.cyan(text);
}

export function id(text) {
  return chalk.blue(text);
}

export function error(text) {
  return chalk.red.bold(text);
}

export function success(text) {
  return chalk.green(text);
}

export function warn(text) {
  return chalk.yellow(text);
}

// ── Box drawing helpers ────────────────────────────────────────

export function box(title, content, color = chalk.dim) {
  const width = 60;
  const top = color('┌─ ') + chalk.bold(title) + ' ' + color('─'.repeat(Math.max(0, width - title.length - 4)) + '┐');
  const bottom = color('└' + '─'.repeat(width - 1) + '┘');
  const lines = content.split('\n').map((line) => color('│ ') + line);
  return [top, ...lines, bottom].join('\n');
}

// ── Re-export chalk for one-off use ────────────────────────────

export { chalk };

export default {
  status,
  score,
  tutorEgo,
  tutorSuperego,
  learnerEgo,
  learnerSuperego,
  human,
  agentRole,
  header,
  dim,
  model,
  id,
  error,
  success,
  warn,
  box,
  chalk,
};
