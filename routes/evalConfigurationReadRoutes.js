export const EVAL_CONFIGURATION_READ_ROUTES = Object.freeze([
  '/scenarios',
  '/scenarios/:id',
  '/profiles',
  '/learner-profiles',
  '/configurations',
]);

/** Register the read-only scenario, profile, learner, and model catalogues. */
export function registerEvalConfigurationReadRoutes(
  router,
  { evalConfigLoader, learnerConfigLoader, getTutorConfigLoader },
) {
  const [scenariosPath, scenarioPath, profilesPath, learnerProfilesPath, configurationsPath] =
    EVAL_CONFIGURATION_READ_ROUTES;

  router.get(scenariosPath, (_req, res) => {
    try {
      const scenarios = evalConfigLoader.listScenarios();
      res.json({ success: true, scenarios });
    } catch (error) {
      console.error('[EvalRoutes] List scenarios error:', error);
      res.status(500).json({ error: 'Failed to list scenarios' });
    }
  });

  router.get(scenarioPath, (req, res) => {
    try {
      const scenario = evalConfigLoader.getScenario(req.params.id);
      if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
      res.json({ success: true, scenario });
    } catch (error) {
      console.error('[EvalRoutes] Get scenario error:', error);
      res.status(500).json({ error: 'Failed to get scenario' });
    }
  });

  router.get(profilesPath, (_req, res) => {
    try {
      const profiles = getTutorConfigLoader().listProfiles();
      res.json({ success: true, profiles });
    } catch (error) {
      console.error('[EvalRoutes] List profiles error:', error);
      res.status(500).json({ error: 'Failed to list profiles' });
    }
  });

  router.get(learnerProfilesPath, (_req, res) => {
    try {
      const profiles = learnerConfigLoader.listProfiles();
      const personas = learnerConfigLoader.listPersonas();
      res.json({ success: true, profiles, personas });
    } catch (error) {
      console.error('[EvalRoutes] List learner profiles error:', error);
      res.status(500).json({ error: 'Failed to list learner profiles' });
    }
  });

  router.get(configurationsPath, (_req, res) => {
    try {
      const configurations = evalConfigLoader.listConfigurations();
      res.json({ success: true, configurations });
    } catch (error) {
      console.error('[EvalRoutes] List configurations error:', error);
      res.status(500).json({ error: 'Failed to list configurations' });
    }
  });
}
