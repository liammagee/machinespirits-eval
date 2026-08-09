export const EVAL_MONITORING_READ_ROUTES = Object.freeze([
  '/monitor/summary',
  '/monitor/sessions',
  '/monitor/sessions/:id',
  '/monitor/alerts',
]);

export function registerEvalMonitoringReadRoutes(router, { getMonitoringService }) {
  const [summaryPath, sessionsPath, sessionPath, alertsPath] = EVAL_MONITORING_READ_ROUTES;

  router.get(summaryPath, (_req, res) => {
    try {
      const summary = getMonitoringService().getMonitoringSummary();
      res.json({ success: true, ...summary });
    } catch (error) {
      console.error('[EvalRoutes] Monitor summary error:', error);
      res.status(500).json({ error: 'Failed to get monitoring summary' });
    }
  });

  router.get(sessionsPath, (_req, res) => {
    try {
      const sessions = getMonitoringService().getActiveSessions();
      const aggregate = getMonitoringService().getAggregateMetrics();
      res.json({ success: true, sessions, aggregate });
    } catch (error) {
      console.error('[EvalRoutes] Monitor sessions error:', error);
      res.status(500).json({ error: 'Failed to get active sessions' });
    }
  });

  router.get(sessionPath, (req, res) => {
    try {
      const session = getMonitoringService().getSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      res.json({ success: true, session });
    } catch (error) {
      console.error('[EvalRoutes] Get session error:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  });

  router.get(alertsPath, (req, res) => {
    try {
      const { severity, acknowledged, limit } = req.query;
      const options = {};
      if (severity) options.severity = severity;
      if (acknowledged !== undefined) options.acknowledged = acknowledged === 'true';
      if (limit) options.limit = parseInt(limit, 10);
      const alerts = getMonitoringService().getAlerts(options);
      res.json({ success: true, alerts });
    } catch (error) {
      console.error('[EvalRoutes] Get alerts error:', error);
      res.status(500).json({ error: 'Failed to get alerts' });
    }
  });
}
