function responseConfigurationPresentationColors(colors = {}) {
  return {
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    red: colors.red || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubResponseConfigurationLines(presentation = {}, { colors = {} } = {}) {
  const C = responseConfigurationPresentationColors(colors);
  const previousEfficacy = presentation.previousEfficacy || null;
  const lines = [];
  if (previousEfficacy) {
    const mismatch = previousEfficacy.mismatch
      ? `; ${previousEfficacy.mismatch}; field ${presentation.fieldDelta || '0'}`
      : '';
    lines.push(
      `${C.cyan}stance efficacy >${C.reset} ${
        previousEfficacy.engagement_stance || previousEfficacy.selected_register
      } ${previousEfficacy.label}${mismatch} (${previousEfficacy.summary})`,
    );
    if (previousEfficacy.learnerFeedback?.rating) {
      lines.push(
        `${C.dim}  explicit learner rating: ${
          previousEfficacy.learnerFeedback.rating === 'up' ? '👍 helpful' : '👎 not helpful'
        }; self-assessment ${previousEfficacy.selfAssessmentLabel}${C.reset}`,
      );
    }
  }

  const selection = presentation.selection || null;
  if (!selection) return Object.freeze(lines);
  const warning = selection.warning ? ` ${C.red}${selection.warning}${C.reset}` : '';
  const confidence = selection.confidence !== null ? `; confidence ${selection.confidence}` : '';
  const source =
    selection.source && selection.source !== 'combined_learner_analysis' ? `; source ${selection.source}` : '';
  lines.push(
    `${C.cyan}engagement stance >${C.reset} ${
      selection.engagement_stance || selection.selected_register
    }${confidence}${source}${warning}`,
  );

  if (selection.light_adaptation?.triggered) {
    lines.push(
      `${C.dim}  light adaptation: continued confusion/frustration streak ${selection.light_adaptation.streak}; stance and host character shifted with seeded draws${C.reset}`,
    );
  } else if (selection.random_performance?.enabled) {
    lines.push(
      `${C.dim}  random performance: stance and host character sampled independently of learner assessment; action and safety controls retained${C.reset}`,
    );
  } else if (Number.isFinite(Number(selection.temperature))) {
    lines.push(
      `${C.dim}  adaptive-performance temperature: ${selection.temperature} (stance + part; lower sharper, higher broader)${C.reset}`,
    );
  }
  if (selection.policy_composition) {
    const composition = selection.policy_composition;
    lines.push(
      `${C.dim}  policy stack: ${composition.policy_stack}; overlay threshold ${composition.overlay_threshold}; activated ${
        composition.activated_overlay || 'primary'
      }${C.reset}`,
    );
  }
  if (presentation.distribution) {
    lines.push(`${C.dim}  distribution: ${presentation.distribution}${C.reset}`);
  }
  if (selection.continuous_register_policy?.dominant_blend) {
    lines.push(
      `${C.dim}  continuous blend: ${selection.continuous_register_policy.dominant_blend}; entropy ${
        selection.continuous_register_policy.entropy_bits ?? 'n/a'
      } bits${C.reset}`,
    );
  }
  if (selection.request_type || selection.reviewer_signal) {
    lines.push(
      `${C.dim}  request: ${selection.request_type || 'unknown'}; action: ${
        selection.action_family || 'none'
      }; reviewer signal: ${selection.reviewer_signal || 'unknown'}${C.reset}`,
    );
  }
  lines.push(
    `${C.dim}  audience: ${selection.audience_register || 'unknown'}; lexical: ${
      selection.lexical_accessibility || 'unknown'
    }; scene: ${selection.scene_immersion || 'unknown'}; part: ${
      selection.actorial_part_label || selection.actorial_part || 'unknown'
    }${C.reset}`,
  );
  if (presentation.partDistribution !== null && presentation.partDistribution !== undefined) {
    lines.push(
      `${C.dim}  part distribution: ${presentation.partDistribution}; reason: ${
        selection.actorial_part_selection?.reason || 'n/a'
      }${C.reset}`,
    );
  }
  if (selection.register_reason) lines.push(`${C.dim}  reason: ${selection.register_reason}${C.reset}`);
  if (selection.expected_dag_move) {
    lines.push(`${C.dim}  expected DAG move: ${selection.expected_dag_move}${C.reset}`);
  }
  if (selection.expected_field_move) {
    const effectivePolicy = selection.activated_policy || selection.primary_policy || selection.policy;
    const expectedMoveLabel =
      effectivePolicy === 'state'
        ? 'expected state move'
        : effectivePolicy === 'trajectory'
          ? 'expected trajectory move'
          : effectivePolicy === 'dynamical_system' ||
              effectivePolicy === 'empirical_dynamical_system' ||
              effectivePolicy === 'continuous_dynamical_system' ||
              effectivePolicy === 'continuous_empirical_dynamical_system'
            ? 'expected dynamical move'
            : 'expected field move';
    lines.push(`${C.dim}  ${expectedMoveLabel}: ${selection.expected_field_move}${C.reset}`);
  }
  return Object.freeze(lines);
}
