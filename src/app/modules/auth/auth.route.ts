import { Router } from 'express';
import multer from 'multer';
import { authControllers } from './auth.controller';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../users/user.constants';
import validateRequest from '../../middleware/validateRequest';
import { authValidations } from './auth.validation';

const router = Router();
const upload = multer();

router.post(
  '/signup',
  upload.none(),
  validateRequest(authValidations.signupZodSchema),
  authControllers.signup,
);

router.post(
  '/login',
  upload.none(),
  validateRequest(authValidations.loginZodSchema),
  authControllers.login,
);

router.post(
  '/google',
  upload.none(),
  validateRequest(authValidations.socialAuthZodSchema),
  authControllers.registerWithGoogle,
);

router.post(
  '/apple',
  upload.none(),
  validateRequest(authValidations.socialAuthZodSchema),
  authControllers.registerWithApple,
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
  upload.none(),
  validateRequest(authValidations.forgotPasswordZodSchema),
  authControllers.forgotPassword,
);

router.patch(
  '/reset-password',
  upload.none(),
  validateRequest(authValidations.resetPasswordZodSchema),
  authControllers.resetPassword,
);

export const authRoutes = router;
