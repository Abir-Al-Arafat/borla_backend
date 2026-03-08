import prisma from 'app/shared/prisma';
import { bookingStatus } from '@prisma/client';
import {
  IDashboardQuery,
  IPickupsPerHour,
  IAvgPickupTimeByDay,
  ICompletionRate,
  IZoneHealth,
} from './operations.interface';

// Get pickups per hour
const getPickupsPerHour = async (query: IDashboardQuery) => {
  const { period = 'daily', startDate, endDate, zoneId } = query;

  // Calculate date range
  const now = new Date();
  let start: Date;
  let end: Date = endDate ? new Date(endDate) : now;

  if (startDate) {
    start = new Date(startDate);
  } else {
    switch (period) {
      case 'daily':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      default:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
    }
  }

  const whereConditions: any = {
    requestedAt: {
      gte: start,
      lte: end,
    },
    status: {
      in: ['completed', 'in_progress', 'arrived_pickup', 'arrived_dropoff'],
    },
  };

  if (zoneId) {
    whereConditions.rider = {
      zoneId: zoneId,
    };
  }

  const bookings = await prisma.booking.findMany({
    where: whereConditions,
    select: {
      requestedAt: true,
    },
  });

  // Group by hour
  const hourlyData: { [key: string]: number } = {};
  const hours = [
    '6AM',
    '7AM',
    '8AM',
    '9AM',
    '10AM',
    '11AM',
    '12PM',
    '1PM',
    '2PM',
    '3PM',
    '4PM',
    '5PM',
    '6PM',
    '7PM',
    '8PM',
  ];

  // Initialize all hours with 0
  hours.forEach(hour => {
    hourlyData[hour] = 0;
  });

  bookings.forEach(booking => {
    const hour = booking.requestedAt.getHours();
    let hourLabel = '';

    if (hour >= 6 && hour < 12) {
      hourLabel = `${hour}AM`;
    } else if (hour === 12) {
      hourLabel = '12PM';
    } else if (hour > 12 && hour <= 20) {
      hourLabel = `${hour - 12}PM`;
    }

    if (hourLabel && hourlyData.hasOwnProperty(hourLabel)) {
      hourlyData[hourLabel]++;
    }
  });

  const data: IPickupsPerHour[] = hours.map(hour => ({
    hour,
    pickups: hourlyData[hour] || 0,
  }));

  return data;
};

// Get average pickup time by day of week
const getAvgPickupTimeByDay = async (query: IDashboardQuery) => {
  const { period = 'weekly', startDate, endDate, zoneId } = query;

  const now = new Date();
  let start: Date;
  let end: Date = endDate ? new Date(endDate) : now;

  if (startDate) {
    start = new Date(startDate);
  } else {
    switch (period) {
      case 'weekly':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 7);
    }
  }

  const whereConditions: any = {
    requestedAt: {
      gte: start,
      lte: end,
    },
    acceptedAt: { not: null },
    arrivedAtPickup: { not: null },
  };

  if (zoneId) {
    whereConditions.rider = {
      zoneId: zoneId,
    };
  }

  const bookings = await prisma.booking.findMany({
    where: whereConditions,
    select: {
      requestedAt: true,
      acceptedAt: true,
      arrivedAtPickup: true,
    },
  });

  // Group by day of week
  const dayData: { [key: string]: { total: number; count: number } } = {
    Mon: { total: 0, count: 0 },
    Tue: { total: 0, count: 0 },
    Wed: { total: 0, count: 0 },
    Thu: { total: 0, count: 0 },
    Fri: { total: 0, count: 0 },
    Sat: { total: 0, count: 0 },
    Sun: { total: 0, count: 0 },
  };

  bookings.forEach(booking => {
    if (booking.acceptedAt && booking.arrivedAtPickup) {
      const dayOfWeek = booking.requestedAt.getDay();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayLabel = days[dayOfWeek];

      // Calculate time difference in minutes
      const timeDiff =
        (booking.arrivedAtPickup.getTime() - booking.acceptedAt.getTime()) /
        1000 /
        60;

      dayData[dayLabel].total += timeDiff;
      dayData[dayLabel].count++;
    }
  });

  const data: IAvgPickupTimeByDay[] = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ].map(day => ({
    day,
    mins: Math.round(
      dayData[day].count > 0 ? dayData[day].total / dayData[day].count : 0,
    ),
  }));

  return data;
};

