import { CHAT_TOOLS, executeChatTool } from './chatTools.js';

async function callOpenRouter(messages, model, apiKey, hyperparameters = {}) {
  const { temperature, max_tokens } = hyperparameters;
  if (temperature === undefined) throw new Error('Explicit temperature setting required for judge chat model.');
  if (max_tokens === undefined) throw new Error('Explicit max_tokens setting required for judge chat model.');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: CHAT_TOOLS,
      temperature,
      max_tokens,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter API error: ${res.status} — ${body.slice(0, 300)}`);
  }

  return res.json();
}

export async function runChatCommand(context) {
  const { getAvailableJudge, readline } = context;
  const judge = getAvailableJudge();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not set. Required for chat mode.');
    process.exit(1);
  }
  const _model = `${judge.provider === 'openrouter' ? '' : judge.provider + '/'}${judge.model}`;
  const chatModel = judge.provider === 'openrouter' ? judge.model : `${judge.provider}/${judge.model}`;

  console.log(`\nEval Chat (model: ${chatModel})`);
  console.log('Type your questions about evaluation runs. Use "quit" or "exit" to leave.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'eval> ',
  });

  const messages = [
    {
      role: 'system',
      content: `You are an AI assistant for a tutor evaluation system. You help users inspect evaluation runs, view reports, run ANOVA analyses, start new evaluations, and manage run lifecycle.

You have access to tools that query a SQLite database of evaluation runs and results. Each run tests tutor AI configurations against pedagogical scenarios and scores them with an AI judge.

Key concepts:
- Runs contain multiple test results (scenario × profile combinations)
- The 2×2×2 factorial design tests: Recognition prompts (A), Multi-agent tutor (B), Multi-agent learner (C)
- ANOVA analyses test significance of these factors
- Profiles define tutor configurations (model, architecture, etc.)
- Scenarios define learner situations to evaluate

When showing data, be concise. Summarise key findings rather than dumping raw JSON. Use tables where helpful.
When the user asks to see "recent runs" or "latest", use list_runs.
When asked about a specific run, use get_run_report or get_run_status.
For statistical analysis, use run_anova.
To see available test scenarios and profiles, use list_options.`,
    },
  ];

  const prompt = () => rl.prompt();

  rl.on('close', () => {
    console.log('\nBye.');
    process.exit(0);
  });

  prompt();

  for await (const line of rl) {
    const input = line.trim();
    if (!input) {
      prompt();
      continue;
    }
    if (input === 'quit' || input === 'exit') {
      console.log('Bye.');
      process.exit(0);
    }

    messages.push({ role: 'user', content: input });

    try {
      let done = false;
      while (!done) {
        const response = await callOpenRouter(messages, chatModel, apiKey, judge.hyperparameters || {});
        const choice = response.choices?.[0];
        if (!choice) {
          console.log('[No response from model]');
          done = true;
          break;
        }

        const msg = choice.message;
        messages.push(msg);

        // Handle tool calls
        if (msg.tool_calls?.length > 0) {
          for (const tc of msg.tool_calls) {
            const fnName = tc.function.name;
            let fnArgs = {};
            try {
              fnArgs = JSON.parse(tc.function.arguments || '{}');
            } catch (e) {
              /* empty */
            }

            process.stdout.write(`  [calling ${fnName}...]\n`);
            let result;
            try {
              result = await executeChatTool(fnName, fnArgs, context);
            } catch (err) {
              result = `Error: ${err.message}`;
            }

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: typeof result === 'string' ? result : JSON.stringify(result),
            });
          }
          // Loop back to get the model's summary of tool results
        } else {
          // Text response — print it
          const text = msg.content || '';
          console.log(`\n${text}\n`);
          done = true;
        }
      }
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
    }

    prompt();
  }
}
