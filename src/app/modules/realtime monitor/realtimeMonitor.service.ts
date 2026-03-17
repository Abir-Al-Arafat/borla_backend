import prisma from 'app/shared/prisma';
import {
  IRealtimeMonitorStats,
  IRealtimeRiderListResponse,
  IRealtimeRiderItem,
  IRealtimeActivityResponse,
  IRealtimeActivityItem,
} from './realtimeMonitor.interface';

import { bookingStatus } from '@prisma/client';

const ONGOING_STATUSES: bookingStatus[] = [
  bookingStatus.accepted,
  bookingStatus.arrived_pickup,
  bookingStatus.payment_collected,
  bookingStatus.heading_to_station,
  bookingStatus.in_progress,
  bookingStatus.arrived_dropoff,
  bookingStatus.awaiting_payment,
];

const getRelativeTimeLabel = (date: Date) => {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
};

const toActivityStatus = (
  status: bookingStatus,
): IRealtimeActivityItem['status'] => {
  if (status === bookingStatus.pending) return 'Pending';
  if (status === bookingStatus.accepted) return 'Assigned';
  if (status === bookingStatus.arrived_pickup) return 'Pickup';
  return 'In Progress';
};

const toActivityProgress = (status: bookingStatus) => {
  const progressMap: Partial<Record<bookingStatus, number>> = {
    [bookingStatus.pending]: 10,
    [bookingStatus.accepted]: 25,
    [bookingStatus.arrived_pickup]: 40,
    [bookingStatus.payment_collected]: 55,
    [bookingStatus.heading_to_station]: 70,
    [bookingStatus.in_progress]: 80,
    [bookingStatus.arrived_dropoff]: 90,
    [bookingStatus.awaiting_payment]: 95,
  };

  return progressMap[status];
};

const mapRiderRealtimeStatus = (
  onlineStatus: 'online' | 'offline',
  isBusy: boolean,
): Pick<IRealtimeRiderItem, 'status' | 'mapStatus'> => {
  if (onlineStatus === 'offline') {
    return { status: 'Offline', mapStatus: 'pending' };
  }

  if (isBusy) {
    return { status: 'Busy', mapStatus: 'active' };
  }

  return { status: 'Available', mapStatus: 'available' };
};

const getRealtimeMonitorStats = async (): Promise<IRealtimeMonitorStats> => {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const [
    ongoingRides,
    completedToday,
    acceptedTodayAvg,
    onlineRiders,
    busyRiders,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        status: {
          in: ONGOING_STATUSES,
        },
      },
    }),
    prisma.booking.count({
      where: {
        status: bookingStatus.completed,
        completedAt: {
          gte: startOfToday,
        },
      },
    }),
    prisma.booking.findMany({
      where: {
        acceptedAt: { not: null, gte: startOfToday },
      },
      select: {
        requestedAt: true,
        acceptedAt: true,
      },
    }),
    prisma.user.count({
      where: {
        role: 'rider',
        riderVerified: true,
        onlineStatus: 'online',
        isDeleted: false,
      },
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ONGOING_STATUSES },
        riderId: { not: null },
      },
      select: {
        riderId: true,
      },
    }),
  ]);

  const busyRiderIdSet = new Set(
    busyRiders.map(item => item.riderId).filter(Boolean) as string[],
  );

  const avgWaitTimeMinutes = acceptedTodayAvg.length
    ? Number(
        (
          acceptedTodayAvg.reduce((sum, booking) => {
            if (!booking.acceptedAt) return sum;
            const minutes =
              (booking.acceptedAt.getTime() - booking.requestedAt.getTime()) /
              (1000 * 60);
            return sum + Math.max(0, minutes);
          }, 0) / acceptedTodayAvg.length
        ).toFixed(1),
      )
    : 0;

  const availableRiders = Math.max(onlineRiders - busyRiderIdSet.size, 0);

  return {
    ongoingRides,
    availableRiders,
    completedToday,
    avgWaitTimeMinutes,
  };
};

const getRealtimeRiders = async (query: {
  page?: string;
  limit?: string;
}): Promise<IRealtimeRiderListResponse> => {
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
  const skip = (page - 1) * limit;

  const [riders, busyRiders, total] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: 'rider',
        riderVerified: true,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        profilePicture: true,
        onlineStatus: true,
        location: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ONGOING_STATUSES },
        riderId: { not: null },
      },
      select: {
        riderId: true,
      },
    }),
    prisma.user.count({
      where: {
        role: 'rider',
        riderVerified: true,
        isDeleted: false,
      },
    }),
  ]);

  const busyRiderIdSet = new Set(
    busyRiders.map(item => item.riderId).filter(Boolean) as string[],
  );

  const data: IRealtimeRiderItem[] = riders.map(rider => {
    const isBusy = busyRiderIdSet.has(rider.id);
    const mappedStatus = mapRiderRealtimeStatus(rider.onlineStatus, isBusy);

    const coordinates =
      rider.location &&
      typeof rider.location === 'object' &&
      Array.isArray((rider.location as any).coordinates)
        ? (rider.location as any).coordinates
        : [];

    const longitude = coordinates.length >= 2 ? Number(coordinates[0]) : null;
    const latitude = coordinates.length >= 2 ? Number(coordinates[1]) : null;

    return {
      id: rider.id,
      name: rider.name,
      avatar: rider.profilePicture || null,
      status: mappedStatus.status,
      mapStatus: mappedStatus.mapStatus,
      latitude,
      longitude,
    };
  });

  return {
    riders: data,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

const getRealtimeLiveLocations = async () => {
  const result = await getRealtimeRiders({ page: '1', limit: '1000' });
  return result.riders.filter(
    rider => rider.latitude !== null && rider.longitude !== null,
  );
};

const getRealtimeActivities = async (query: {
  page?: string;
  limit?: string;
}): Promise<IRealtimeActivityResponse> => {
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
  const skip = (page - 1) * limit;

  const whereClause = {
    status: {
      in: [
        bookingStatus.pending,
        bookingStatus.accepted,
        bookingStatus.arrived_pickup,
        bookingStatus.payment_collected,
        bookingStatus.heading_to_station,
        bookingStatus.in_progress,
        bookingStatus.arrived_dropoff,
        bookingStatus.awaiting_payment,
      ],
    },
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: whereClause,
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        wasteCategory: true,
        wasteSize: true,
        updatedAt: true,
        user: {
          select: {
            name: true,
          },
        },
        rider: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.booking.count({
      where: whereClause,
    }),
  ]);

  const activities: IRealtimeActivityItem[] = bookings.map(booking => ({
    id: booking.id,
    status: toActivityStatus(booking.status),
    assignee: booking.user.name,
    time: getRelativeTimeLabel(booking.updatedAt),
    rider:
      booking.rider?.name ||
      (booking.status === bookingStatus.pending ? 'Unassigned' : 'Assigned'),
    location: booking.pickupAddress,
    type:
      booking.wasteCategory.charAt(0).toUpperCase() +
      booking.wasteCategory.slice(1),
    weight: `${booking.wasteSize} kg`,
    progress: toActivityProgress(booking.status),
  }));

  return {
    activities,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

export const realtimeMonitorService = {
  getRealtimeMonitorStats,
  getRealtimeRiders,
  getRealtimeLiveLocations,
  getRealtimeActivities,
};
