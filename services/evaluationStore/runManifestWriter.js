import fs from 'node:fs';
import path from 'node:path';

export function createRunManifestWriter({
  db,
  logsRoot,
  uniqueGenerationResults,
  expectedTestsForRun,
  fileSystem = fs,
}) {
  const manifestsDir = path.join(logsRoot, 'run-manifests');

  function writeRunManifest(runId, run, results, completedAt) {
    try {
      if (!fileSystem.existsSync(manifestsDir)) {
        fileSystem.mkdirSync(manifestsDir, { recursive: true });
      }

      const rows = {};
      const configHashes = {};
      const profiles = new Set();
      const scenarios = new Set();
      const judgeModels = new Set();

      const rubricVersionMap = {};
      try {
        const versionRows = db
          .prepare('SELECT id, tutor_rubric_version FROM evaluation_results WHERE run_id = ?')
          .all(runId);
        for (const row of versionRows) rubricVersionMap[String(row.id)] = row.tutor_rubric_version || null;
      } catch {
        // Historical databases may not expose the rubric-version projection.
      }

      for (const result of results) {
        const rowId = String(result.id);
        rows[rowId] = {
          dialogueId: result.dialogueId || null,
          dialogueContentHash: result.dialogueContentHash || null,
          configHash: result.configHash || null,
          profileName: result.profileName || null,
          scenarioId: result.scenarioId || null,
          attemptIndex: result.attemptIndex ?? null,
          learnerId: result.learnerId || null,
          judgeModel: result.judgeModel || null,
          tutorRubricVersion: rubricVersionMap[rowId] || null,
          promptContentHash: result.promptContentHash || null,
          tutorEgoPromptVersion: result.tutorEgoPromptVersion || null,
          tutorSuperegoPromptVersion: result.tutorSuperegoPromptVersion || null,
          learnerPromptVersion: result.learnerPromptVersion || null,
        };

        if (result.configHash && result.profileName) {
          configHashes[result.profileName] = result.configHash;
        }
        if (result.profileName) profiles.add(result.profileName);
        if (result.scenarioId) scenarios.add(result.scenarioId);
        if (result.judgeModel) judgeModels.add(result.judgeModel);
      }

      const rubricVersions = [...new Set(Object.values(rubricVersionMap).filter(Boolean))].sort();
      const manifest = {
        run_id: runId,
        created_at: run.createdAt,
        completed_at: completedAt,
        git_commit: run.gitCommit || null,
        package_version: run.packageVersion || null,
        description: run.description || null,
        total_rows: results.length,
        total_generations: uniqueGenerationResults(results).length,
        expected_tests: expectedTestsForRun(run),
        profiles: [...profiles].sort(),
        scenarios: [...scenarios].sort(),
        judge_models: [...judgeModels].sort(),
        rubric_versions: rubricVersions,
        config_hashes: configHashes,
        rows,
      };

      fileSystem.writeFileSync(path.join(manifestsDir, `${runId}.json`), JSON.stringify(manifest, null, 2));
    } catch {
      // Manifest persistence is provenance support and must not block run completion.
    }
  }

  return Object.freeze({ writeRunManifest });
}
