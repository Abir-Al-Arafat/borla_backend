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
router.post('/booking-callback', paymentControllers.handleBookingCallback);

router.post(
  '/refund/initiate',
  upload.none(),
  paymentControllers.initiateRefund,
);

router.post('/refund-callback', paymentControllers.handleRefundCallback);

router.post(
  '/initiate/cash',
  upload.none(),
  auth(USER_ROLE.user),
  paymentControllers.initiateBookingPaymentCash,
);

/**
 * Manual Status Verification (User-Triggered)
 * Path: /api/v1/payments/verify/:clientReference
 */
router.get(
  '/verify/:clientReference',
  auth(USER_ROLE.user, USER_ROLE.rider),
  paymentControllers.verifyPaymentStatus,
);

export const paymentRoutes = router;
