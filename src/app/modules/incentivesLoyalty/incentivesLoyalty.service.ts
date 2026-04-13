import { bookingStatus } from '@prisma/client';
import prisma from 'app/shared/prisma';
import {
  IRiderLoyaltyCard,
  IZoneRiderLoyaltyCardsQuery,
} from './incentivesLoyalty.interface';

const DAILY_TARGET_RIDES = 25;

const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
};

const getZoneRiderLoyaltyCards = async (query: IZoneRiderLoyaltyCardsQuery) => {
  const { zoneId, zoneName, limit: limitParam } = query;

  const limit =
    typeof limitParam === 'string'
      ? parseInt(limitParam, 10)
      : typeof limitParam === 'number'
        ? limitParam
        : undefined;

  let resolvedZoneId = zoneId;

  if (!resolvedZoneId && zoneName) {
    const zone = await prisma.zone.findFirst({
      where: {
        isDeleted: false,
        name: {
          contains: zoneName,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (!zone) {
      return [];
    }

    resolvedZoneId = zone.id;
  }

  const riders = await prisma.user.findMany({
    where: {
      ...(resolvedZoneId
        ? { zoneId: resolvedZoneId }
        : { zoneId: { not: null } }),
      role: 'rider',
      riderVerified: true,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!riders.length) {
    return [];
  }

  const riderIds = riders.map(rider => rider.id);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const nextDayStart = new Date(dayStart);
  nextDayStart.setDate(nextDayStart.getDate() + 1);

  const [totalCompletedRides, todayCompletedRides, ratings] = await Promise.all(
    [
      prisma.booking.groupBy({
        by: ['riderId'],
        where: {
          riderId: {
            in: riderIds,
          },
          status: bookingStatus.completed,
        },
        _count: {
          id: true,
        },
      }),
      prisma.booking.groupBy({
        by: ['riderId'],
        where: {
          riderId: {
            in: riderIds,
          },
          status: bookingStatus.completed,
          completedAt: {
            gte: dayStart,
            lt: nextDayStart,
          },
        },
        _count: {
          id: true,
        },
      }),
      prisma.rating.findMany({
        where: {
          booking: {
            riderId: {
              in: riderIds,
            },
            status: bookingStatus.completed,
          },
        },
        select: {
          rating: true,
          booking: {
            select: {
              riderId: true,
            },
          },
        },
      }),
    ],
  );

  const totalRideMap = new Map(
    totalCompletedRides.map(item => [item.riderId!, item._count.id]),
  );

  const todayRideMap = new Map(
    todayCompletedRides.map(item => [item.riderId!, item._count.id]),
  );

  const ratingSummaryMap = new Map<string, { sum: number; count: number }>();

  ratings.forEach(item => {
    const riderId = item.booking.riderId;
    if (!riderId) {
      return;
    }

    const current = ratingSummaryMap.get(riderId) || { sum: 0, count: 0 };

    ratingSummaryMap.set(riderId, {
      sum: current.sum + item.rating,
      count: current.count + 1,
    });
  });

  const riderCards: IRiderLoyaltyCard[] = riders.map(rider => {
    const rideCount = totalRideMap.get(rider.id) || 0;
    const todayRides = todayRideMap.get(rider.id) || 0;
    const extraRidesCompleted = todayRides - DAILY_TARGET_RIDES;

    const ratingSummary = ratingSummaryMap.get(rider.id);
    const rating = ratingSummary
      ? Number((ratingSummary.sum / ratingSummary.count).toFixed(1))
      : 0;

    return {
      name: rider.name,
      initials: getInitials(rider.name),
      rideCount,
      rating,
      todayRides,
      totalRides: DAILY_TARGET_RIDES,
      extraRidesCompleted,
      status:
        todayRides >= DAILY_TARGET_RIDES ? 'bonus-eligible' : 'in-progress',
    };
  });

  const sortedCards = riderCards.sort(
    (a, b) =>
      b.todayRides - a.todayRides ||
      b.extraRidesCompleted - a.extraRidesCompleted ||
      b.rideCount - a.rideCount ||
      b.rating - a.rating,
  );

  return typeof limit === 'number' && limit > 0
    ? sortedCards.slice(0, limit)
    : sortedCards;
};

export const incentivesLoyaltyServices = {
  getZoneRiderLoyaltyCards,
};
