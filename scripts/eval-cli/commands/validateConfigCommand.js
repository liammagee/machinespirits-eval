export async function runValidateConfigCommand(context) {
  const { getFlag, getOption, evalConfigLoader, evaluationRunner, path, __dirname, fs, loadContentResolver } = context;

  const verbose = getFlag('verbose');
  const filterProfile = getOption('profile');

  console.log('\nValidating configuration...\n');

  let errors = 0;
  let warnings = 0;

  // ── Load core configs ─────────────────────────────────────────
  const tutorAgentsData = evalConfigLoader.loadTutorAgents({ forceReload: true });
  if (!tutorAgentsData?.profiles) {
    console.error('  FATAL: Could not load tutor-agents.yaml');
    process.exit(1);
  }
  const allProfiles = tutorAgentsData.profiles;
  const profileNames = Object.keys(allProfiles);

  const providersData = evalConfigLoader.loadProviders({ forceReload: true });
  if (!providersData?.providers) {
    console.error('  FATAL: Could not load providers.yaml');
    process.exit(1);
  }
  const providerNames = Object.keys(providersData.providers);

  const scenarios = evalConfigLoader.listScenarios();
  const contentConfig = evalConfigLoader.getContentConfig();

  const yamlCellCount = profileNames.filter((name) => name.startsWith('cell_')).length;
  console.log(
    `  Profiles:  ${profileNames.length} profiles loaded from tutor-agents.yaml (${yamlCellCount} canonical cells)`,
  );
  console.log(`  Scenarios: ${scenarios.length} scenarios loaded`);
  console.log(`  Providers: ${providerNames.length} providers configured (${providerNames.join(', ')})`);
  console.log('');

  // Determine which profiles to validate
  const profilesToCheck = filterProfile ? filterProfile.split(',').map((p) => p.trim()) : profileNames;

  if (filterProfile) {
    const missing = profilesToCheck.filter((p) => !allProfiles[p]);
    if (missing.length > 0) {
      console.error(`  Profile(s) not found in YAML: ${missing.join(', ')}`);
      process.exit(1);
    }
    console.log(`  Validating ${profilesToCheck.length} profile(s): ${profilesToCheck.join(', ')}\n`);
  }

  console.log('Checks:');

  // ── 1. Canonical evaluation-profile registry ──────────────────
  const { CANONICAL_EVAL_PROFILES, LEGACY_EVAL_PROFILE_ALIASES, validateEvalProfileRegistry } = evaluationRunner;
  const registryValidation = validateEvalProfileRegistry({
    profiles: allProfiles,
    canonicalCellNames: CANONICAL_EVAL_PROFILES,
    legacyAliases: LEGACY_EVAL_PROFILE_ALIASES,
  });
  if (!registryValidation.valid) {
    console.log(`  \u2717 Evaluation-profile registry: ${registryValidation.errors.length} error(s)`);
    for (const registryError of registryValidation.errors) {
      console.log(`      - ${registryError}`);
    }
    errors += registryValidation.errors.length;
  } else {
    console.log(
      `  \u2713 Canonical registry exactly matches all ${CANONICAL_EVAL_PROFILES.length} YAML cells (${Object.keys(LEGACY_EVAL_PROFILE_ALIASES).length} explicit legacy aliases)`,
    );
  }

  // ── 2. Provider resolution ────────────────────────────────────
  const providerErrors = [];
  for (const name of profilesToCheck) {
    const profile = allProfiles[name];
    if (profile.ego?.provider && !providersData.providers[profile.ego.provider]) {
      providerErrors.push(`${name}: ego provider '${profile.ego.provider}' not found`);
    }
    if (profile.superego?.provider && !providersData.providers[profile.superego.provider]) {
      providerErrors.push(`${name}: superego provider '${profile.superego.provider}' not found`);
    }
  }
  if (providerErrors.length > 0) {
    console.log(`  \u2717 Provider resolution: ${providerErrors.length} error(s)`);
    for (const e of providerErrors) console.log(`      - ${e}`);
    errors += providerErrors.length;
  } else {
    console.log('  \u2713 All provider references resolve');
  }

  // ── 3. Model alias resolution ─────────────────────────────────
  const modelErrors = [];
  for (const name of profilesToCheck) {
    const profile = allProfiles[name];
    if (profile.ego?.provider && profile.ego?.model) {
      try {
        evalConfigLoader.resolveModel(`${profile.ego.provider}.${profile.ego.model}`);
      } catch (e) {
        modelErrors.push(`${name}: ego model '${profile.ego.provider}.${profile.ego.model}' — ${e.message}`);
      }
    }
    if (profile.superego?.provider && profile.superego?.model) {
      try {
        evalConfigLoader.resolveModel(`${profile.superego.provider}.${profile.superego.model}`);
      } catch (e) {
        modelErrors.push(
          `${name}: superego model '${profile.superego.provider}.${profile.superego.model}' — ${e.message}`,
        );
      }
    }
  }
  if (modelErrors.length > 0) {
    console.log(`  \u2717 Model alias resolution: ${modelErrors.length} error(s)`);
    for (const e of modelErrors) console.log(`      - ${e}`);
    errors += modelErrors.length;
  } else {
    console.log('  \u2713 All model aliases resolve');
  }

  // ── 4. Dialogue consistency ───────────────────────────────────
  const dialogueErrors = [];
  let multiAgentCount = 0;
  let singleAgentCount = 0;
  for (const name of profilesToCheck) {
    const profile = allProfiles[name];
    const usesAdaptiveRunner = profile.runner === 'adaptive';
    const usesSingleAgentTutor = profile.factors?.multi_agent_tutor === false;
    const dialogueEnabled = profile.dialogue?.enabled ?? false;
    if (dialogueEnabled) {
      multiAgentCount++;
      const maxRounds = profile.dialogue?.max_rounds ?? 0;
      if (maxRounds <= 0) {
        dialogueErrors.push(`${name}: dialogue enabled but max_rounds=${maxRounds}`);
      }
      if (!usesAdaptiveRunner && !usesSingleAgentTutor && (!profile.superego || profile.superego === null)) {
        dialogueErrors.push(`${name}: dialogue enabled but superego is null`);
      }
    } else {
      singleAgentCount++;
    }
  }
  if (dialogueErrors.length > 0) {
    console.log(`  \u2717 Dialogue config: ${dialogueErrors.length} inconsistency(ies)`);
    for (const e of dialogueErrors) console.log(`      - ${e}`);
    errors += dialogueErrors.length;
  } else {
    console.log(
      `  \u2713 Dialogue config consistent (${multiAgentCount} multi-agent, ${singleAgentCount} single-agent)`,
    );
  }

  // ── 5. Learner architecture ───────────────────────────────────
  const VALID_LEARNER_ARCHS = [
    'unified',
    'unified_recognition',
    'ego_superego',
    'ego_superego_recognition',
    'ego_superego_authentic',
    'ego_superego_recognition_authentic',
    'adaptive_externalised',
    'scripted_trap',
    'ego_superego_bilateral_tom',
  ];
  const learnerErrors = [];
  for (const name of profilesToCheck) {
    const profile = allProfiles[name];
    if (profile.learner_architecture && !VALID_LEARNER_ARCHS.includes(profile.learner_architecture)) {
      learnerErrors.push(
        `${name}: learner_architecture='${profile.learner_architecture}' (expected one of: ${VALID_LEARNER_ARCHS.join(', ')})`,
      );
    }
  }
  if (learnerErrors.length > 0) {
    console.log(`  \u2717 Learner architectures: ${learnerErrors.length} invalid`);
    for (const e of learnerErrors) console.log(`      - ${e}`);
    errors += learnerErrors.length;
  } else {
    console.log('  \u2713 Learner architectures valid');
  }

  // ── 6. Scenario course_ids ────────────────────────────────────
  if (contentConfig?.content_package_path) {
    const { isConfigured, listAvailableCourses, configure } = await loadContentResolver();
    configure({
      contentPackagePath: contentConfig.content_package_path,
      maxLectureChars: contentConfig.max_lecture_chars,
      includeSpeakerNotes: contentConfig.include_speaker_notes,
    });

    if (isConfigured()) {
      const availableCourses = listAvailableCourses();
      const courseErrors = [];
      const scenarioData = evalConfigLoader.loadSuggestionScenarios({ forceReload: true });
      const scenarioMap = scenarioData?.scenarios || {};
      for (const [id, scenario] of Object.entries(scenarioMap)) {
        if (scenario.course_ids) {
          for (const courseId of scenario.course_ids) {
            if (!availableCourses.includes(courseId)) {
              courseErrors.push(`scenario '${id}': course_id '${courseId}' not found in content directory`);
            }
          }
        }
      }
      if (courseErrors.length > 0) {
        console.log(`  \u2717 Scenario course_ids: ${courseErrors.length} unresolved`);
        for (const e of courseErrors) console.log(`      - ${e}`);
        warnings += courseErrors.length;
      } else {
        console.log(`  \u2713 Scenario course_ids resolve to content directories`);
      }
    } else {
      console.log('  - Scenario course_ids: content directory not found (skipped)');
    }
  } else {
    console.log('  - Scenario course_ids: no content_package_path configured (skipped)');
  }

  // ── 7. Hyperparameters ────────────────────────────────────────
  const hyperErrors = [];
  for (const name of profilesToCheck) {
    const profile = allProfiles[name];
    for (const role of ['ego', 'superego']) {
      const hyper = profile[role]?.hyperparameters;
      if (!hyper) continue;
      if (hyper.temperature != null && (hyper.temperature < 0 || hyper.temperature > 2)) {
        hyperErrors.push(`${name}: ${role} temperature=${hyper.temperature} (expected 0-2)`);
      }
      if (hyper.max_tokens != null && hyper.max_tokens <= 0) {
        hyperErrors.push(`${name}: ${role} max_tokens=${hyper.max_tokens} (expected > 0)`);
      }
    }
  }
  if (hyperErrors.length > 0) {
    console.log(`  \u2717 Hyperparameters: ${hyperErrors.length} issue(s)`);
    for (const e of hyperErrors) console.log(`      - ${e}`);
    warnings += hyperErrors.length;
  } else {
    console.log('  \u2713 Hyperparameters within valid ranges');
  }

  // ── 8. Prompt file existence ──────────────────────────────────
  // Prompt files live in this repo's in-housed tutor-core/prompts/
  // (vendored from the former @machinespirits/tutor-core — see TUTOR-CORE-INHOUSING.md).
  const vendoredPromptsDir = path.resolve(__dirname, '..', 'tutor-core', 'prompts');
  const tutorCorePromptsDir = fs.existsSync(vendoredPromptsDir) ? vendoredPromptsDir : null;

  const promptDirs = [path.resolve(__dirname, '..', 'prompts')];
  if (tutorCorePromptsDir && fs.existsSync(tutorCorePromptsDir)) {
    promptDirs.push(tutorCorePromptsDir);
  }
  const existingPromptDirs = promptDirs.filter((dir, index) => fs.existsSync(dir) && promptDirs.indexOf(dir) === index);

  if (existingPromptDirs.length > 0) {
    const promptErrors = [];
    const checkedFiles = new Set();
    for (const name of profilesToCheck) {
      const profile = allProfiles[name];
      for (const role of ['ego', 'superego']) {
        const promptFile = profile[role]?.prompt_file;
        if (promptFile && !checkedFiles.has(promptFile)) {
          checkedFiles.add(promptFile);
          const found = existingPromptDirs.some((dir) => fs.existsSync(path.join(dir, promptFile)));
          if (!found) {
            promptErrors.push(`${name}: ${role} prompt_file '${promptFile}' not found`);
          }
        }
      }
    }
    if (promptErrors.length > 0) {
      console.log(`  \u2717 Prompt files: ${promptErrors.length} missing`);
      for (const e of promptErrors) console.log(`      - ${e}`);
      errors += promptErrors.length;
    } else {
      console.log(`  \u2713 All ${checkedFiles.size} prompt files exist`);
    }
  } else {
    console.log('  - Prompt files: prompts directories not found (skipped)');
  }

  // ── Verbose: per-profile detail ───────────────────────────────
  if (verbose) {
    console.log('\n' + '─'.repeat(60));
    console.log('  Per-profile details:');
    console.log('─'.repeat(60));
    for (const name of profilesToCheck) {
      const profile = allProfiles[name];
      const arch = profile.dialogue?.enabled ? 'ego+superego' : 'single-agent';
      const learner = profile.learner_architecture || '(default)';
      const egoRef = profile.ego ? `${profile.ego.provider}.${profile.ego.model}` : '(none)';
      const supRef = profile.superego ? `${profile.superego.provider}.${profile.superego.model}` : '(none)';
      const recog = profile.recognition_mode ? 'yes' : 'no';
      console.log(`  ${name}`);
      console.log(`    arch: ${arch}  learner: ${learner}  recog: ${recog}`);
      console.log(`    ego: ${egoRef}  superego: ${supRef}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log(`\n${warnings} warning(s), ${errors} error(s)`);
  if (errors > 0) {
    process.exit(1);
  }
}
