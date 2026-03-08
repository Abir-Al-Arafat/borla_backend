import { Router } from 'express';
import { operationsControllers } from './operations.controller';
import validateRequest from 'app/middleware/validateRequest';
import { operationsValidations } from './operations.validation';
import auth from 'app/middleware/auth';

const router = Router();

// Get complete operations dashboard (all data in one call)
router.get(
  '/dashboard',
  auth('admin', 'supper_admin'),
  validateRequest(operationsValidations.dashboardQueryZodSchema),
  operationsControllers.getOperationsDashboard,
);

// Individual endpoints for specific data
router.get(
  '/pickups-per-hour',
  auth('admin', 'supper_admin'),
  validateRequest(operationsValidations.dashboardQueryZodSchema),
  operationsControllers.getPickupsPerHour,
);

router.get(
  '/avg-pickup-time',
  auth('admin', 'supper_admin'),
  validateRequest(operationsValidations.dashboardQueryZodSchema),
  operationsControllers.getAvgPickupTimeByDay,
);

router.get(
  '/completion-rate',
  auth('admin', 'supper_admin'),
  validateRequest(operationsValidations.dashboardQueryZodSchema),
  operationsControllers.getCompletionRate,
);

router.get(
  '/zone-health',
  auth('admin', 'supper_admin'),
  validateRequest(operationsValidations.dashboardQueryZodSchema),
  operationsControllers.getZoneHealth,
);

// Pickup success rate by day
router.get(
  '/pickup-success-rate',
  auth('admin', 'supper_admin'),
  validateRequest(operationsValidations.rankingQueryZodSchema),
  operationsControllers.getPickupSuccessRate,
);

// Zone performance ranking
router.get(
  '/zone-ranking',
  auth('admin', 'supper_admin'),
  validateRequest(operationsValidations.rankingQueryZodSchema),
  operationsControllers.getZoneRanking,
);

// Top performing riders
router.get(
  '/top-riders',
  auth('admin', 'supper_admin'),
  validateRequest(operationsValidations.rankingQueryZodSchema),
  operationsControllers.getTopRiders,
);

// Zone comparison (all zones revenue and pickups)
router.get(
  '/zone-comparison',
  auth('admin', 'supper_admin'),
  validateRequest(operationsValidations.dashboardQueryZodSchema),
  operationsControllers.getZoneComparison,
);

// Zone-specific endpoints
// Get zone details with KPIs
router.get(
  '/zones/:zoneId/details',
  auth('admin', 'supper_admin'),
  validateRequest(operationsValidations.zoneQueryZodSchema),
  operationsControllers.getZoneDetails,
);

// Get zone performance trends
router.get(
  '/zones/:zoneId/trends',
  auth('admin', 'supper_admin'),
  validateRequest(operationsValidations.zoneQueryZodSchema),
  operationsControllers.getZoneTrends,
);

export const operationsRoutes = router;
