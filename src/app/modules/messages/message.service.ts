import prisma from 'app/shared/prisma';
import AppError from 'app/error/AppError';
import httpStatus from 'http-status';
import {
  IGetChatsQuery,
  IGetMessagesQuery,
  ISendMessagePayload,
} from './message.interface';

import { ALLOWED_BOOKING_STATUSES_FOR_CHAT } from './message.constants';

const getBookingAndValidateParticipant = async (
  bookingId: string,
  authUserId: string,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      riderId: true,
      status: true,
      user: {
        select: {
          id: true,
          name: true,
          profilePicture: true,
        },
      },
      rider: {
        select: {
          id: true,
          name: true,
          profilePicture: true,
        },
      },
    },
  });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (!booking.riderId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Chat is available only after a rider accepts this booking',
    );
  }

  if (!ALLOWED_BOOKING_STATUSES_FOR_CHAT.includes(booking.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Chat is not available for this booking status',
    );
  }

  if (authUserId !== booking.userId && authUserId !== booking.riderId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not allowed to access chat for this booking',
    );
  }

  return booking;
};

const findOrCreateChatForBookingParticipants = async (
  userId: string,
  riderId: string,
) => {
  let chat = await prisma.chat.findFirst({
    where: {
      status: 'active',
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: riderId } } },
      ],
    },
  });

  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        status: 'active',
        participants: {
          create: [{ userId }, { userId: riderId }],
        },
      },
    });
  }

  return chat;
};

const sendMessage = async (
  authUserId: string,
  payload: ISendMessagePayload,
) => {
  const booking = await getBookingAndValidateParticipant(
    payload.bookingId,
    authUserId,
  );

  const userId = booking.userId;
  const riderId = booking.riderId as string;
  const receiverId = authUserId === userId ? riderId : userId;
  const normalizedText = payload.text?.trim();
  const imagePaths = payload.imagePaths || [];

  if (!normalizedText && !imagePaths.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Please provide message text or at least one image',
    );
  }

  const chat = await findOrCreateChatForBookingParticipants(userId, riderId);

  const message = await prisma.messages.create({
    data: {
      chatId: chat.id,
      senderId: authUserId,
      receiverId,
      text: normalizedText || null,
      seen: false,
    },
  });

  if (imagePaths.length) {
    await Promise.all(
      imagePaths.map(image =>
        prisma.images.create({
          data: {
            image,
            referenceId: message.id,
          },
        }),
      ),
    );
  }

  const messageWithImages = await prisma.messages.findUnique({
    where: { id: message.id },
    include: {
      images: true,
    },
  });

  if (!messageWithImages) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create message');
  }

  return {
    id: messageWithImages.id,
    bookingId: booking.id,
    chatId: messageWithImages.chatId,
    senderId: messageWithImages.senderId,
    receiverId: messageWithImages.receiverId,
    text: messageWithImages.text,
    seen: messageWithImages.seen,
    images: messageWithImages.images,
    createdAt: messageWithImages.createdAt,
    updatedAt: messageWithImages.updatedAt,
  };
};

const getBookingMessages = async (
  authUserId: string,
  bookingId: string,
  query: IGetMessagesQuery,
) => {
  const booking = await getBookingAndValidateParticipant(bookingId, authUserId);

  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
  const skip = (page - 1) * limit;

  const chat = await prisma.chat.findFirst({
    where: {
      status: 'active',
      AND: [
        { participants: { some: { userId: booking.userId } } },
        { participants: { some: { userId: booking.riderId as string } } },
      ],
    },
  });

  if (!chat) {
    return {
      messages: [],
      meta: {
        page,
        limit,
        total: 0,
        totalPage: 0,
      },
      participants: {
        user: booking.user,
        rider: booking.rider,
      },
    };
  }

  const [messages, total] = await Promise.all([
    prisma.messages.findMany({
      where: {
        chatId: chat.id,
      },
      include: {
        images: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      skip,
      take: limit,
    }),
    prisma.messages.count({
      where: {
        chatId: chat.id,
      },
    }),
  ]);

  if (messages.length) {
    await prisma.messages.updateMany({
      where: {
        chatId: chat.id,
        receiverId: authUserId,
        seen: false,
      },
      data: {
        seen: true,
      },
    });
  }

  return {
    messages,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    participants: {
      user: booking.user,
      rider: booking.rider,
    },
  };
};

const getMyChats = async (authUserId: string, query: IGetChatsQuery) => {
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
  const skip = (page - 1) * limit;

  const chats = await prisma.chat.findMany({
    where: {
      participants: {
        some: {
          userId: authUserId,
        },
      },
      status: 'active',
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
              role: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    skip,
    take: limit,
  });

  const total = await prisma.chat.count({
    where: {
      participants: {
        some: {
          userId: authUserId,
        },
      },
      status: 'active',
    },
  });

  const chatIds = chats.map(chat => chat.id);
  const lastMessages = chatIds.length
    ? await prisma.messages.findMany({
        where: {
          chatId: {
            in: chatIds,
          },
        },
        include: {
          images: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    : [];

  const lastMessageMap = new Map<string, (typeof lastMessages)[number]>();
  for (const message of lastMessages) {
    if (!lastMessageMap.has(message.chatId)) {
      lastMessageMap.set(message.chatId, message);
    }
  }

  const data = chats.map(chat => {
    const otherParticipant = chat.participants.find(
      participant => participant.userId !== authUserId,
    );

    return {
      id: chat.id,
      status: chat.status,
      otherParticipant: otherParticipant?.user || null,
      lastMessage: lastMessageMap.get(chat.id) || null,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  });

  return {
    chats: data,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

export const messageServices = {
  sendMessage,
  getBookingMessages,
  getMyChats,
};
