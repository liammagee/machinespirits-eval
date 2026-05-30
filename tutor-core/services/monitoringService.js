/**
 * Real-Time Monitoring Service
 *
 * Tracks active tutor sessions, metrics, and provides alerting.
 * Part of Phase 8: Real-Time Monitoring Dashboard
 */

import { MODEL_PRICING } from './pricingConfig.js';

// In-memory session store (would be Redis/DB in production)
const activeSessions = new Map();
const sessionMetrics = new Map();
const alerts = [];

// Alert thresholds
const ALERT_THRESHOLDS = {
  highLatencyMs: 30000,      // 30s per message
  tokenBudgetWarn: 10000,    // 10k tokens warning
  tokenBudgetCrit: 50000,    // 50k tokens critical
  errorRatePercent: 10,      // 10% error rate
  errorRateWindowMs: 300000, // 5 minute window
  maxRoundsWithoutApproval: 5
};

// Error tracking for rate calculation
const errorLog = [];

/**
 * Start tracking a new tutor session
 */
export function startSession(sessionId, options = {}) {
  const {
    userId = 'anonymous',
    profileName = 'default',
    modelId = 'unknown'
  } = options;

  const session = {
    sessionId,
    userId,
    profileName,
    modelId,
    status: 'active',
    startTime: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    metrics: {
      rounds: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalLatencyMs: 0,
      messageCount: 0,
      estimatedCost: 0,
      errors: 0
    },
    dialogueTrace: []
  };

  activeSessions.set(sessionId, session);
  return session;
}

/**
 * End a tutor session
 */
export function endSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.status = 'completed';
    session.endTime = new Date().toISOString();

    // Move to metrics history
    sessionMetrics.set(sessionId, { ...session });
    activeSessions.delete(sessionId);

    return session;
  }
  return null;
}

/**
 * Record a dialogue event (message sent/received)
 */
export function recordEvent(sessionId, event) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    // Auto-create session if not exists
    startSession(sessionId, { profileName: event.profileName, modelId: event.modelId });
    return recordEvent(sessionId, event);
  }

  const {
    type,           // 'ego_generate', 'superego_review', 'ego_revise', etc.
    inputTokens = 0,
    outputTokens = 0,
    latencyMs = 0,
    round = 0,
    approved = null,
    error = null
  } = event;

  // Update metrics
  session.metrics.inputTokens += inputTokens;
  session.metrics.outputTokens += outputTokens;
  session.metrics.totalLatencyMs += latencyMs;
  session.metrics.messageCount++;
  session.metrics.rounds = Math.max(session.metrics.rounds, round);
  session.lastActivity = new Date().toISOString();

  // Calculate cost
  const pricing = MODEL_PRICING[session.modelId] || { input: 0, output: 0 };
  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  session.metrics.estimatedCost += inputCost + outputCost;

  // Track dialogue trace
  session.dialogueTrace.push({
    timestamp: new Date().toISOString(),
    type,
    inputTokens,
    outputTokens,
    latencyMs,
    round,
    approved
  });

  // Handle errors
  if (error) {
    session.metrics.errors++;
    errorLog.push({ sessionId, timestamp: Date.now(), error });
    checkErrorRate();
  }

  // Check for alerts
  checkAlerts(session, event);

  return session;
}

/**
 * Check for alertable conditions
 */
function checkAlerts(session, event) {
  const { latencyMs, round, approved } = event;

  // High latency alert
  if (latencyMs > ALERT_THRESHOLDS.highLatencyMs) {
    addAlert({
      type: 'high_latency',
      severity: 'warning',
      sessionId: session.sessionId,
      message: `High latency: ${(latencyMs / 1000).toFixed(1)}s for single message`,
      value: latencyMs,
      threshold: ALERT_THRESHOLDS.highLatencyMs
    });
  }

  // Token budget alerts
  const totalTokens = session.metrics.inputTokens + session.metrics.outputTokens;
  if (totalTokens > ALERT_THRESHOLDS.tokenBudgetCrit) {
    addAlert({
      type: 'token_budget',
      severity: 'critical',
      sessionId: session.sessionId,
      message: `Token budget critical: ${totalTokens.toLocaleString()} tokens used`,
      value: totalTokens,
      threshold: ALERT_THRESHOLDS.tokenBudgetCrit
    });
  } else if (totalTokens > ALERT_THRESHOLDS.tokenBudgetWarn) {
    addAlert({
      type: 'token_budget',
      severity: 'warning',
      sessionId: session.sessionId,
      message: `Token budget warning: ${totalTokens.toLocaleString()} tokens used`,
      value: totalTokens,
      threshold: ALERT_THRESHOLDS.tokenBudgetWarn
    });
  }

  // Failed dialogue (max rounds without approval)
  if (round >= ALERT_THRESHOLDS.maxRoundsWithoutApproval && approved === false) {
    addAlert({
      type: 'failed_dialogue',
      severity: 'warning',
      sessionId: session.sessionId,
      message: `Dialogue failed to converge after ${round} rounds`,
      value: round,
      threshold: ALERT_THRESHOLDS.maxRoundsWithoutApproval
    });
  }
}

