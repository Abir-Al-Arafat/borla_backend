import prisma from 'app/shared/prisma';
import AppError from 'app/error/AppError';
import httpStatus from 'http-status';
import HashPassword from 'app/shared/hashPassword';
import {
  ICreateSpecialAccessUserPayload,
  IGetSpecialAccessUsersQuery,
  SPECIAL_ACCESS_TYPES,
} from './specialAccess.interface';

const createSpecialAccessUser = async (
  payload: ICreateSpecialAccessUserPayload,
) => {
  const normalizedEmail = payload.email.trim().toLowerCase();

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: normalizedEmail },
        ...(payload.phoneNumber ? [{ phoneNumber: payload.phoneNumber }] : []),
      ],
    },
    include: {
      verification: true,
    },
  });

  if (existingUser && !existingUser.isDeleted) {
    throw new AppError(httpStatus.CONFLICT, 'User already exists');
  }

  const hashedPassword = await HashPassword(payload.password);

  const userData = {
    name: payload.name,
    email: normalizedEmail,
    password: hashedPassword,
    phoneNumber: payload.phoneNumber || null,
    role: 'sub_admin' as const,
    customerId: payload.accountType,
    riderVerified: true,
    isDeleted: false,
    status: 'active' as const,
  };

  const result = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          ...userData,
          verification: {
            upsert: {
              update: {
                status: true,
                otp: 0,
                expiredAt: null,
              },
              create: {
                status: true,
                otp: 0,
                expiredAt: null,
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          customerId: true,
          status: true,
          createdAt: true,
        },
      })
    : await prisma.user.create({
        data: {
          ...userData,
          verification: {
            create: {
              status: true,
              otp: 0,
              expiredAt: null,
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          customerId: true,
          status: true,
          createdAt: true,
        },
      });

  return {
    ...result,
    accountType: result.customerId,
  };
};

const getSpecialAccessUsers = async (query: IGetSpecialAccessUsersQuery) => {
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
  const skip = (page - 1) * limit;

  const whereClause: any = {
    isDeleted: false,
    role: 'sub_admin',
    customerId: {
      in: [...SPECIAL_ACCESS_TYPES],
    },
  };

  if (query.accountType) {
    whereClause.customerId = query.accountType;
  }

  if (query.searchTerm) {
    whereClause.OR = [
      { name: { contains: query.searchTerm, mode: 'insensitive' } },
      { email: { contains: query.searchTerm, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        customerId: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  return {
    users: users.map(user => ({
      ...user,
      accountType: user.customerId,
    })),
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

const deleteSpecialAccessUser = async (id: string) => {
  const user = await prisma.user.findFirst({
    where: {
      id,
      isDeleted: false,
      role: 'sub_admin',
      customerId: {
        in: [...SPECIAL_ACCESS_TYPES],
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Special access user not found');
  }

  return prisma.user.update({
    where: { id },
    data: {
      isDeleted: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      customerId: true,
      isDeleted: true,
    },
  });
};

export const specialAccessService = {
  createSpecialAccessUser,
  getSpecialAccessUsers,
  deleteSpecialAccessUser,
};
