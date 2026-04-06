import { Router } from 'express';
import multer from 'multer';
import { paymentControllers } from './payment.controller';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../users/user.constants';

const router = Router();
const upload = multer();

router.post(
  '/initiate',
  upload.none(),
  auth(USER_ROLE.user),
  paymentControllers.initiatePayment,
);

/**
 * HUBTEL CALLBACKS (Public)
 * Hubtel hits these from their servers. 
 * Do NOT add auth() middleware here.
 */
router.post(
  '/booking-callback', 
  paymentControllers.handleBookingCallback
);

export const paymentRoutes = router;
