/* eslint-disable @typescript-eslint/no-explicit-any */
import AppError from '../../error/AppError';
import httpStatus from 'http-status';
import HashPassword from '../../shared/hashPassword';
import pickQuery from '../../utils/pickQuery';
import { paginationHelper } from '../../helpers/pagination.helpers';
import { Role, User } from '../../../generated/prisma';
import prisma from '../../shared/prisma';
import { Prisma } from '@prisma/client';

const create = async (payload: User) => {
  try {
    const isExist = await prisma.user.findFirst({
      where: {
        email: payload.email,
      },
      include: {
        verification: {
          select: {
            status: true,
          },
        },
      },
    });

    payload['password'] = await HashPassword(payload?.password as string);

    if (isExist) {
      if (isExist.isDeleted) {
        throw new AppError(httpStatus.FORBIDDEN, 'This user was deleted');
      }

      if (isExist.status === 'blocked') {
        throw new AppError(httpStatus.FORBIDDEN, 'This user was blocked');
      }

      if (!isExist.verification?.status) {
        return await prisma.user.update({
          where: { id: isExist.id },
          data: payload,
        });
      }

      throw new AppError(
        httpStatus.CONFLICT,
        'User already exists and is verified',
      );
    }
    const result = await prisma.user.create({ data: payload });

    return result;
  } catch (error: any) {
    throw new AppError(httpStatus?.BAD_GATEWAY, error?.message);
  }
};

const getAll = async (query: Record<string, any>) => {
  const { filters, pagination } = await pickQuery(query);

  const { searchTerm, ...filtersData } = filters;

  // eslint-disable-next-line prefer-const
  let pipeline: Prisma.UserWhereInput = {
    AND: {
      isDeleted: false,
    },
  };

  // search condition
  if (searchTerm) {
    pipeline.OR = ['name', 'email', 'phoneNumber', 'status'].map(field => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive',
      },
    }));
  }

  // Add filterQuery conditions
  if (Object.keys(filtersData).length) {
    const oldAnd = pipeline.AND;
    const oldAndArray = Array.isArray(oldAnd) ? oldAnd : oldAnd ? [oldAnd] : [];

    pipeline.AND = [
      {
        isDeleted: false,
      },
      ...oldAndArray,
      ...Object.entries(filtersData).map(([key, value]) => ({
        [key]: { equals: value },
      })),
    ];
  }

  // 🚫 exclude admin users
  pipeline.NOT = {
    role: 'admin' as Role, // Cast string to enum Role
  };

  // Sorting condition
  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);

  let sortArray: any[] = [];
  if (sort) {
    sortArray = sort.split(',').map(field => {
      const trimmedField = field.trim();
      if (trimmedField.startsWith('-')) {
        return { [trimmedField.slice(1)]: 'desc' };
      }
      return { [trimmedField]: 'asc' };
    });
  }

  const data = await prisma.user.findMany({
    where: pipeline,
    skip,
    take: limit,
    orderBy: sortArray,
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      role: true,
      profile: true,
      phoneNumber: true,
      expireAt: false,
      createdAt: true,
      updatedAt: false,
      verification: {
        select: {
          status: true,
        },
      },
      deviceHistory: true,
    },
  });

  const total = await prisma.user.count({
    where: pipeline,
  });

  return {
    users: data,
    meta: { page, limit, total },
  };
};

const getById = async (id: string) => {
  const result = await prisma.user.findUniqueOrThrow({
    where: {
      id,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      role: true,
      profile: true,
      phoneNumber: true,
      createdAt: true,
      verification: {
        select: {
          status: true,
        },
      },
      deviceHistory: true,
    },
  });

  return result;
};

const update = async (id: string, payload: Partial<User>) => {
  try {
    const result = await prisma.user.update({
      where: { id },
      data: payload,
      include: {
        verification: true,
        deviceHistory: true,
      },
    });
    return result;
  } catch (error: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'User update failed: ' + error.message,
    );
  }
};

const deleteUser = async (id: string) => {
  const result = await prisma.user.update({
    where: {
      id,
    },
    data: { isDeleted: true },
  });

  return result;
};

const toggleUserStatus = async (userId: string) => {
  // Get current user status
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onlineStatus: true, isDeleted: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'User is deleted');
  }

  // Toggle the status
  const newStatus = user.onlineStatus === 'online' ? 'offline' : 'online';

  const result = await prisma.user.update({
    where: { id: userId },
    data: { onlineStatus: newStatus },
    select: {
      id: true,
      name: true,
      email: true,
      onlineStatus: true,
    },
  });

  return result;
};

const updateMyLocation = async (
  userId: string,
  payload: { latitude: number; longitude: number; locationName?: string },
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isDeleted: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'User is deleted');
  }

  // Create GeoJSON Point format
  const location = {
    type: 'Point',
    coordinates: [payload.longitude, payload.latitude],
  };

  const result = await prisma.user.update({
    where: { id: userId },
    data: {
      location,
      locationName: payload.locationName || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      location: true,
      locationName: true,
    },
  });

  return result;
};

export const userService = {
  create,
  update,
  getAll,
  getById,
  deleteUser,
  toggleUserStatus,
  updateMyLocation,
};
