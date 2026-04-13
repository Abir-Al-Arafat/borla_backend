import { Router } from 'express';
import auth from 'app/middleware/auth';
import validateRequest from 'app/middleware/validateRequest';
import { earningsControllers } from './earnings.controller';
import { earningsValidations } from './earnings.validation';

const router = Router();

router.get(
  '/',
  auth('admin', 'supper_admin'),
  validateRequest(earningsValidations.earningsListZodSchema),
  earningsControllers.getEarnings,
);

router.get(
  '/:id',
  auth('admin', 'supper_admin'),
  validateRequest(earningsValidations.earningDetailsZodSchema),
  earningsControllers.getEarningDetailsById,
);

export const earningsRoutes = router;
