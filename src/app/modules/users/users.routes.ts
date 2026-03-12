import { Router } from 'express';

import auth from '../../middleware/auth';
import parseData from '../../middleware/parseData';
import { USER_ROLE } from './user.constants';
import { userController } from './user.controller';
import validateRequest from '../../middleware/validateRequest';
import { userValidation } from './user.validation';
import fileUpload from '../../middleware/fileUpload';
import path from 'path';

const router = Router();

const upload = fileUpload(
  path.join(process.cwd(), 'public', 'uploads', 'profile-pictures'),
);

// All specific paths MUST come before dynamic /:id routes

router.post(
  '/',
  upload.single('profilePicture'),
  parseData(),
  userController.createUser,
);

router.get('/', auth(USER_ROLE.admin), userController.getAllUser);

router.get(
  '/my-profile',
  auth(
    USER_ROLE.admin,
    USER_ROLE.sub_admin,
    USER_ROLE.super_admin,
    USER_ROLE.user,
    USER_ROLE.rider,
  ),
  userController.getMyProfile,
);

router.patch(
  '/update-my-profile',
  auth(
    USER_ROLE.admin,
    USER_ROLE.sub_admin,
    USER_ROLE.super_admin,
    USER_ROLE.user,
    USER_ROLE.rider,
  ),
  upload.single('profilePicture'),
  parseData(),
  userController.updateMyProfile,
);

router.delete(
  '/delete-my-account',
  auth(
    USER_ROLE.admin,
    USER_ROLE.sub_admin,
    USER_ROLE.super_admin,
    USER_ROLE.user,
  ),
  userController.deleteMYAccount,
);

router.patch(
  '/toggle-my-status',
  auth(
    USER_ROLE.admin,
    USER_ROLE.sub_admin,
    USER_ROLE.super_admin,
    USER_ROLE.user,
    USER_ROLE.rider,
  ),
  userController.toggleMyStatus,
);

router.patch(
  '/update-my-location',
  upload.none(),
  auth(
    USER_ROLE.admin,
    USER_ROLE.sub_admin,
    USER_ROLE.super_admin,
    USER_ROLE.user,
    USER_ROLE.rider,
  ),
  parseData(),
  validateRequest(userValidation.updateLocationZodSchema),
  userController.updateMyLocation,
);

// Admin: Toggle user account status (active/blocked)
router.patch(
  '/:id/toggle-status',
  auth(USER_ROLE.admin, USER_ROLE.sub_admin, USER_ROLE.super_admin),
  userController.toggleAccountStatus,
);

// Dynamic parameter routes come LAST
router.get('/:id', userController.getUserById);

router.patch(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.sub_admin, USER_ROLE.super_admin),
  upload.single('profilePicture'),
  parseData(),
  userController.updateUser,
);

router.delete(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.sub_admin, USER_ROLE.super_admin),
  userController.deleteUser,
);

export const userRoutes = router;
