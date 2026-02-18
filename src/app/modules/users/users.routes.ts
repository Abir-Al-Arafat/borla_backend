import { Router } from 'express';

import auth from '../../middleware/auth';
import parseData from '../../middleware/parseData';
import { USER_ROLE } from './user.constants';
import multer, { memoryStorage } from 'multer';
import { userController } from './user.controller';
import validateRequest from '../../middleware/validateRequest';
import { userValidation } from './user.validation';

const router = Router();
const storage = memoryStorage();
const upload = multer({ storage });

// All specific paths MUST come before dynamic /:id routes

router.post(
  '/',
  upload.single('profile'),
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
  ),
  upload.single('profile'),
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

// Dynamic parameter routes come LAST
router.get('/:id', userController.getUserById);

router.patch(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.sub_admin, USER_ROLE.super_admin),
  upload.single('profile'),
  parseData(),
  userController.updateUser,
);

router.delete(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.sub_admin, USER_ROLE.super_admin),
  userController.deleteUser,
);

export const userRoutes = router;
