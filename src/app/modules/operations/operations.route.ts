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

export const operationsRoutes = router;
