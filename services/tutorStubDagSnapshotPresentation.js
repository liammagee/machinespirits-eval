function presentationColors(colors = {}) {
  return {
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubDagSnapshotLines({ snapshot, colors = {} } = {}) {
  if (!snapshot) return Object.freeze([]);

  const C = presentationColors(colors);
  const lines = [
    `${C.cyan}tutor DAG >${C.reset} turn ${snapshot.turn}: ${snapshot.leavesReleased}/${snapshot.leavesTotal} proof leaves released`,
  ];

  if (!snapshot.derivable) {
    lines.push(`${C.dim}  not derivable from this world's authored proof data${C.reset}\n`);
    return Object.freeze(lines);
  }

  lines.push(
    `${C.dim}  root: ${snapshot.rootLabel}${C.reset}`,
    snapshot.nextRelease
      ? `${C.dim}  next release: ${snapshot.nextRelease.premise} at turn ${snapshot.nextRelease.turn} via ${snapshot.nextRelease.via}${C.reset}`
      : `${C.dim}  next release: none${C.reset}`,
    `${C.dim}  edges:${C.reset}`,
  );
  for (const edge of snapshot.edges) {
    lines.push(`${C.dim}    ${edge.fromLabel} -> ${edge.toLabel}${edge.rule ? ` (${edge.rule})` : ''}${C.reset}`);
  }

  lines.push(`${C.dim}  leaves:${C.reset}`);
  for (const leaf of snapshot.leaves) {
    const status = leaf.released ? 'x' : ' ';
    const schedule = leaf.scheduledTurn ? `t${leaf.scheduledTurn}/${leaf.via}` : 'unscheduled';
    lines.push(`${C.dim}    [${status}] ${leaf.premise} ${schedule}: ${leaf.fact}${C.reset}`);
  }
  lines.push('');
  return Object.freeze(lines);
}
