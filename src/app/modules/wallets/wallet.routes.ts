import { Router } from 'express';
import multer from 'multer';
import { walletControllers } from './wallet.controller';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../users/user.constants';

const router = Router();
const upload = multer();

// Route for adding funds to the app wallet
router.post(
  '/top-up',
  upload.none(),
  auth(USER_ROLE.user, USER_ROLE.rider),
  walletControllers.initiateTopUp,
);

// Route for getting wallet balance
router.get(
  '/self',
  auth(USER_ROLE.user, USER_ROLE.rider),
  walletControllers.getWallet,
);

// Route for Riders to withdraw earnings to MoMo
router.post(
  '/withdraw',
  upload.none(),
  auth(USER_ROLE.rider),
  walletControllers.initiateWithdrawal,
);

export const walletRoutes = router;
