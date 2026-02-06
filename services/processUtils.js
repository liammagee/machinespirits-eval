/**
 * Process utility functions shared across eval services and CLI.
 */

/**
 * Check if a process with the given PID is still running.
 * @param {number} pid - Process ID to check
 * @returns {boolean|null} true if alive, false if dead, null if pid is falsy
 */
export function isPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return null;
  try {
    process.kill(pid, 0); // Signal 0 = check existence without killing
    return true;
  } catch (e) {
    return e.code === 'EPERM'; // EPERM means process exists but we can't signal it
  }
}
