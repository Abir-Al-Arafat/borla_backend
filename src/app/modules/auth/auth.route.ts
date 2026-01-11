import { Router } from 'express';
import { authControllers } from './auth.controller';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../users/user.constants';
import validateRequest from '../../middleware/validateRequest';
import { authValidations } from './auth.validation';

const router = Router();

router.post(
  '/signup',
  validateRequest(authValidations.signupZodSchema),
  authControllers.signup,
);

router.post(
  '/login',
  validateRequest(authValidations.loginZodSchema),
  authControllers.login,
);

router.post('/refresh-token', authControllers.refreshToken);

router.patch(
  '/change-password',
  auth(
    USER_ROLE.super_admin,
    USER_ROLE.sub_admin,
    USER_ROLE.admin,
    USER_ROLE.user,
  ),
  validateRequest(authValidations.changePasswordZodSchema),
  authControllers.changePassword,
);

router.patch(
  '/forgot-password',
  validateRequest(authValidations.forgotPasswordZodSchema),
  authControllers.forgotPassword,
);

router.patch(
  '/reset-password',
  validateRequest(authValidations.resetPasswordZodSchema),
  authControllers.resetPassword,
);

export const authRoutes = router;
