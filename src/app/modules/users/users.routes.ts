import { Router } from 'express';
import auth from '../../middleware/auth';
import parseData from '../../middleware/parseData';
import { USER_ROLE } from './user.constants';
import multer, { memoryStorage } from 'multer';
import { userController } from './user.controller';

const router = Router();
const storage = memoryStorage();
const upload = multer({ storage });

router.post(
  '/',
  upload.single('profile'),
  parseData(),
  userController.createUser,
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

router.patch(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.sub_admin, USER_ROLE.super_admin),
  upload.single('profile'),
  parseData(),
  userController.updateUser,
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

router.delete(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.sub_admin, USER_ROLE.super_admin),
  userController.deleteUser,
);

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

router.get('/:id', userController.getUserById);

router.get('/', auth(USER_ROLE.admin), userController.getAllUser);

export const userRoutes = router;
