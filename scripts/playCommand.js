/**
 * Play Command — Human-in-the-loop role-playing
 *
 * Lets a human take the role of a tutor or learner agent (ego and/or superego)
 * while the other side runs via LLM. Uses the existing llmCall injection point
 * in runInteraction — no tutor-core changes needed.
 *
 * The key insight is that runInteraction(config, llmCall, options) accepts
 * an injected llmCall function. We wrap this to intercept calls where
 * opts.agentRole matches the human's chosen side/role, presenting a prompt
 * to the human instead of calling the LLM.
 */

import 'dotenv/config';
import readline from 'readline';
import {
  runInteraction,
  callLearnerAI,
} from '../services/learnerTutorInteractionEngine.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import theme from '../services/cliTheme.js';

// ── Human input collection ─────────────────────────────────────

function getHumanInput(rl, agentRole, systemPrompt, messages) {
  return new Promise((resolve) => {
    console.log('');
    console.log(theme.box(
      `${agentRole.toUpperCase()} (you)`,
      formatContext(systemPrompt, messages),
    ));
    console.log('');

    const lines = [];
    let collecting = false;

    const promptUser = () => {
      rl.question(theme.human('> '), (answer) => {
        if (answer === null) {
          // EOF (Ctrl+D)
          resolve({ content: lines.join('\n') || 'I need a moment to think about that.', usage: { inputTokens: 0, outputTokens: 0 } });
          return;
        }

        // Empty line on first prompt = send what we have (or re-prompt)
        if (answer.trim() === '' && lines.length === 0) {
          promptUser();
          return;
        }

        // Empty line after content = done (multi-line mode)
        if (answer.trim() === '' && lines.length > 0) {
          resolve({ content: lines.join('\n'), usage: { inputTokens: 0, outputTokens: 0 } });
          return;
        }

        lines.push(answer);

        // Single line followed by Enter: if this is the first line, wait for
        // one more Enter (blank line) to allow multi-line, but also support
        // quick single-line input by pressing Enter twice
        if (lines.length === 1 && !collecting) {
          collecting = true;
          console.log(theme.dim('  (press Enter on empty line to send, or keep typing)'));
        }
        promptUser();
      });
    };

    promptUser();
  });
}

function formatContext(systemPrompt, messages) {
  const lines = [];

  // Show a truncated system prompt preview
  if (systemPrompt) {
    const preview = systemPrompt.substring(0, 200).replace(/\n/g, ' ');
    lines.push(theme.dim(`System: ${preview}${systemPrompt.length > 200 ? '...' : ''}`));
    lines.push('');
  }

  // Show the most recent message being responded to
  if (messages && messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    lines.push(`${theme.header('Responding to:')}`);
    lines.push(lastMsg.content.substring(0, 500) + (lastMsg.content.length > 500 ? '...' : ''));
  }

  return lines.join('\n');
}

// ── Agent output display ───────────────────────────────────────

function displayAgentOutput(agentRole, content) {
  console.log('');
  console.log(theme.box(
    agentRole.toUpperCase(),
    content.substring(0, 1000) + (content.length > 1000 ? '\n...' : ''),
    theme.agentRole.bind(null, agentRole),
  ));
}

// ── Play llmCall wrapper ───────────────────────────────────────

function createPlayLlmCall(rl, humanSide, humanRole, realLlmCall) {
  // Determine which agentRoles the human controls
  const humanRoles = new Set();

  if (humanSide === 'tutor') {
    if (humanRole === 'ego' || humanRole === 'both') humanRoles.add('tutor_ego');
    if (humanRole === 'superego' || humanRole === 'both') humanRoles.add('tutor_superego');
  } else if (humanSide === 'learner') {
    if (humanRole === 'ego' || humanRole === 'both') {
      humanRoles.add('learner_ego');
      humanRoles.add('learner_ego_initial');
      humanRoles.add('learner_ego_revision');
    }
    if (humanRole === 'superego' || humanRole === 'both') humanRoles.add('learner_superego');
  }

  return async function playLlmCall(model, systemPrompt, messages, opts = {}) {
    const role = opts.agentRole || 'unknown';

    if (humanRoles.has(role)) {
      // Human's turn
      return getHumanInput(rl, role, systemPrompt, messages);
    } else {
      // AI's turn — call real LLM and display output
      const response = await realLlmCall(model, systemPrompt, messages, opts);
      displayAgentOutput(role, response.content || '');
      return response;
    }
  };
}

// ── Real LLM call (mirrors callLearnerAI interface) ────────────