// Get overall completion rate
const getCompletionRate = async (query: IDashboardQuery) => {
  const { period = 'weekly', startDate, endDate, zoneId } = query;

  const now = new Date();
  let start: Date;
  let end: Date = endDate ? new Date(endDate) : now;

  if (startDate) {
    start = new Date(startDate);
  } else {
    switch (period) {
      case 'daily':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 7);
    }
  }

  const whereConditions: any = {
    requestedAt: {
      gte: start,
      lte: end,
    },
    status: {
      not: 'cancelled',
    },
  };

  if (zoneId) {
    whereConditions.rider = {
      zoneId: zoneId,
    };
  }

  const [totalBookings, completedBookings] = await Promise.all([
    prisma.booking.count({
      where: whereConditions,
    }),
    prisma.booking.count({
      where: {
        ...whereConditions,
        status: bookingStatus.completed,
      },
    }),
  ]);

  const completionRate =
    totalBookings > 0
      ? Math.round((completedBookings / totalBookings) * 100)
      : 0;

  const data: ICompletionRate = {
    completionRate,
    totalBookings,
    completedBookings,
  };

  return data;
};

// Get zone health data
const getZoneHealth = async (query: IDashboardQuery) => {
  const { period = 'weekly', startDate, endDate } = query;

  const now = new Date();
  let start: Date;
  let end: Date = endDate ? new Date(endDate) : now;

  if (startDate) {
    start = new Date(startDate);
  } else {
    switch (period) {
      case 'daily':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 7);
    }
  }

  // Get all zones with their stats
  const zones = await prisma.zone.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      riders: {
        where: {
          role: 'rider',
          riderVerified: true,
          isDeleted: false,
        },
        select: {
          id: true,
          onlineStatus: true,
        },
      },
    },
  });

  const zoneHealthData: IZoneHealth[] = await Promise.all(
    zones.map(async zone => {
      const whereConditions = {
        requestedAt: {
          gte: start,
          lte: end,
        },
        rider: {
          zoneId: zone.id,
        },
        status: {
          not: bookingStatus.cancelled,
        },
      };

      const [totalRequests, completedRequests, bookingsWithWaitTime] =
        await Promise.all([
          prisma.booking.count({
            where: whereConditions,
          }),
          prisma.booking.count({
            where: {
              ...whereConditions,
              status: bookingStatus.completed,
            },
          }),
          prisma.booking.findMany({
            where: {
              ...whereConditions,
              acceptedAt: { not: null },
              arrivedAtPickup: { not: null },
            },
            select: {
              acceptedAt: true,
              arrivedAtPickup: true,
            },
          }),
        ]);

      // Calculate average wait time
      let avgWaitTimeMinutes = 0;
      if (bookingsWithWaitTime.length > 0) {
        const totalWaitTime = bookingsWithWaitTime.reduce((sum, booking) => {
          if (booking.acceptedAt && booking.arrivedAtPickup) {
            return (
              sum +
              (booking.arrivedAtPickup.getTime() - booking.acceptedAt.getTime())
            );
          }
          return sum;
        }, 0);
        avgWaitTimeMinutes = Math.round(
          totalWaitTime / bookingsWithWaitTime.length / 1000 / 60,
        );
      }

      const completionRate =
        totalRequests > 0
          ? Math.round((completedRequests / totalRequests) * 100)
          : 0;

      // Determine status based on completion rate and wait time
      let status: 'Healthy' | 'Watch' | 'Action Needed' = 'Healthy';
      if (completionRate < 80 || avgWaitTimeMinutes > 12) {
        status = 'Action Needed';
      } else if (completionRate < 90 || avgWaitTimeMinutes > 8) {
        status = 'Watch';
      }

      // Count available (online) riders
      const availableRiders = zone.riders.filter(
        r => r.onlineStatus === 'online',
      ).length;

      return {
        zone: zone.name,
        zoneId: zone.id,
        requests: totalRequests,
        completed: completedRequests,
        riders: availableRiders,
        avgWaitTime: `${avgWaitTimeMinutes} min`,
        completionRate,
        status,
      };
    }),
  );

  return zoneHealthData;
};

// Get complete operations dashboard
const getOperationsDashboard = async (query: IDashboardQuery) => {
  const [
    pickupsPerHour,
    avgPickupTimeByDay,
    overallCompletionRate,
    zoneHealth,
  ] = await Promise.all([
    getPickupsPerHour(query),
    getAvgPickupTimeByDay(query),
    getCompletionRate(query),
    getZoneHealth(query),
  ]);

  return {
    pickupsPerHour,
    avgPickupTimeByDay,
    overallCompletionRate,
    zoneHealth,
  };
};

export const operationsServices = {
  getPickupsPerHour,
  getAvgPickupTimeByDay,
  getCompletionRate,
  getZoneHealth,
  getOperationsDashboard,
};
