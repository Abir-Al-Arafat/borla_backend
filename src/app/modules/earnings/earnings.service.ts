import AppError from 'app/error/AppError';
import prisma from 'app/shared/prisma';
import httpStatus from 'http-status';
import {
  IEarningDetails,
  IEarningRow,
  IEarningsListQuery,
} from './earnings.interface';

const formatDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const amPm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }

  return `${day}-${month}-${year} ${hours}:${minutes} ${amPm}`;
};

const formatBookingStatus = (status?: string | null) => {
  if (!status) {
    return '';
  }

  return status
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getEarnings = async (query: IEarningsListQuery) => {
  const { search, page: pageParam = 1, limit: limitParam = 12 } = query;

  const page =
    typeof pageParam === 'string' ? parseInt(pageParam, 10) : pageParam;
  const limit =
    typeof limitParam === 'string' ? parseInt(limitParam, 10) : limitParam;
  const skip = (page - 1) * limit;

  const where: any = {
    bookingId: {
      not: null,
    },
  };

  if (search) {
    where.OR = [
      {
        booking: {
          user: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      },
      {
        booking: {
          user: {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      },
      {
        booking: {
          rider: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      },
      {
        booking: {
          rider: {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      },
    ];
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        booking: {
          select: {
            status: true,
            paymentMethod: true,
            pickupLocation: true,
            pickupAddress: true,
            dropoffLocation: true,
            dropoffAddress: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            rider: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  const data: IEarningRow[] = transactions.map((transaction, index) => ({
    key: transaction.id,
    serial: skip + index + 1,
    passengerName: transaction.booking?.user?.name || 'N/A',
    riderName: transaction.booking?.rider?.name || 'N/A',
    passengerEmail: transaction.booking?.user?.email || 'N/A',
    riderEmail: transaction.booking?.rider?.email || 'N/A',
    date: formatDate(transaction.createdAt),
    amount: String(transaction.amount ?? ''),
    commission:
      transaction.comissionPercentage !== null &&
      transaction.comissionPercentage !== undefined
        ? `${transaction.comissionPercentage}%`
        : '',
    riderEarning:
      transaction.riderEarnings !== null &&
      transaction.riderEarnings !== undefined
        ? String(transaction.riderEarnings)
        : '',
    status: formatBookingStatus(transaction.booking?.status),
  }));

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPage: Math.ceil(total / limit),
    },
  };
};

const getEarningDetailsById = async (id: string) => {
  const transaction = await prisma.transaction.findUnique({
    where: {
      id,
    },
    include: {
      booking: {
        select: {
          status: true,
          paymentMethod: true,
          pickupLocation: true,
          pickupAddress: true,
          //   dropoffLocation: true,
          //   dropoffAddress: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          rider: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!transaction) {
    throw new AppError(httpStatus.NOT_FOUND, 'Earning transaction not found');
  }

  const details: IEarningDetails = {
    id: transaction.id,
    passengerName: transaction.booking?.user?.name || 'N/A',
    riderName: transaction.booking?.rider?.name || 'N/A',
    passengerEmail: transaction.booking?.user?.email || 'N/A',
    riderEmail: transaction.booking?.rider?.email || 'N/A',
    date: formatDate(transaction.createdAt),
    amount: String(transaction.amount ?? ''),
    commission:
      transaction.comissionPercentage !== null &&
      transaction.comissionPercentage !== undefined
        ? `${transaction.comissionPercentage}%`
        : '',
    riderEarning:
      transaction.riderEarnings !== null &&
      transaction.riderEarnings !== undefined
        ? String(transaction.riderEarnings)
        : '',
    status: formatBookingStatus(transaction.booking?.status),
    paymentMethod: transaction.booking?.paymentMethod || '',
    pickupLocation: transaction.booking?.pickupLocation ?? null,
    pickupAddress: transaction.booking?.pickupAddress || '',
    // dropoffLocation: transaction.booking?.dropoffLocation ?? null,
    // dropoffAddress: transaction.booking?.dropoffAddress || null,
    reference: transaction.reference,
    clientReference: transaction.clientReference,
    paymentStatus: transaction.status,
  };

  return details;
};

export const earningsServices = {
  getEarnings,
  getEarningDetailsById,
};
