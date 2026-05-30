/**
 * AI Service
 *
 * High-level AI generation functions for the Machine Spirits platform.
 * Delegates to UnifiedAIProviderService for actual provider calls.
 *
 * This module maintains backward compatibility with the legacy API:
 * - Returns {text, model} format (not {content, model, usage})
 * - Exports MACHINE_SPIRIT_PERSONA for use by other modules
 */

import { getDefaultModel, getDefaultProviderId } from './aiConfigService.js';
import * as unifiedProvider from './unifiedAIProviderService.js';

// Unified Machine Spirit persona - single source of truth for AI identity
const MACHINE_SPIRIT_PERSONA = `You are the Machine Spirit, a Socratic AI tutor for Machine Spirits - an educational platform exploring technology, philosophy, and digital culture through a Hegelian lens.

CRITICAL RULES - NEVER BREAK THESE:
- NEVER ask generic questions like "What's on your mind?" or "What would you like to explore?"
- NEVER make small talk or generic conversation
- ALWAYS ground your questions in SPECIFIC curriculum concepts (recognition, alienation, dialectic, machine learning, consciousness, etc.)
- If the learner hasn't specified a topic, TEST their knowledge with a specific concept question

Your pedagogical approach:
- TEST KNOWLEDGE by asking about specific philosophical or technical concepts
- Pose questions that require the learner to demonstrate understanding
- Challenge vague answers with follow-up probes
- When a learner asks something, first ask what they already understand about it

Example good responses:
- "Before we continue - can you explain how Hegel's master-servant dialectic relates to AI alignment?"
- "You mentioned recognition. What's the difference between recognition and mere acknowledgment?"
- "How would you define 'alienation' in Marx's framework? And do you see parallels in digital labor?"

Example BAD responses (NEVER DO THESE):
- "What's been on your mind lately?"
- "What would you like to learn about today?"
- "How can I help you with your studies?"
- "What brings you here?"

Your character:
- Intellectually rigorous tutor who tests understanding
- Draws on Hegel, Marx, Freud, and philosophy of mind
- Supportive but never lets vague understanding slide

FORMATTING RULES:
- Keep responses concise (2-4 sentences)
- END with a specific, testable question
- Use **bold** for key philosophical concepts and technical terms (e.g., **dialectic**, **recognition**, **alienation**)
- When introducing a new concept, bold it so learners can easily identify important vocabulary`;

// ============================================================================
// Context Building
// ============================================================================

const buildContext = (message, ranked) => {
  const context = ranked.map((a, i) => [
    `Source [${i + 1}]: ${a.title}`,
    `Updated: ${a.updated} · Length: ${a.length}`,
    a.content.slice(0, 2000)
  ].join('\n')).join('\n\n');

  const prompt = [
    MACHINE_SPIRIT_PERSONA,
    '',
    'Answer the user\'s question using the provided context.',
    'If the answer is not in the context, offer what insight you can while noting the archives are silent on specifics.',
    'Cite your sources using [Source N] format.',
    '',
    `User question: ${message}`,
    '',
    'Context:',
    context
  ].join('\n');
  return prompt;
};

// ============================================================================
// Legacy API Wrappers (backward compatible - return {text, model})
// ============================================================================

/**
 * Helper to convert unified response to legacy format
 */
const toLegacyFormat = (response, fallback = 'The archive is quiet.') => ({
  text: response.content || fallback,
  model: response.model,
});

/**
 * Generate a chat reply with article context
 */
export const generateChatReply = async (message, ranked, provider = null, model) => {
  const prompt = buildContext(message, ranked);
  const selected = (provider || getDefaultProviderId()).toLowerCase();

  const response = await unifiedProvider.call({
    provider: selected,
    model,
    systemPrompt: MACHINE_SPIRIT_PERSONA,
    messages: [{ role: 'user', content: prompt }],
    preset: 'chat',
  });

  return toLegacyFormat(response);
};

