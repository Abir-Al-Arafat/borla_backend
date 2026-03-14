import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { messageServices } from './message.service';
import { IGetChatsQuery, IGetMessagesQuery } from './message.interface';

const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const imagePaths = Array.isArray(req.files)
    ? req.files.map((file: any) => file.path)
    : [];

  const result = await messageServices.sendMessage(req.user.userId, {
    bookingId: req.params.bookingId as string,
    text: req.body.text,
    imagePaths,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Message sent successfully',
    data: result,
  });
});

const getBookingMessages = catchAsync(async (req: Request, res: Response) => {
  const result = await messageServices.getBookingMessages(
    req.user.userId,
    req.params.bookingId as string,
    req.query as unknown as IGetMessagesQuery,
  );

  console.log('Messages retrieved:', result);
  if (!result.messages || !result.messages.length) {
    console.log('No messages found for this booking.');
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'No messages found for this booking.',
      data: result.messages,
    });
    return;
  }
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Messages retrieved successfully',
    data: result.messages,
    meta: result.meta,
  });
});

const getMyChats = catchAsync(async (req: Request, res: Response) => {
  const result = await messageServices.getMyChats(
    req.user.userId,
    req.query as unknown as IGetChatsQuery,
  );
  console.log('Chats retrieved:', result);
  if (!result.chats || !result.chats.length) {
    console.log('No chats found.');
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'No chats found for this user.',
      data: result.chats,
    });
    return;
  }
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Chats retrieved successfully',
    data: result.chats,
    meta: result.meta,
  });
});

export const messageControllers = {
  sendMessage,
  getBookingMessages,
  getMyChats,
};
