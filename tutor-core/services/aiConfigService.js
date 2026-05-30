import crypto from 'crypto';
import { getDb } from './dbService.js';

// Get shared database connection
const db = getDb();

// Create AI-related tables
db.exec(`
    -- AI provider configurations (admin-managed)
    CREATE TABLE IF NOT EXISTS ai_providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        apiKeyEnvVar TEXT,
        baseUrl TEXT,
        defaultModel TEXT,
        supportedModels TEXT,
        maxTokens INTEGER DEFAULT 2048,
        createdAt TEXT DEFAULT (datetime('now'))
    );

    -- User-level AI preferences
    CREATE TABLE IF NOT EXISTS ai_user_settings (
        userId TEXT PRIMARY KEY,
        hintVerbosity TEXT DEFAULT 'balanced' CHECK(hintVerbosity IN ('minimal', 'balanced', 'detailed')),
        feedbackStyle TEXT DEFAULT 'encouraging' CHECK(feedbackStyle IN ('encouraging', 'direct', 'socratic')),
        preferredProvider TEXT,
        temperature REAL DEFAULT 0.7,
        showExplanations INTEGER DEFAULT 1,
        enableStreaming INTEGER DEFAULT 1,
        enableHints INTEGER DEFAULT 1,
        enableWritingFeedback INTEGER DEFAULT 1,
        -- Reading feature settings (all opt-in except metrics)
        enableReadingCompanion INTEGER DEFAULT 0,
        enableReflectionPrompts INTEGER DEFAULT 0,
        enableInlineExplanations INTEGER DEFAULT 0,
        enableReadingMetrics INTEGER DEFAULT 1,
        updatedAt TEXT DEFAULT (datetime('now'))
    );

    -- Prompt templates (versionable)
    CREATE TABLE IF NOT EXISTS ai_prompt_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('hint', 'feedback', 'quiz', 'concept', 'moderation', 'chat', 'socratic', 'code_review')),
        template TEXT NOT NULL,
        variables TEXT,
        version INTEGER DEFAULT 1,
        isActive INTEGER DEFAULT 1,
        createdBy TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
    );

    -- AI interaction logs (transparency)
    CREATE TABLE IF NOT EXISTS ai_interactions (
        id TEXT PRIMARY KEY,
        userId TEXT,
        provider TEXT,
        model TEXT,
        promptCategory TEXT,
        inputTokens INTEGER,
        outputTokens INTEGER,
        latencyMs INTEGER,
        success INTEGER DEFAULT 1,
        errorMessage TEXT,
        context TEXT,
        timestamp TEXT DEFAULT (datetime('now'))
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_ai_interactions_user ON ai_interactions(userId);
    CREATE INDEX IF NOT EXISTS idx_ai_interactions_timestamp ON ai_interactions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_ai_interactions_category ON ai_interactions(promptCategory);
    CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_category ON ai_prompt_templates(category);
`);

