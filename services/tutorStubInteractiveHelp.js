/**
 * Pure interactive `/help` line projection for the tutor-stub CLI.
 * Command availability, capability resolution, and terminal writes remain
 * owned by scripts/tutor-stub.js.
 */
export function projectTutorStubInteractiveHelpLines({
  mode = 'normal',
  helpRows = [],
  commandAvailability = {},
  learningSummaryActive = false,
  colors = {},
} = {}) {
  const { brightCyan = '', bold = '', reset = '', dim = '', cyan = '' } = colors;
  const lines = [];
  const commandAvailable = (token) => Boolean(commandAvailability[token]);

  if (mode === 'passthrough') {
    lines.push(`${brightCyan}${bold}passthrough commands${reset}`);
    lines.push(`${cyan}  chat${reset}       type any ordinary line`);
    for (const row of helpRows) {
      lines.push(`${cyan}  ${row.label.padEnd(11)}${reset} ${row.commands.join(' · ')} — ${row.summary}`);
    }
    lines.push(
      `${dim}  Each learner line goes directly to the speaker with the unchanged system setup and complete public message history. No classifier, reasoning tracker, register selection, response check, release planner, or auxiliary model call runs.${reset}\n`,
    );
    return lines;
  }

  lines.push(
    `${brightCyan}${bold}commands${reset}${dim} · type / to browse; keep typing to filter; Tab completes${reset}`,
  );
  for (const row of helpRows) {
    lines.push(`${cyan}  ${row.label.padEnd(12)}${reset} ${row.commands.join(' · ')} — ${row.summary}`);
  }
  lines.push(
    `${dim}  Your ordinary lines are learner speech. /coach keeps your suggestion private. /auto lets the models continue the existing conversation; add a number to limit the turns.${reset}`,
  );
  lines.push(
    `${dim}  If you add another learner line before the tutor replies, both lines become one learner turn and the tutor restarts from the complete message.${reset}`,
  );
  if (commandAvailable('/feedback')) {
    lines.push(
      `${dim}  Tutor ratings are optional. On an empty prompt press ← for not helpful or → for helpful—no Enter needed. Add a typed reason with commands such as /down too_abstract or /up helpful_pacing.${reset}`,
    );
  }
  lines.push(
    `${dim}  If the exchange goes off the rails, /reset cancels unfinished work and restarts the same scenario while keeping your learner profile and settings. /clear is an alias.${reset}`,
  );
  lines.push(
    `${dim}  /debug off shows only the dialogue and compact response line. /debug on adds a short plain explanation. /debug technical shows the full diagnostic evidence once.${reset}`,
  );
  if (commandAvailable('/committee')) {
    lines.push(
      `${dim}  The learned Qwen warrant committee is on by default in human chat. /committee toggles it; /committee status shows its model and fallback policy.${reset}`,
    );
  }
  if (commandAvailable('/random')) {
    lines.push(
      `${dim}  /random toggles a session-only performance experiment: style and host character change randomly, independently of learner assessment; evidence, action choice, closure, and safety still work normally.${reset}`,
    );
    lines.push(
      `${dim}  /tutor and /learner open the two character selectors directly; /character tutor and /character learner remain the full forms. A changed tutor character says “Let me rephrase that” and restates the latest intent in the new part. Use auto to clear a tutor-axis lock.${reset}`,
    );
  }
  if (commandAvailable('/suggest')) {
    lines.push(
      `${dim}  /suggest previews the reply and profile expression; /use repeats the profile expression and sends it. /transcript opens raw, script, swimlane, analysis, prompt, settings, and Replay JS views.${reset}`,
    );
  } else {
    lines.push(
      `${dim}  /transcript opens raw, script, swimlane, analysis, prompt, settings, and Replay JS views.${reset}`,
    );
  }
  lines.push(
    `${dim}  /voice opens a local microphone companion. Speech enters this same learner-turn path; only accepted tutor text is voiced. /voice status and /voice off inspect or stop it.${reset}`,
  );
  if (commandAvailable('/board')) {
    lines.push(
      `${dim}  /board reads workplan/items live and starts the selected card as a fresh reflective inquiry; /board <item-id> selects directly.${reset}`,
    );
  }
  if (commandAvailable('/proof')) {
    lines.push(
      `${dim}  /proof checks the deterministic Nocturne certificate fixture; /proof inspect learner or tutor shows the public projections. Use /analysis technical for this session's live DAG state.${reset}`,
    );
  }
  lines.push(
    learningSummaryActive ? `${dim}  A learner-centred summary is written when the conversation ends.${reset}\n` : '',
  );
  return lines;
}
