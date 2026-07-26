function presentationColors(colors = {}) {
  return {
    brightCyan: colors.brightCyan || '',
    brightGreen: colors.brightGreen || '',
    bold: colors.bold || '',
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubFeatureMapLines({ featureRows = [], activeContext = null, colors = {} } = {}) {
  const C = presentationColors(colors);
  const lines = [`${C.brightCyan}${C.bold}tutor-stub capability map${C.reset}`];

  for (const row of featureRows) {
    lines.push(`${C.cyan}  ${row.label.padEnd(11)}${C.reset} ${row.description}`);
  }

  lines.push(
    `\n${C.brightCyan}${C.bold}quick starts${C.reset}`,
    `${C.cyan}  full tutor ${C.reset} npm run tutor:stub`,
    `${C.cyan}  guided tour${C.reset} npm run tutor:stub:demo`,
    `${C.cyan}  course     ${C.reset} npm run tutor:stub -- --curriculum curriculum/ai-foundations.curriculum.yaml --module AF1`,
    `${C.cyan}  curriculum ${C.reset} npm run tutor:stub:workplan -- --module <id>`,
    `${C.cyan}  board      ${C.reset} /board inside any normal tutor-stub session`,
    `${C.cyan}  proof DAG  ${C.reset} /proof inside any normal tutor-stub session`,
    `${C.cyan}  pure chat  ${C.reset} npm run tutor:stub:passthrough`,
    `${C.cyan}  QA preview ${C.reset} npm run tutor:stub:qa -- --suite core --runs 1 --dry-run`,
  );

  if (activeContext) {
    const mechanisms = Array.isArray(activeContext.mechanisms) ? activeContext.mechanisms.filter(Boolean) : [];
    lines.push(
      `\n${C.brightGreen}${C.bold}active now >${C.reset} ${activeContext.mode} · ${activeContext.content}${mechanisms.length ? ` · ${mechanisms.join(' · ')}` : ''}`,
    );
  }

  lines.push(
    `${C.dim}  use --help for launch flags; inside a session, type / to filter commands or /help for groups${C.reset}\n`,
  );
  return Object.freeze(lines);
}
