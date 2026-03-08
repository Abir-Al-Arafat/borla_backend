import { Router } from 'express';
import { dashboardControllers } from './dashboard.controller';
import validateRequest from 'app/middleware/validateRequest';
import { dashboardValidations } from './dashboard.validation';
import auth from 'app/middleware/auth';

const router = Router();

// Get dashboard statistics (all 8 cards)
router.get(
  '/stats',
  auth('admin', 'supper_admin'),
  dashboardControllers.getDashboardStats,
);

// Get user overview chart data
router.get(
  '/user-overview',
  auth('admin', 'supper_admin'),
  validateRequest(dashboardValidations.userOverviewQueryZodSchema),
  dashboardControllers.getUserOverview,
);

// Get revenue chart data
router.get(
  '/revenue-chart',
  auth('admin', 'supper_admin'),
  validateRequest(dashboardValidations.revenueChartQueryZodSchema),
  dashboardControllers.getRevenueChart,
);

// Get waste distribution data
router.get(
  '/waste-distribution',
  auth('admin', 'supper_admin'),
  validateRequest(dashboardValidations.wasteDistributionQueryZodSchema),
  dashboardControllers.getWasteDistribution,
);

// Get recent accounts list
router.get(
  '/recent-accounts',
  auth('admin', 'supper_admin'),
  validateRequest(dashboardValidations.recentAccountsQueryZodSchema),
  dashboardControllers.getRecentAccounts,
);

export const dashboardRoutes = router;
