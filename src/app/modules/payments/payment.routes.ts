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

// IMPORTANT: No 'auth' middleware on webhook
router.post('/webhook', paymentControllers.paystackWebhook);

export const paymentRoutes = router;
