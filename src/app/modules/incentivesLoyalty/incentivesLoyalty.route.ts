import { Router } from 'express';
import auth from 'app/middleware/auth';
import validateRequest from 'app/middleware/validateRequest';
import { incentivesLoyaltyControllers } from './incentivesLoyalty.controller';
import { incentivesLoyaltyValidations } from './incentivesLoyalty.validation';

const router = Router();

router.get(
  '/rider-cards',
  auth('admin', 'supper_admin'),
  validateRequest(incentivesLoyaltyValidations.zoneRiderLoyaltyCardsZodSchema),
  incentivesLoyaltyControllers.getZoneRiderLoyaltyCards,
);

router.get(
  '/customer-loyalty',
  auth('admin', 'supper_admin'),
  validateRequest(incentivesLoyaltyValidations.customerLoyaltyZodSchema),
  incentivesLoyaltyControllers.getCustomerLoyalty,
);

export const incentivesLoyaltyRoutes = router;