async function makeRealLlmCall(model, systemPrompt, messages, opts = {}) {
  // Build a minimal agentConfig for callLearnerAI
  // Resolve the model reference to get provider details
  const resolved = evalConfigLoader.resolveModel(model);
  if (!resolved) {
    throw new Error(`Cannot resolve model: ${model}. Check your provider config.`);
  }

  const agentConfig = {
    provider: resolved.provider,
    providerConfig: resolved.providerConfig,
    model: resolved.model,
    hyperparameters: {
      temperature: opts.temperature || 0.7,
      max_tokens: opts.maxTokens || 800,
    },
  };

  const userPrompt = messages.map((m) => m.content).join('\n');
  const result = await callLearnerAI(agentConfig, systemPrompt, userPrompt, opts.agentRole || 'play');
  return {
    content: result.content,
    usage: result.usage || { inputTokens: 0, outputTokens: 0 },
  };
}

// ── Scenario selection (interactive) ───────────────────────────

async function selectScenario(rl) {
  const scenarios = evalConfigLoader.listScenarios();
  if (scenarios.length === 0) {
    throw new Error('No scenarios found in configuration.');
  }

  console.log(theme.header('\nAvailable scenarios:\n'));
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const turns = s.isMultiTurn ? theme.dim(` (${s.turnCount} turns)`) : theme.dim(' (single-turn)');
    console.log(`  ${theme.dim(`${i + 1}.`)} ${s.name || s.id}${turns}`);
  }
  console.log('');

  return new Promise((resolve) => {
    rl.question(theme.human('Select scenario (number or ID): '), (answer) => {
      const num = parseInt(answer, 10);
      if (!isNaN(num) && num >= 1 && num <= scenarios.length) {
        resolve(scenarios[num - 1]);
      } else {
        const match = scenarios.find((s) => s.id === answer || s.name === answer);
        if (match) {
          resolve(match);
        } else {
          console.log(theme.warn('Invalid selection, using first scenario.'));
          resolve(scenarios[0]);
        }
      }
    });
  });
}

// ── Main entry point ───────────────────────────────────────────

export async function runPlay(opts = {}) {
  const {
    humanSide = 'tutor',      // 'tutor' or 'learner'
    humanRole = 'ego',         // 'ego', 'superego', or 'both'
    scenarioId = null,
    profileName = null,
  } = opts;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  try {
    // Display session header
    console.log('');
    console.log(theme.header('='.repeat(60)));
    console.log(theme.header('  PLAY MODE — Human-in-the-loop Dialogue'));
    console.log(theme.header('='.repeat(60)));
    console.log('');
    console.log(`  You are:  ${theme.human(humanSide.toUpperCase())} ${theme.dim(`(${humanRole})`)}`);
    console.log(`  AI runs:  ${theme.dim(humanSide === 'tutor' ? 'learner' : 'tutor')}`);

    // Select scenario
    let scenario;
    if (scenarioId) {
      const scenarioList = evalConfigLoader.listScenarios();
      scenario = scenarioList.find((s) => s.id === scenarioId);
      if (!scenario) {
        throw new Error(`Scenario not found: ${scenarioId}`);
      }
    } else {
      scenario = await selectScenario(rl);
    }

    const fullScenario = evalConfigLoader.getScenario(scenario.id);
    console.log(`  Scenario: ${theme.header(scenario.name || scenario.id)}`);

    // Resolve profile
    const profile = profileName || 'cell_5_recog_single_unified';
    console.log(`  Profile:  ${theme.model(profile)}`);
    console.log('');
    console.log(theme.dim('  Type your response when prompted. Press Enter on an empty line to send.'));
    console.log(theme.dim('  Press Ctrl+C to exit at any time.'));
    console.log('');
    console.log(theme.dim('-'.repeat(60)));

    // Build the play wrapper
    const playLlm = createPlayLlmCall(rl, humanSide, humanRole, makeRealLlmCall);

    // Run the interaction
    const result = await runInteraction(
      {
        learnerId: `play-${Date.now()}`,
        personaId: 'productive_struggler',
        tutorProfile: profile,
        topic: fullScenario.name || scenario.id,
        scenario: fullScenario,
        sessionId: `play-session-${Date.now()}`,
      },
      playLlm,
      {
        maxTurns: fullScenario.turns?.length ? fullScenario.turns.length + 1 : 3,
        trace: true,
        observeInternals: true,
      },
    );

    // Session summary
    console.log('');
    console.log(theme.header('='.repeat(60)));
    console.log(theme.header('  SESSION COMPLETE'));
    console.log(theme.header('='.repeat(60)));
    console.log(`  Turns: ${result.turns?.length || 0}`);
    console.log(`  Outcomes: ${result.outcomes?.join(', ') || 'none recorded'}`);
    if (result.metrics) {
      const { totalInputTokens = 0, totalOutputTokens = 0 } = result.metrics;
      if (totalInputTokens > 0 || totalOutputTokens > 0) {
        console.log(`  Tokens: ${totalInputTokens} in / ${totalOutputTokens} out`);
      }
    }
    console.log('');
  } catch (error) {
    if (error.message === 'readline was closed') {
      console.log('\n\nSession ended.');
    } else {
      throw error;
    }
  } finally {
    rl.close();
  }
}
