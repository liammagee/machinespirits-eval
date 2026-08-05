import fs from 'fs';
import { chalk } from './cliTheme.js';
import { formatCompactLine, formatEntry } from './transcriptFormatter.js';

export function createEvaluationMultiTurnTranscriptRuntime({
  config,
  consolidatedTrace,
  initialTraceIndex = 0,
  runNum = 0,
  scenario,
  transcriptMode = false,
  transcriptPath = null,
  writeLine = console.log,
}) {
  let lastTranscriptIndex = initialTraceIndex;
  const printedLearnerTurns = new Set();
  const chatTag = chalk.dim(`[${config.profileName} · ${scenario.id} #${runNum + 1}]`);
  let chatBannerPrinted = false;

  function flushTranscript(isLlmLearner) {
    const newEntries = consolidatedTrace.slice(lastTranscriptIndex);
    if (newEntries.length === 0) return;
    lastTranscriptIndex = consolidatedTrace.length;

    for (const entry of newEntries) {
      const chatLine = formatChatLine(entry, printedLearnerTurns);
      if (!chatLine) continue;
      if (!chatBannerPrinted) {
        writeLine('\n' + chalk.dim('─'.repeat(70)));
        writeLine(chatTag);
        writeLine(chalk.dim('─'.repeat(70)));
        chatBannerPrinted = true;
      }
      writeLine(chatLine);
    }

    if (transcriptMode && transcriptPath) {
      const lines = [];
      for (const entry of newEntries) {
        const formatted = formatEntry(entry, { detail: 'play' });
        if (formatted) lines.push(formatted + '\n');
        const compactLine = formatCompactLine(entry);
        if (compactLine) writeLine(compactLine);
      }
      if (lines.length > 0) fs.appendFileSync(transcriptPath, lines.join('\n'));
    }

    // The argument is intentionally part of the boundary contract. Both
    // dynamic architectures currently emit the same final-output trace shape;
    // retaining it makes a future presentation distinction explicit.
    void isLlmLearner;
  }

  function formatChatLine(entry, printed) {
    const { agent, action } = entry;
    const roleWidth = 11;
    const pad = (label) => label.padEnd(roleWidth);
    const inlineTag = ' ' + chalk.dim(`[${config.profileName} · ${scenario.id} #${runNum + 1}]`);

    if ((agent === 'learner' || agent === 'user') && (action === 'final_output' || action === 'turn_action')) {
      const turnKey = `learner-${entry.turnIndex}`;
      if (printed.has(turnKey)) return null;
      printed.add(turnKey);
      const text = (entry.detail || entry.contextSummary || '').substring(0, 500);
      if (!text) return null;
      const metrics = entry.metrics || {};
      const metadata = [];
      if (metrics.model) {
        const name = metrics.model.includes('/') ? metrics.model.split('/').pop() : metrics.model;
        metadata.push(name.split(':')[0].substring(0, 22));
      }
      if (metrics.latencyMs != null) {
        metadata.push(
          metrics.latencyMs < 1000 ? `${metrics.latencyMs}ms` : `${(metrics.latencyMs / 1000).toFixed(1)}s`,
        );
      }
      if (metrics.inputTokens != null || metrics.outputTokens != null) {
        metadata.push(`${metrics.inputTokens ?? '?'}→${metrics.outputTokens ?? '?'}`);
      }
      const metadataText = metadata.length > 0 ? '\n' + ' '.repeat(roleWidth) + chalk.dim(metadata.join(' · ')) : '';
      return (
        '\n' +
        chalk.green.bold(pad('Learner')) +
        inlineTag +
        '\n' +
        ' '.repeat(roleWidth) +
        wrapChatText(text, roleWidth) +
        metadataText
      );
    }

    if (agent === 'ego' && (action === 'revise' || action === 'generate_final')) {
      const laterInTrace = consolidatedTrace.slice(consolidatedTrace.indexOf(entry) + 1);
      const hasLaterRevision = laterInTrace.some(
        (candidate) =>
          candidate.turnIndex === entry.turnIndex &&
          candidate.agent === 'ego' &&
          (candidate.action === 'revise' || candidate.action === 'generate_final'),
      );
      if (hasLaterRevision) return null;
      return formatTutorLine(entry, roleWidth, pad, inlineTag);
    }
    if (agent === 'ego' && action === 'generate') {
      const laterInTrace = consolidatedTrace.slice(consolidatedTrace.indexOf(entry) + 1);
      const hasRevision = laterInTrace.some(
        (candidate) =>
          candidate.turnIndex === entry.turnIndex &&
          candidate.agent === 'ego' &&
          (candidate.action === 'revise' || candidate.action === 'generate_final'),
      );
      if (hasRevision) return null;
      return formatTutorLine(entry, roleWidth, pad, inlineTag);
    }
    return null;
  }

  function formatTutorLine(entry, roleWidth, pad, inlineTag) {
    const message = (entry.suggestions || [])
      .map((suggestion) => suggestion.message || suggestion.title || '')
      .join('\n\n')
      .substring(0, 500);
    if (!message) return null;
    const metrics = entry.metrics || {};
    const metadata = [];
    if (metrics.model) {
      const name = metrics.model.includes('/') ? metrics.model.split('/').pop() : metrics.model;
      metadata.push(name.split(':')[0].substring(0, 22));
    }
    if (metrics.latencyMs != null) {
      metadata.push(metrics.latencyMs < 1000 ? `${metrics.latencyMs}ms` : `${(metrics.latencyMs / 1000).toFixed(1)}s`);
    }
    if (metrics.inputTokens != null || metrics.outputTokens != null) {
      metadata.push(`${metrics.inputTokens ?? '?'}→${metrics.outputTokens ?? '?'}`);
    }
    const metadataText = metadata.length > 0 ? '\n' + ' '.repeat(roleWidth) + chalk.dim(metadata.join(' · ')) : '';
    return (
      '\n' +
      chalk.cyan.bold(pad('Tutor')) +
      inlineTag +
      '\n' +
      ' '.repeat(roleWidth) +
      wrapChatText(message, roleWidth) +
      metadataText
    );
  }

  function wrapChatText(text, indent) {
    const maxWidth = 90;
    const result = [];
    for (const line of text.split('\n')) {
      if (line.trim() === '') {
        result.push('');
        continue;
      }
      const words = line.split(/\s+/);
      let current = '';
      for (const word of words) {
        if (current.length + word.length + 1 > maxWidth - indent && current.length > 0) {
          result.push(current);
          current = ' '.repeat(indent) + word;
        } else {
          current = current ? current + ' ' + word : word;
        }
      }
      if (current) result.push(current);
    }
    return result.join('\n');
  }

  return { flushTranscript };
}