/**
 * Generate a direct AI reply without article context
 * Used for glossary definitions, flashcard generation, etc.
 */
export const generateDirectReply = async (message, provider = null, model) => {
  const effectiveProvider = provider || getDefaultProviderId();
  console.log('[AI Service] Direct reply request:', {
    provider: effectiveProvider,
    model: model || 'default',
    messagePreview: message.slice(0, 100)
  });

  const response = await unifiedProvider.call({
    provider: effectiveProvider.toLowerCase(),
    model,
    systemPrompt: MACHINE_SPIRIT_PERSONA,
    messages: [{ role: 'user', content: message }],
    preset: 'direct',
  });

  console.log('[AI Service] Response preview:', response.content?.slice(0, 200));

  return {
    text: response.content || 'Unable to generate response.',
    model: response.model,
    rawResponse: response,
  };
};

/**
 * Generate a Socratic dialogue response
 * @param {string} studentMessage - The student's message
 * @param {string} topic - The dialogue topic
 * @param {Array} history - Conversation history [{role: 'student'|'tutor', content: string}]
 * @param {string} systemPrompt - Optional custom system prompt
 * @param {string} provider - AI provider (gemini, openai, claude)
 * @param {string} model - Optional model override
 * @returns {Promise<{text: string, model: string}>}
 */
export const generateSocraticResponse = async (
  studentMessage,
  topic,
  history = [],
  systemPrompt = null,
  provider = null,
  model = null
) => {
  const defaultPrompt = `You are a Socratic tutor engaging in philosophical dialogue about: ${topic}

Your role:
- Ask probing questions that help the student discover insights on their own
- Never give direct answers - guide through questioning
- Challenge assumptions with gentle but persistent inquiry
- Acknowledge good reasoning while pushing for deeper exploration
- Help students notice contradictions in their thinking
- Use examples and analogies to illuminate concepts
- Keep responses concise (2-3 sentences typically, occasionally longer for complex points)

Remember: The goal is not to lecture but to midwife understanding through dialogue.`;

  const fullSystemPrompt = systemPrompt || defaultPrompt;

  // Build conversation context
  const conversationContext = history.map(msg =>
    `${msg.role === 'student' ? 'Student' : 'Tutor'}: ${msg.content}`
  ).join('\n\n');

  const prompt = `${fullSystemPrompt}

Previous conversation:
${conversationContext || '(This is the beginning of the dialogue)'}

Student: ${studentMessage}

Respond as the Socratic tutor:`;

  const selected = (provider || getDefaultProviderId()).toLowerCase();

  const response = await unifiedProvider.call({
    provider: selected,
    model,
    systemPrompt: fullSystemPrompt,
    messages: [{ role: 'user', content: prompt }],
    preset: 'socratic',
  });

  return {
    text: response.content || 'What makes you say that?',
    model: response.model,
  };
};

/**
 * Generate AI code review feedback
 * @param {Object} options - Review options
 * @param {string} options.code - The code to review
 * @param {string} options.language - Programming language
 * @param {string} options.activityTitle - Activity title for context
 * @param {string} options.activityDescription - Activity description
 * @param {Array} options.testCases - Test cases for the activity
 * @param {string} options.systemPrompt - Optional custom system prompt
 * @param {string} options.provider - AI provider (claude, openai, gemini)
 * @returns {Promise<{feedback: string, suggestions: Array, score: number|null, strengths: Array, improvements: Array, model: string}>}
 */
