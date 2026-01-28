/**
 * Haptic Feedback Utilities
 *
 * Provides consistent vibration patterns for mobile interactions.
 * Falls back gracefully when vibration API is not available.
 */

type VibrationPattern = number | number[];

const vibrate = (pattern: VibrationPattern): void => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const haptics = {
  /** Light tap - tab changes, selections */
  light: () => vibrate(5),

  /** Medium tap - pull-to-refresh trigger, confirmations */
  medium: () => vibrate(10),

  /** Heavy tap - errors, warnings */
  heavy: () => vibrate(20),

  /** Success pattern - test passed, action completed */
  success: () => vibrate([10, 50, 10]),

  /** Error pattern - test failed, error occurred */
  error: () => vibrate([20, 100, 20, 100, 20]),

  /** Back online notification */
  online: () => vibrate([100, 50, 100]),

  /** Went offline notification */
  offline: () => vibrate(200),

  /** Copy to clipboard */
  copy: () => vibrate(30),

  /** Button press feedback */
  button: () => vibrate(8)
};

export default haptics;
