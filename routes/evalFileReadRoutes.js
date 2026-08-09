import fs from 'node:fs';
import path from 'node:path';

export const EVAL_PROMPT_READ_ROUTES = Object.freeze(['/prompts', '/prompts/:name']);
export const EVAL_TRAJECTORY_READ_ROUTES = Object.freeze(['/trajectory/:profile']);
export const EVAL_DOCUMENTATION_READ_ROUTES = Object.freeze(['/docs', '/docs/:name']);

const PROMPTS_DIR = path.join(process.cwd(), 'prompts');
const EVAL_DOCS_DIR = path.join(process.cwd(), 'markdown', 'eval');
const RESEARCH_DOCS_DIR = path.join(process.cwd(), 'docs', 'research');

function isSafeRouteFileName(value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) return false;
  return value === path.basename(value) && value === path.win32.basename(value) && value !== '.' && value !== '..';
}

export function registerEvalPromptReadRoutes(router) {
  const [promptsPath, promptPath] = EVAL_PROMPT_READ_ROUTES;
  router.get(promptsPath, (_req, res) => {
    try {
      if (!fs.existsSync(PROMPTS_DIR)) return res.json({ success: true, prompts: [] });
      const files = fs
        .readdirSync(PROMPTS_DIR)
        .filter((file) => file.endsWith('.md'))
        .map((file) => {
          const filePath = path.join(PROMPTS_DIR, file);
          const stats = fs.statSync(filePath);
          return {
            name: file.replace('.md', ''),
            filename: file,
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        });
      res.json({ success: true, prompts: files });
    } catch (error) {
      console.error('[EvalRoutes] List prompts error:', error);
      res.status(500).json({ error: 'Failed to list prompts' });
    }
  });

  router.get(promptPath, (req, res) => {
    try {
      if (!isSafeRouteFileName(req.params.name)) return res.status(400).json({ error: 'Invalid prompt name' });
      const filename = req.params.name.endsWith('.md') ? req.params.name : `${req.params.name}.md`;
      const filePath = path.join(PROMPTS_DIR, filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Prompt not found' });
      const content = fs.readFileSync(filePath, 'utf8');
      const stats = fs.statSync(filePath);
      res.json({
        success: true,
        prompt: {
          name: req.params.name,
          filename,
          content,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        },
      });
    } catch (error) {
      console.error('[EvalRoutes] Get prompt error:', error);
      res.status(500).json({ error: 'Failed to get prompt' });
    }
  });
}

export function registerEvalTrajectoryReadRoutes(router) {
  router.get(EVAL_TRAJECTORY_READ_ROUTES[0], (req, res) => {
    try {
      const { profile } = req.params;
      if (!isSafeRouteFileName(profile)) return res.status(400).json({ error: 'Invalid profile name' });
      const last = parseInt(req.query.last) || 5;
      const all = req.query.all === 'true';
      const trajectoryFile = path.join(process.cwd(), 'data', 'improvement-trajectories', `${profile}.json`);
      if (!fs.existsSync(trajectoryFile)) {
        return res.json({
          success: true,
          profile,
          cycles: [],
          message: 'No improvement history found for this profile',
        });
      }
      const data = JSON.parse(fs.readFileSync(trajectoryFile, 'utf8'));
      const cycles = all ? data.cycles : data.cycles.slice(-last);
      res.json({
        success: true,
        profile,
        startedAt: data.startedAt,
        lastUpdated: data.lastUpdated,
        totalCycles: data.cycles.length,
        cycles,
      });
    } catch (error) {
      console.error('[EvalRoutes] Get trajectory error:', error);
      res.status(500).json({ error: 'Failed to get trajectory', details: error.message });
    }
  });
}

export function registerEvalDocumentationReadRoutes(router) {
  const [docsPath, docPath] = EVAL_DOCUMENTATION_READ_ROUTES;
  router.get(docsPath, (_req, res) => {
    try {
      if (!fs.existsSync(EVAL_DOCS_DIR)) return res.json({ success: true, docs: [] });
      const files = fs
        .readdirSync(EVAL_DOCS_DIR)
        .filter((file) => file.endsWith('.md'))
        .map((file) => {
          const filePath = path.join(EVAL_DOCS_DIR, file);
          const stats = fs.statSync(filePath);
          const name = file.replace('.md', '');
          const title = name.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
          return { name, filename: file, title, size: stats.size, modified: stats.mtime.toISOString() };
        })
        .sort((left, right) => left.title.localeCompare(right.title));
      res.json({ success: true, docs: files });
    } catch (error) {
      console.error('[EvalRoutes] List docs error:', error);
      res.status(500).json({ error: 'Failed to list docs' });
    }
  });

  router.get(docPath, (req, res) => {
    try {
      let docName = req.params.name;
      let docsDir = EVAL_DOCS_DIR;
      if (docName.startsWith('research:')) {
        docName = docName.substring('research:'.length);
        docsDir = RESEARCH_DOCS_DIR;
      }
      if (!isSafeRouteFileName(docName)) {
        return res.status(400).json({ error: 'Invalid documentation name' });
      }
      const filename = docName.endsWith('.md') ? docName : `${docName}.md`;
      const filePath = path.join(docsDir, filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Documentation not found' });
      const content = fs.readFileSync(filePath, 'utf8');
      const stats = fs.statSync(filePath);
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch
        ? titleMatch[1]
        : docName.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      res.json({
        success: true,
        doc: {
          name: req.params.name,
          filename,
          title,
          content,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        },
      });
    } catch (error) {
      console.error('[EvalRoutes] Get doc error:', error);
      res.status(500).json({ error: 'Failed to get documentation' });
    }
  });
}