/**
 * Check error rate across all sessions
 */
function checkErrorRate() {
  const windowStart = Date.now() - ALERT_THRESHOLDS.errorRateWindowMs;
  const recentErrors = errorLog.filter(e => e.timestamp > windowStart);

  // Get total requests in window (rough estimate)
  let totalRequests = 0;
  for (const session of activeSessions.values()) {
    totalRequests += session.metrics.messageCount;
  }

  if (totalRequests > 0) {
    const errorRate = (recentErrors.length / totalRequests) * 100;
    if (errorRate > ALERT_THRESHOLDS.errorRatePercent) {
      addAlert({
        type: 'error_rate',
        severity: 'critical',
        sessionId: null,
        message: `High error rate: ${errorRate.toFixed(1)}% in last 5 minutes`,
        value: errorRate,
        threshold: ALERT_THRESHOLDS.errorRatePercent
      });
    }
  }

  // Prune old errors
  while (errorLog.length > 0 && errorLog[0].timestamp < windowStart) {
    errorLog.shift();
  }
}

/**
 * Add an alert
 */
function addAlert(alert) {
  const existingIndex = alerts.findIndex(a =>
    a.type === alert.type &&
    a.sessionId === alert.sessionId &&
    a.severity === alert.severity
  );

  const fullAlert = {
    ...alert,
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    acknowledged: false
  };

  if (existingIndex >= 0) {
    // Update existing alert
    alerts[existingIndex] = fullAlert;
  } else {
    alerts.push(fullAlert);
  }

  // Keep only last 100 alerts
  while (alerts.length > 100) {
    alerts.shift();
  }

  return fullAlert;
}

/**
 * Get all active sessions
 */
export function getActiveSessions() {
  return Array.from(activeSessions.values());
}

/**
 * Get a specific session
 */
export function getSession(sessionId) {
  return activeSessions.get(sessionId) || sessionMetrics.get(sessionId);
}

/**
 * Get aggregate metrics across all active sessions
 */
export function getAggregateMetrics() {
  const sessions = getActiveSessions();

  if (sessions.length === 0) {
    return {
      activeSessions: 0,
      totalRounds: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      avgLatencyMs: 0,
      totalErrors: 0
    };
  }

  const totals = sessions.reduce((acc, s) => ({
    totalRounds: acc.totalRounds + s.metrics.rounds,
    totalInputTokens: acc.totalInputTokens + s.metrics.inputTokens,
    totalOutputTokens: acc.totalOutputTokens + s.metrics.outputTokens,
    totalCost: acc.totalCost + s.metrics.estimatedCost,
    totalLatencyMs: acc.totalLatencyMs + s.metrics.totalLatencyMs,
    totalMessages: acc.totalMessages + s.metrics.messageCount,
    totalErrors: acc.totalErrors + s.metrics.errors
  }), {
    totalRounds: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    totalLatencyMs: 0,
    totalMessages: 0,
    totalErrors: 0
  });

  return {
    activeSessions: sessions.length,
    ...totals,
    avgLatencyMs: totals.totalMessages > 0
      ? Math.round(totals.totalLatencyMs / totals.totalMessages)
      : 0
  };
}

/**
 * Get all alerts
 */
export function getAlerts(options = {}) {
  const { severity, acknowledged, limit = 50 } = options;

  let filtered = [...alerts];

  if (severity) {
    filtered = filtered.filter(a => a.severity === severity);
  }

  if (acknowledged !== undefined) {
    filtered = filtered.filter(a => a.acknowledged === acknowledged);
  }

  // Most recent first
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return filtered.slice(0, limit);
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(alertId) {
  const alert = alerts.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date().toISOString();
    return alert;
  }
  return null;
}

/**
 * Clear all alerts (for testing)
 */
export function clearAlerts() {
  alerts.length = 0;
}

/**
 * Clear all sessions (for testing)
 */
export function clearSessions() {
  activeSessions.clear();
  sessionMetrics.clear();
}

/**
 * Get monitoring summary for dashboard
 */
export function getMonitoringSummary() {
  const aggregate = getAggregateMetrics();
  const unacknowledgedAlerts = getAlerts({ acknowledged: false });
  const criticalAlerts = unacknowledgedAlerts.filter(a => a.severity === 'critical');
  const warningAlerts = unacknowledgedAlerts.filter(a => a.severity === 'warning');

  return {
    status: criticalAlerts.length > 0 ? 'critical'
          : warningAlerts.length > 0 ? 'warning'
          : 'healthy',
    metrics: aggregate,
    alertCounts: {
      critical: criticalAlerts.length,
      warning: warningAlerts.length,
      total: unacknowledgedAlerts.length
    },
    recentAlerts: unacknowledgedAlerts.slice(0, 5)
  };
}

export default {
  startSession,
  endSession,
  recordEvent,
  getActiveSessions,
  getSession,
  getAggregateMetrics,
  getAlerts,
  acknowledgeAlert,
  clearAlerts,
  clearSessions,
  getMonitoringSummary,
  ALERT_THRESHOLDS
};
