import { Router } from 'express';
import { authControllers } from './auth.controller';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../users/user.constants';

const router = Router();

router.post('/login', authControllers.login);

router.post('/refresh-token', authControllers.refreshToken);

router.patch(
  '/change-password',
  auth(
    USER_ROLE.super_admin,
    USER_ROLE.sub_admin,
    USER_ROLE.admin,
    USER_ROLE.user,
  ),
  authControllers.changePassword,
);

router.patch('/forgot-password', authControllers.forgotPassword);
router.patch('/reset-password', authControllers.resetPassword);

export const authRoutes = router;
