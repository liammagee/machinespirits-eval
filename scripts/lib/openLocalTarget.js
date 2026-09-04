import { execFileSync } from 'node:child_process';

function openLocalTarget(target, { execFile = execFileSync } = {}) {
  execFile('open', [String(target)], { stdio: 'ignore' });
}

export { openLocalTarget };
