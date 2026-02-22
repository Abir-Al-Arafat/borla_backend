import { Router } from 'express';
import { riderControllers } from './rider.controller';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../users/user.constants';
import validateRequest from '../../middleware/validateRequest';
import { riderValidations } from './rider.validation';

const router = Router();

// Find available riders within radius
router.get(
  '/available',
  auth(USER_ROLE.user),
  validateRequest(riderValidations.findAvailableRidersQueryZodSchema),
  riderControllers.findAvailableRiders,
);

export const riderRoutes = router;