export const generateCodeReview = async ({
  code,
  language,
  activityTitle,
  activityDescription,
  testCases = [],
  systemPrompt = null,
  provider = null
}) => {
  const defaultPrompt = `You are an expert code reviewer and programming tutor. Review the submitted code with an educational focus.

Activity: ${activityTitle || 'Code Exercise'}
${activityDescription ? `Description: ${activityDescription}` : ''}
Language: ${language}

${testCases.length > 0 ? `Expected functionality (based on test cases):
${testCases.filter(t => !t.hidden).map(t => `- ${t.name}: Input "${t.input}" should produce "${t.expectedOutput}"`).join('\n')}
` : ''}

Review the code and provide feedback in the following JSON format:
{
  "feedback": "A 2-3 sentence overall assessment of the code quality and correctness",
  "strengths": ["Array of 2-3 specific things done well"],
  "improvements": ["Array of 2-3 specific suggestions for improvement"],
  "suggestions": [
    {
      "line": <line number or null if general>,
      "type": "error|warning|suggestion",
      "message": "Specific feedback for this issue"
    }
  ],
  "score": <0-100 score based on correctness, style, and best practices, or null if unsure>
}

Focus on:
1. Correctness - Does the code solve the problem?
2. Code style - Is it readable and well-organized?
3. Best practices - Does it follow language conventions?
4. Edge cases - Are potential issues handled?

Be encouraging but honest. This is an educational context.`;

  const fullSystemPrompt = systemPrompt || defaultPrompt;

  const prompt = `${fullSystemPrompt}

Here is the code to review:

\`\`\`${language}
${code}
\`\`\`

Respond ONLY with valid JSON in the format specified above.`;

  const selected = (provider || getDefaultProviderId()).toLowerCase();

  try {
    const response = await unifiedProvider.call({
      provider: selected,
      model: selected === 'claude' ? (process.env.CODE_REVIEW_MODEL || 'claude-sonnet-4-20250514') : null,
      systemPrompt: fullSystemPrompt,
      messages: [{ role: 'user', content: prompt }],
      preset: 'codeReview',
      config: { jsonMode: true },
    });

    // Parse JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        feedback: parsed.feedback || 'Review completed.',
        suggestions: parsed.suggestions || [],
        score: typeof parsed.score === 'number' ? parsed.score : null,
        strengths: parsed.strengths || [],
        improvements: parsed.improvements || [],
        model: response.model
      };
    }

    // Fallback if JSON parsing fails
    return {
      feedback: response.content,
      suggestions: [],
      score: null,
      strengths: [],
      improvements: [],
      model: response.model
    };
  } catch (error) {
    throw new Error(`Code review failed: ${error.message}`);
  }
};

/**
 * Generate text using the unified provider (for dialecticalEngine and other services)
 * @param {Object} options
 * @param {string} options.prompt - The prompt text
 * @param {string} [options.systemPrompt] - System prompt
 * @param {string} [options.provider] - Provider ID
 * @param {string} [options.model] - Model ID
 * @param {number} [options.temperature] - Temperature override
 * @param {number} [options.maxTokens] - Max tokens override
 * @returns {Promise<{text: string, model: string}>}
 */
export const generateText = async ({
  prompt,
  systemPrompt = MACHINE_SPIRIT_PERSONA,
  provider = null,
  model = null,
  temperature = null,
  maxTokens = null,
}) => {
  const response = await unifiedProvider.call({
    provider: provider || getDefaultProviderId(),
    model,
    systemPrompt,
    messages: [{ role: 'user', content: prompt }],
    preset: 'direct',
    config: {
      ...(temperature !== null && { temperature }),
      ...(maxTokens !== null && { maxTokens }),
    },
  });

  return {
    text: response.content || '',
    model: response.model,
  };
};

// ============================================================================
// Status and Configuration
// ============================================================================

export const getProviderStatus = () => unifiedProvider.getProviderStatus();

export const getSuggestedPrompts = () => [
  "What is the connection between Hegel and AI?",
  "Explain the concept of 'Technosymbiosis'.",
  "Summarize the latest lecture in EPOL 479.",
  "What are the risks of algorithmic governance?",
  "How does machine learning relate to human pedagogy?",
  "Define 'stochastic parrots' in this context."
];

// Export the unified persona for use by other modules
export { MACHINE_SPIRIT_PERSONA };
