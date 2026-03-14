import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../users/user.constants';
import validateRequest from '../../middleware/validateRequest';
import { messageControllers } from './message.controller';
import { messageValidations } from './message.validation';
import fileUpload from '../../middleware/fileUpload';
import path from 'path';

const router = Router();
const imageUpload = fileUpload(
  path.join(process.cwd(), 'public', 'uploads', 'chat-images'),
);

router.get(
  '/my-chats',
  auth(USER_ROLE.user, USER_ROLE.rider),
  validateRequest(messageValidations.getChatsZodSchema),
  messageControllers.getMyChats,
);

router.get(
  '/booking/:bookingId',
  auth(USER_ROLE.user, USER_ROLE.rider),
  validateRequest(messageValidations.getMessagesZodSchema),
  messageControllers.getBookingMessages,
);

router.post(
  '/booking/:bookingId',
  auth(USER_ROLE.user, USER_ROLE.rider),
  imageUpload.array('images', 5),
  validateRequest(messageValidations.sendMessageZodSchema),
  messageControllers.sendMessage,
);

export const messageRoutes = router;
