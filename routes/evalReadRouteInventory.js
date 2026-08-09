import { EVAL_ANALYSIS_READ_ROUTES } from './evalAnalysisReadRoutes.js';
import { EVAL_CONFIGURATION_READ_ROUTES } from './evalConfigurationReadRoutes.js';
import {
  EVAL_DOCUMENTATION_READ_ROUTES,
  EVAL_PROMPT_READ_ROUTES,
  EVAL_TRAJECTORY_READ_ROUTES,
} from './evalFileReadRoutes.js';
import { EVAL_INTERACTION_READ_ROUTES } from './evalInteractionReadRoutes.js';
import { EVAL_LOG_READ_ROUTES } from './evalLogReadRoutes.js';
import { EVAL_MONITORING_READ_ROUTES } from './evalMonitoringReadRoutes.js';
import { EVAL_RUN_READ_ROUTES } from './evalRunReadRoutes.js';

export const EVAL_READ_ROUTE_PATHS = Object.freeze([
  ...EVAL_CONFIGURATION_READ_ROUTES,
  ...EVAL_RUN_READ_ROUTES.slice(0, 2),
  ...EVAL_RUN_READ_ROUTES.slice(2, 4),
  ...EVAL_LOG_READ_ROUTES,
  ...EVAL_PROMPT_READ_ROUTES,
  ...EVAL_TRAJECTORY_READ_ROUTES,
  ...EVAL_ANALYSIS_READ_ROUTES,
  ...EVAL_DOCUMENTATION_READ_ROUTES,
  ...EVAL_MONITORING_READ_ROUTES,
  EVAL_RUN_READ_ROUTES[4],
  ...EVAL_INTERACTION_READ_ROUTES,
]);

export const EVAL_READ_ROUTE_KEYS = Object.freeze(EVAL_READ_ROUTE_PATHS.map((routePath) => `GET ${routePath}`));
