#!/usr/bin/env node
/**
 * Render Plan 2.5 AF6 generalization scene-set YAML into per-scene branch specs.
 *
 * This keeps the source scene set compact while preserving replay compatibility:
 * each rendered scene directory contains a frozen-prefix file and branch-spec.yaml
 * consumable by scripts/replay-plan25-prefix-branches.js.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function usage() {
  return `Usage:
  node scripts/render-plan25-generalization-scenes.js \\
    --scene-set config/poetics-calibration/plan25-af6-generalization/scene-set.yaml \\
    --out-dir config/poetics-calibration/plan25-af6-generalization/rendered \\
    [--force]
`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const opts = { sceneSet: null, outDir: null, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--scene-set':
        opts.sceneSet = path.resolve(argv[++i]);
        break;
      case '--out-dir':
        opts.outDir = path.resolve(argv[++i]);
        break;
      case '--force':
        opts.force = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        throw new Error(`Unknown arg: ${argv[i]}\n\n${usage()}`);
    }
  }
  return opts;
}

function readYaml(p) {
  return yaml.parse(fs.readFileSync(p, 'utf8')) || {};
}

function renderTemplate(text, vars) {
  return String(text || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    if (vars[key] == null) throw new Error(`Missing template variable {${key}}`);
    return String(vars[key]);
  });
}

function renderBranch(branch, vars, scene) {
  return {
    ...branch,
    numeric_profile: scene.numeric_profile,
    public_response: renderTemplate(branch.public_response, vars),
  };
}

function renderScene({ sceneSetPath, sceneSet, template, scene, outDir }) {
  const sceneDir = path.join(outDir, scene.id);
  fs.mkdirSync(sceneDir, { recursive: true });
  const prefixPath = path.join(sceneDir, 'frozen-prefix.txt');
  fs.writeFileSync(prefixPath, String(scene.prefix || '').trim() + '\n', 'utf8');

  const vars = scene.numeric_profile || {};
  const branches = Object.fromEntries(
    Object.entries(template.branches || {}).map(([key, branch]) => [key, renderBranch(branch, vars, scene)]),
  );
  const criteria = JSON.parse(JSON.stringify(template.success_criteria || {}));
  const evidenceCriterion = criteria.cheap_replay_screen?.evidence_route_count_refutation;
  if (evidenceCriterion) {
    evidenceCriterion.required_learner_numbers = scene.numeric_profile?.required_learner_numbers || [];
  }

  const provenance = {
    ...(sceneSet.defaults?.provenance || {}),
    ...(scene.provenance || {}),
    scene_id: scene.id,
    scene_tier: scene.tier,
    source_scene_set: path.relative(ROOT, sceneSetPath),
  };

  const design = {
    schema: 'plan25_af6_generalization_rendered_scene_v0_1',
    created_at: new Date().toISOString().slice(0, 10),
    status: 'stage0_mock_ready',
    scene_id: scene.id,
    tier: scene.tier,
    description: scene.description,
    claim_boundary:
      'Rendered fresh-scene prefix for Plan 2.5 AF6 generalization. Mock runs validate plumbing only; live multi-critic runs are required for promotion.',
    source: {
      scene_set: path.relative(ROOT, sceneSetPath),
      source_tid: scene.id,
      source_drama_id: `D_AF6_PLAN25_GENERALIZATION_${scene.id}`,
      source_score: 'fresh_scene_unscored',
    },
    provenance,
    numeric_profile: scene.numeric_profile,
    freeze: {
      frozen_prefix_file: 'frozen-prefix.txt',
      freeze_through: 'learner_overconfident_scene_specific_claim',
      branch_first_live_role: 'tutor',
      rationale:
        'The learner defends the scene-specific headline route while the raw public evidence is visible; branch manipulation starts with the next tutor response.',
    },
    branches,
    forbidden_in_control_public_speech: template.forbidden_in_control_public_speech || [],
    success_criteria: criteria,
    promotion_rule:
      'For this scene, promote only if the evidence branch passes the required evidence-route gate under required critic agreement, both controls avoid tutor-side metric leakage, and controls do not receive induced evidence_route attribution.',
    stop_rule:
      'Stop or characterize failure if the evidence branch is action-only, if a control leaks tutor-side metric repair, or if a control receives induced evidence_route attribution.',
  };
  fs.writeFileSync(path.join(sceneDir, 'branch-spec.yaml'), yaml.stringify(design, { lineWidth: 0 }), 'utf8');
  return sceneDir;
}

function main() {
  const opts = parseArgs();
  if (opts.help) {
    process.stdout.write(usage());
    return;
  }
  if (!opts.sceneSet) throw new Error(`Missing --scene-set\n\n${usage()}`);
  if (!opts.outDir) throw new Error(`Missing --out-dir\n\n${usage()}`);
  if (!fs.existsSync(opts.sceneSet)) throw new Error(`Scene set not found: ${opts.sceneSet}`);
  if (fs.existsSync(opts.outDir)) {
    if (!opts.force) throw new Error(`Output dir exists; pass --force: ${opts.outDir}`);
    fs.rmSync(opts.outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(opts.outDir, { recursive: true });

  const sceneSet = readYaml(opts.sceneSet);
  const templatePath = path.resolve(path.dirname(opts.sceneSet), sceneSet.template || 'branch-template.yaml');
  const template = readYaml(templatePath);
  const rendered = (sceneSet.scenes || []).map((scene) =>
    renderScene({ sceneSetPath: opts.sceneSet, sceneSet, template, scene, outDir: opts.outDir }),
  );
  const index = {
    schema: 'plan25_af6_generalization_rendered_index_v0_1',
    generated_at: new Date().toISOString(),
    scene_set: path.relative(ROOT, opts.sceneSet),
    template: path.relative(ROOT, templatePath),
    scenes: rendered.map((dir) => ({
      id: path.basename(dir),
      dir: path.relative(ROOT, dir),
      design: path.relative(ROOT, path.join(dir, 'branch-spec.yaml')),
      prefix: path.relative(ROOT, path.join(dir, 'frozen-prefix.txt')),
    })),
  };
  fs.writeFileSync(path.join(opts.outDir, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
  process.stdout.write(`Rendered ${rendered.length} scene(s) to ${path.relative(ROOT, opts.outDir)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseArgs, renderTemplate };
