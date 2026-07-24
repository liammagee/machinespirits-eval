export function auditForbiddenKeys(value, forbiddenKeys, path = []) {
  const leaks = [];
  if (!value || typeof value !== 'object') return leaks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      leaks.push(...auditForbiddenKeys(item, forbiddenKeys, [...path, String(index)]));
    });
    return leaks;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (forbiddenKeys.has(key)) leaks.push({ path: nextPath.join('.'), key });
    leaks.push(...auditForbiddenKeys(child, forbiddenKeys, nextPath));
  }
  return leaks;
}