// Seed default providers
const seedDefaultProviders = () => {
    const providers = [
        {
            id: 'gemini',
            name: 'Google Gemini',
            enabled: 1,
            apiKeyEnvVar: 'GEMINI_API_KEY',
            baseUrl: 'https://generativelanguage.googleapis.com',
            defaultModel: 'gemini-3.0-flash',
            supportedModels: JSON.stringify(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro']),
            maxTokens: 2048
        },
        {
            id: 'openai',
            name: 'OpenAI',
            enabled: 1,
            apiKeyEnvVar: 'OPENAI_API_KEY',
            baseUrl: 'https://api.openai.com/v1',
            defaultModel: 'gpt-5.2',
            supportedModels: JSON.stringify(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']),
            maxTokens: 4096
        },
        {
            id: 'claude',
            name: 'Anthropic Claude',
            enabled: 1,
            apiKeyEnvVar: 'ANTHROPIC_API_KEY',
            baseUrl: 'https://api.anthropic.com',
            defaultModel: 'claude-sonnet-4-5-20250514',
            supportedModels: JSON.stringify(['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-sonnet-20241022']),
            maxTokens: 4096
        },
        {
            id: 'groq',
            name: 'Groq',
            enabled: 0,
            apiKeyEnvVar: 'GROQ_API_KEY',
            baseUrl: 'https://api.groq.com/openai/v1',
            defaultModel: 'llama-3.3-70b-versatile',
            supportedModels: JSON.stringify(['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']),
            maxTokens: 8192
        },
        {
            id: 'openrouter',
            name: 'OpenRouter',
            enabled: 1,
            apiKeyEnvVar: 'OPENROUTER_API_KEY',
            baseUrl: 'https://openrouter.ai/api/v1',
            defaultModel: process.env.OPENROUTER_MODEL || '',
            supportedModels: JSON.stringify([
                'zhipu-ai/glm-4.7',
                'deepseek/deepseek-chat-v3-0324',
                'anthropic/claude-3.5-haiku',
                'anthropic/claude-sonnet-4',
                'openai/gpt-4o',
                'google/gemini-2.0-flash-exp:free'
            ]),
            maxTokens: 4096
        }
    ];

    const insertProvider = db.prepare(`
        INSERT OR IGNORE INTO ai_providers (id, name, enabled, apiKeyEnvVar, baseUrl, defaultModel, supportedModels, maxTokens)
        VALUES (@id, @name, @enabled, @apiKeyEnvVar, @baseUrl, @defaultModel, @supportedModels, @maxTokens)
    `);

    for (const provider of providers) {
        insertProvider.run(provider);
    }
};

// Seed default prompt templates
const seedDefaultPromptTemplates = () => {
    const templates = [
        {
            id: 'hint-quiz',
            name: 'Quiz Hint',
            category: 'hint',
            template: `You are a helpful learning assistant. The student is working on a quiz question and needs a hint.

Question: {{question}}
{{#if options}}Options: {{options}}{{/if}}
Student's previous attempts: {{attempts}}
Hint verbosity: {{verbosity}}

Provide a {{verbosity}} hint that guides the student toward the answer without giving it away directly.
- minimal: One sentence nudge in the right direction
- balanced: 2-3 sentences with a conceptual pointer
- detailed: Full explanation of the concept with an example (but not the answer)

Be encouraging and educational.`,
            variables: JSON.stringify(['question', 'options', 'attempts', 'verbosity'])
        },
        {
            id: 'hint-code',
            name: 'Code Hint',
            category: 'hint',
            template: `You are a programming tutor. The student needs help with a coding exercise.

Activity: {{activityTitle}}
Language: {{language}}
Description: {{description}}
Student's code:
\`\`\`{{language}}
{{code}}
\`\`\`
Error (if any): {{error}}
Hint verbosity: {{verbosity}}

Provide a {{verbosity}} hint:
- minimal: Point to the problematic area
- balanced: Explain the concept they might be missing
- detailed: Walk through the logic step by step (without giving the solution)`,
            variables: JSON.stringify(['activityTitle', 'language', 'description', 'code', 'error', 'verbosity'])
        },
        {
            id: 'hint-reflection',
            name: 'Reflection Hint',
            category: 'hint',
            template: `You are a writing coach helping a student with a reflection activity.

Topic: {{topic}}
Prompt: {{prompt}}
Student's current draft ({{wordCount}} words):
{{draft}}
Minimum words required: {{minWords}}
Hint verbosity: {{verbosity}}

Provide {{verbosity}} guidance:
- minimal: A single thought-provoking question
- balanced: 2-3 prompting questions to deepen their reflection
- detailed: Structured guidance on how to expand their thinking`,
            variables: JSON.stringify(['topic', 'prompt', 'draft', 'wordCount', 'minWords', 'verbosity'])
        },
        {
            id: 'feedback-writing',
            name: 'Writing Feedback',
            category: 'feedback',
            template: `You are a writing assistant providing real-time feedback.

Activity type: {{activityType}}
Writing prompt: {{prompt}}
Student's text:
{{text}}
Feedback style: {{style}}

Provide {{style}} feedback:
- encouraging: Focus on strengths, gently suggest improvements
- direct: Clear, concise feedback on what works and what doesn't
- socratic: Ask questions that help the student improve on their own

Format your response as JSON:
{
  "overall": "Brief overall assessment",
  "strengths": ["What the student did well"],
  "suggestions": ["Specific improvements"],
  "questions": ["Questions to consider"]
}`,
            variables: JSON.stringify(['activityType', 'prompt', 'text', 'style'])
        },
        {
            id: 'quiz-generate',
            name: 'Quiz Question Generator',
            category: 'quiz',
            template: `Generate {{count}} quiz questions from the following lecture content.

Lecture title: {{title}}
Content:
{{content}}

Difficulty: {{difficulty}} (easy, medium, hard)
Question types to include: {{types}}

Format as JSON array:
[
  {
    "type": "multiple_choice|short_answer|matching",
    "question": "The question text",
    "options": ["A", "B", "C", "D"],  // for multiple choice
    "correctAnswer": "The correct answer or index",
    "explanation": "Why this is correct",
    "difficulty": "easy|medium|hard"
  }
]

Ensure questions test understanding, not just recall.`,
            variables: JSON.stringify(['count', 'title', 'content', 'difficulty', 'types'])
        },
        {
            id: 'concept-link',
            name: 'Concept Linker',
            category: 'concept',
            template: `Analyze the following lecture content and identify connections to other concepts.

Current lecture: {{currentTitle}}
Content:
{{currentContent}}

Other lectures in the course:
{{otherLectures}}

Identify 3-5 meaningful connections. Format as JSON:
{
  "connections": [
    {
      "concept": "The shared concept",
      "currentContext": "How it appears in this lecture",
      "relatedLecture": "Title of related lecture",
      "relatedContext": "How it appears there",
      "explanation": "Why this connection matters for learning"
    }
  ]
}`,
            variables: JSON.stringify(['currentTitle', 'currentContent', 'otherLectures'])
        },
        {
            id: 'moderation-discussion',
            name: 'Discussion Moderator',
            category: 'moderation',
            template: `You are an AI discussion facilitator. Analyze the discussion and provide moderation.

Discussion topic: {{topic}}
Recent messages:
{{messages}}

Your role:
1. If the discussion is going well, suggest a thought-provoking follow-up question
2. If discussion is stalling, provide a prompt to reinvigorate it
3. If there's conflict, gently redirect to constructive dialogue
4. If content is inappropriate, flag it

Respond as JSON:
{
  "action": "prompt|redirect|flag|none",
  "message": "Your response to the discussion",
  "flags": ["Any content concerns"],
  "suggestedTopics": ["Related topics to explore"]
}`,
            variables: JSON.stringify(['topic', 'messages'])
        }
    ];

    const insertTemplate = db.prepare(`
        INSERT OR IGNORE INTO ai_prompt_templates (id, name, category, template, variables)
        VALUES (@id, @name, @category, @template, @variables)
    `);

    for (const template of templates) {
        insertTemplate.run(template);
    }
};

// Run migrations for new columns
const runMigrations = () => {
    // Add reading feature columns if they don't exist
    const cols = db.prepare(`PRAGMA table_info(ai_user_settings)`).all().map(c => c.name);

    if (!cols.includes('enableReadingCompanion')) {
        db.exec(`ALTER TABLE ai_user_settings ADD COLUMN enableReadingCompanion INTEGER DEFAULT 0`);
    }
    if (!cols.includes('enableReflectionPrompts')) {
        db.exec(`ALTER TABLE ai_user_settings ADD COLUMN enableReflectionPrompts INTEGER DEFAULT 0`);
    }
    if (!cols.includes('enableInlineExplanations')) {
        db.exec(`ALTER TABLE ai_user_settings ADD COLUMN enableInlineExplanations INTEGER DEFAULT 0`);
    }
    if (!cols.includes('enableReadingMetrics')) {
        db.exec(`ALTER TABLE ai_user_settings ADD COLUMN enableReadingMetrics INTEGER DEFAULT 1`);
    }
};

// Run seeding and migrations
try {
    seedDefaultProviders();
    seedDefaultPromptTemplates();
    runMigrations();
} catch (e) {
    console.error('AI config seeding error:', e.message);
}

// ============ Provider Management ============

export const getProviders = () => {
    const providers = db.prepare('SELECT * FROM ai_providers ORDER BY name').all();
    return providers.map(p => ({
        ...p,
        enabled: Boolean(p.enabled),
        supportedModels: JSON.parse(p.supportedModels || '[]'),
        hasApiKey: Boolean(process.env[p.apiKeyEnvVar])
    }));
};

export const getEnabledProviders = () => {
    return getProviders().filter(p => p.enabled && p.hasApiKey);
};

export const getProvider = (id) => {
    const provider = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(id);
    if (!provider) return null;
    return {
        ...provider,
        enabled: Boolean(provider.enabled),
        supportedModels: JSON.parse(provider.supportedModels || '[]'),
        hasApiKey: Boolean(process.env[provider.apiKeyEnvVar])
    };
};

export const updateProvider = (id, updates) => {
    const allowedFields = ['name', 'enabled', 'defaultModel', 'maxTokens'];
    const fields = Object.keys(updates).filter(k => allowedFields.includes(k));

    if (fields.length === 0) return getProvider(id);

    const setClause = fields.map(f => `${f} = @${f}`).join(', ');
    const stmt = db.prepare(`UPDATE ai_providers SET ${setClause} WHERE id = @id`);
    stmt.run({ id, ...updates });

    return getProvider(id);
};

// ============ User Settings ============

const DEFAULT_SETTINGS = {
    hintVerbosity: 'balanced',
    feedbackStyle: 'encouraging',
    preferredProvider: null,
    temperature: 0.7,
    showExplanations: true,
    enableStreaming: true,
    enableHints: true,
    enableWritingFeedback: true,
    // Reading feature settings
    enableReadingCompanion: false,
    enableReflectionPrompts: false,
    enableInlineExplanations: false,
    enableReadingMetrics: true
};

export const getUserSettings = (userId) => {
    const settings = db.prepare('SELECT * FROM ai_user_settings WHERE userId = ?').get(userId);

    if (!settings) {
        return { ...DEFAULT_SETTINGS, userId };
    }

    return {
        userId: settings.userId,
        hintVerbosity: settings.hintVerbosity,
        feedbackStyle: settings.feedbackStyle,
        preferredProvider: settings.preferredProvider,
        temperature: settings.temperature,
        showExplanations: Boolean(settings.showExplanations),
        enableStreaming: Boolean(settings.enableStreaming),
        enableHints: Boolean(settings.enableHints),
        enableWritingFeedback: Boolean(settings.enableWritingFeedback),
        // Reading feature settings
        enableReadingCompanion: Boolean(settings.enableReadingCompanion),
        enableReflectionPrompts: Boolean(settings.enableReflectionPrompts),
        enableInlineExplanations: Boolean(settings.enableInlineExplanations),
        enableReadingMetrics: Boolean(settings.enableReadingMetrics ?? 1),
        updatedAt: settings.updatedAt
    };
};

export const updateUserSettings = (userId, updates) => {
    const existing = getUserSettings(userId);
    const merged = { ...existing, ...updates, userId, updatedAt: new Date().toISOString() };

    const stmt = db.prepare(`
        INSERT INTO ai_user_settings (
            userId, hintVerbosity, feedbackStyle, preferredProvider, temperature,
            showExplanations, enableStreaming, enableHints, enableWritingFeedback,
            enableReadingCompanion, enableReflectionPrompts, enableInlineExplanations, enableReadingMetrics,
            updatedAt
        )
        VALUES (
            @userId, @hintVerbosity, @feedbackStyle, @preferredProvider, @temperature,
            @showExplanations, @enableStreaming, @enableHints, @enableWritingFeedback,
            @enableReadingCompanion, @enableReflectionPrompts, @enableInlineExplanations, @enableReadingMetrics,
            @updatedAt
        )
        ON CONFLICT(userId) DO UPDATE SET
            hintVerbosity = @hintVerbosity,
            feedbackStyle = @feedbackStyle,
            preferredProvider = @preferredProvider,
            temperature = @temperature,
            showExplanations = @showExplanations,
            enableStreaming = @enableStreaming,
            enableHints = @enableHints,
            enableWritingFeedback = @enableWritingFeedback,
            enableReadingCompanion = @enableReadingCompanion,
            enableReflectionPrompts = @enableReflectionPrompts,
            enableInlineExplanations = @enableInlineExplanations,
            enableReadingMetrics = @enableReadingMetrics,
            updatedAt = @updatedAt
    `);

    stmt.run({
        ...merged,
        showExplanations: merged.showExplanations ? 1 : 0,
        enableStreaming: merged.enableStreaming ? 1 : 0,
        enableHints: merged.enableHints ? 1 : 0,
        enableWritingFeedback: merged.enableWritingFeedback ? 1 : 0,
        enableReadingCompanion: merged.enableReadingCompanion ? 1 : 0,
        enableReflectionPrompts: merged.enableReflectionPrompts ? 1 : 0,
        enableInlineExplanations: merged.enableInlineExplanations ? 1 : 0,
        enableReadingMetrics: merged.enableReadingMetrics ? 1 : 0
    });

    return getUserSettings(userId);
};

// Get effective settings (merge user prefs with defaults and provider info)
export const getEffectiveSettings = (userId) => {
    const userSettings = getUserSettings(userId);
    const providers = getEnabledProviders();

    // Determine effective provider
    let effectiveProvider = userSettings.preferredProvider;
    if (!effectiveProvider || !providers.find(p => p.id === effectiveProvider)) {
        // Fall back to first available provider
        effectiveProvider = providers[0]?.id || 'gemini';
    }

    const providerConfig = getProvider(effectiveProvider);

    return {
        ...userSettings,
        effectiveProvider,
        providerConfig,
        availableProviders: providers
    };
};

// ============ Prompt Templates ============

export const getPromptTemplates = (category = null) => {
    if (category) {
        return db.prepare('SELECT * FROM ai_prompt_templates WHERE category = ? AND isActive = 1 ORDER BY name').all(category);
    }
    return db.prepare('SELECT * FROM ai_prompt_templates WHERE isActive = 1 ORDER BY category, name').all();
};

export const getPromptTemplate = (id) => {
    const template = db.prepare('SELECT * FROM ai_prompt_templates WHERE id = ?').get(id);
    if (!template) return null;
    return {
        ...template,
        isActive: Boolean(template.isActive),
        variables: JSON.parse(template.variables || '[]')
    };
};

export const createPromptTemplate = ({ name, category, template, variables = [], createdBy = null }) => {
    const id = `${category}-${crypto.randomBytes(4).toString('hex')}`;

    db.prepare(`
        INSERT INTO ai_prompt_templates (id, name, category, template, variables, createdBy)
        VALUES (@id, @name, @category, @template, @variables, @createdBy)
    `).run({
        id,
        name,
        category,
        template,
        variables: JSON.stringify(variables),
        createdBy
    });

    return getPromptTemplate(id);
};

export const updatePromptTemplate = (id, updates) => {
    const existing = getPromptTemplate(id);
    if (!existing) return null;

    const allowedFields = ['name', 'template', 'variables', 'isActive'];
    const fields = Object.keys(updates).filter(k => allowedFields.includes(k));

    if (fields.length === 0) return existing;

    // Increment version if template content changes
    let version = existing.version;
    if (updates.template && updates.template !== existing.template) {
        version += 1;
    }

    const stmt = db.prepare(`
        UPDATE ai_prompt_templates
        SET name = @name, template = @template, variables = @variables, isActive = @isActive, version = @version, updatedAt = @updatedAt
        WHERE id = @id
    `);

    stmt.run({
        id,
        name: updates.name ?? existing.name,
        template: updates.template ?? existing.template,
        variables: updates.variables ? JSON.stringify(updates.variables) : JSON.stringify(existing.variables),
        isActive: updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : (existing.isActive ? 1 : 0),
        version,
        updatedAt: new Date().toISOString()
    });

    return getPromptTemplate(id);
};

// Render a template with variables
export const renderPromptTemplate = (templateId, variables) => {
    const template = getPromptTemplate(templateId);
    if (!template) return null;

    let rendered = template.template;

    // Simple variable substitution ({{variable}})
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        rendered = rendered.replace(regex, value ?? '');
    }

    // Handle conditionals ({{#if variable}}...{{/if}})
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    rendered = rendered.replace(conditionalRegex, (match, varName, content) => {
        return variables[varName] ? content : '';
    });

    return rendered;
};

// ============ Interaction Logging ============

export const logInteraction = ({
    userId,
    provider,
    model,
    promptCategory,
    inputTokens = null,
    outputTokens = null,
    latencyMs = null,
    success = true,
    errorMessage = null,
    context = null
}) => {
    const id = crypto.randomBytes(8).toString('hex');

    db.prepare(`
        INSERT INTO ai_interactions (id, userId, provider, model, promptCategory, inputTokens, outputTokens, latencyMs, success, errorMessage, context)
        VALUES (@id, @userId, @provider, @model, @promptCategory, @inputTokens, @outputTokens, @latencyMs, @success, @errorMessage, @context)
    `).run({
        id,
        userId,
        provider,
        model,
        promptCategory,
        inputTokens,
        outputTokens,
        latencyMs,
        success: success ? 1 : 0,
        errorMessage,
        context: context ? JSON.stringify(context) : null
    });

    return id;
};

export const getUserInteractions = (userId, limit = 50, offset = 0) => {
    return db.prepare(`
        SELECT * FROM ai_interactions
        WHERE userId = ?
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
};

export const getInteractionStats = (userId = null, days = 30) => {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    if (userId) {
        return db.prepare(`
            SELECT
                provider,
                promptCategory,
                COUNT(*) as count,
                SUM(inputTokens) as totalInputTokens,
                SUM(outputTokens) as totalOutputTokens,
                AVG(latencyMs) as avgLatency,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errors
            FROM ai_interactions
            WHERE userId = ? AND timestamp >= ?
            GROUP BY provider, promptCategory
        `).all(userId, sinceStr);
    }

    // Admin: all users
    return db.prepare(`
        SELECT
            provider,
            promptCategory,
            COUNT(DISTINCT userId) as uniqueUsers,
            COUNT(*) as count,
            SUM(inputTokens) as totalInputTokens,
            SUM(outputTokens) as totalOutputTokens,
            AVG(latencyMs) as avgLatency,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errors
        FROM ai_interactions
        WHERE timestamp >= ?
        GROUP BY provider, promptCategory
        ORDER BY count DESC
    `).all(sinceStr);
};

// ============ Centralized Configuration Getters ============
// These are the canonical sources for AI configuration - use these instead of reading env vars directly

// Get the default provider ID from environment
export const getDefaultProviderId = () => {
    return process.env.DEFAULT_AI_PROVIDER || 'gemini';
};

// Get the default model for the current/specified provider
export const getDefaultModel = (providerId = null) => {
    const id = providerId || getDefaultProviderId();

    // Check for provider-specific env var first
    switch (id) {
        case 'openrouter':
            if (process.env.OPENROUTER_MODEL) return process.env.OPENROUTER_MODEL;
            break;
        case 'openai':
            if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL;
            break;
        case 'gemini':
            if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
            break;
        case 'claude':
            if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL;
            break;
        case 'groq':
            if (process.env.GROQ_MODEL) return process.env.GROQ_MODEL;
            break;
    }

    // Fall back to provider's defaultModel from database
    const provider = getProvider(id);
    return provider?.defaultModel || '';
};

// Get the API key for a provider
export const getApiKey = (providerId = null) => {
    const id = providerId || getDefaultProviderId();
    const provider = getProvider(id);
    if (!provider) return null;
    return process.env[provider.apiKeyEnvVar] || null;
};

// Get complete config for making AI requests
export const getAIConfig = (providerId = null) => {
    const id = providerId || getDefaultProviderId();
    const provider = getProvider(id);

    return {
        providerId: id,
        model: getDefaultModel(id),
        apiKey: getApiKey(id),
        baseUrl: provider?.baseUrl || null,
        maxTokens: provider?.maxTokens || 2048
    };
};

// ============ Provider Health Check ============

export const checkProviderHealth = async (providerId) => {
    const provider = getProvider(providerId);
    if (!provider) return { status: 'error', message: 'Provider not found' };
    if (!provider.hasApiKey) return { status: 'error', message: 'API key not configured' };
    if (!provider.enabled) return { status: 'disabled', message: 'Provider is disabled' };

    const startTime = Date.now();

    try {
        // Simple ping test based on provider
        switch (providerId) {
            case 'gemini': {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                break;
            }
            case 'openai': {
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                break;
            }
            case 'claude': {
                // Claude doesn't have a simple health check endpoint, so we'll just verify the key format
                const key = process.env.ANTHROPIC_API_KEY;
                if (!key || !key.startsWith('sk-ant-')) throw new Error('Invalid API key format');
                break;
            }
            case 'groq': {
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                break;
            }
            case 'openrouter': {
                const res = await fetch('https://openrouter.ai/api/v1/models', {
                    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                break;
            }
            default:
                return { status: 'unknown', message: 'Unknown provider' };
        }

        return {
            status: 'healthy',
            latencyMs: Date.now() - startTime,
            model: provider.defaultModel
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message,
            latencyMs: Date.now() - startTime
        };
    }
};

export default {
    // Providers
    getProviders,
    getEnabledProviders,
    getProvider,
    updateProvider,
    checkProviderHealth,

    // Centralized config getters (use these!)
    getDefaultProviderId,
    getDefaultModel,
    getApiKey,
    getAIConfig,

    // User settings
    getUserSettings,
    updateUserSettings,
    getEffectiveSettings,

    // Prompt templates
    getPromptTemplates,
    getPromptTemplate,
    createPromptTemplate,
    updatePromptTemplate,
    renderPromptTemplate,

    // Logging
    logInteraction,
    getUserInteractions,
    getInteractionStats
};
