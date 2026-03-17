/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma, Role } from '@prisma/client';
import prisma from '@app/shared/prisma';

/**
 * Build search conditions for user queries across multiple fields
 * Supports text search (name, email, phone) and enum matching (status, onlineStatus, role)
 * @param searchTerm - The search term to match
 * @returns Array of search conditions for Prisma OR clause
 */
export const buildSearchConditions = (
  searchTerm: string,
): Prisma.UserWhereInput[] => {
  const normalizedSearchTerm = String(searchTerm).trim();
  const normalizedSearchTermLower = normalizedSearchTerm.toLowerCase();

  const searchConditions: Prisma.UserWhereInput[] = [
    { name: { contains: normalizedSearchTerm, mode: 'insensitive' } },
    { email: { contains: normalizedSearchTerm, mode: 'insensitive' } },
    { phoneNumber: { contains: normalizedSearchTerm, mode: 'insensitive' } },
  ];

  // Add status enum match if applicable
  if (['active', 'blocked'].includes(normalizedSearchTermLower)) {
    searchConditions.push({ status: normalizedSearchTermLower as any });
  }

  // Add online status enum match if applicable
  if (['online', 'offline'].includes(normalizedSearchTermLower)) {
    searchConditions.push({ onlineStatus: normalizedSearchTermLower as any });
  }

  // Add role enum match if applicable
  if (
    ['admin', 'sub_admin', 'supper_admin', 'user', 'rider'].includes(
      normalizedSearchTermLower,
    )
  ) {
    searchConditions.push({ role: normalizedSearchTermLower as Role });
  }

  return searchConditions;
};

/**
 * Build complete WHERE clause for user queries
 * Combines search, filters, and exclusions into a single Prisma WHERE input
 * @param filters - Filter object containing searchTerm, locationName, role, and custom filters
 * @returns Prisma UserWhereInput ready for findMany/findFirst queries
 */
export const buildUserWhereClause = (
  filters: Record<string, any>,
): Prisma.UserWhereInput => {
  const { searchTerm, locationName, role, ...filtersData } = filters;

  let pipeline: Prisma.UserWhereInput = { AND: { isDeleted: false } };

  // Apply search conditions
  if (searchTerm) {
    pipeline.OR = buildSearchConditions(searchTerm);
  }

  // Apply location name filter
  if (locationName) {
    const oldAnd = pipeline.AND;
    const oldAndArray = Array.isArray(oldAnd) ? oldAnd : oldAnd ? [oldAnd] : [];
    pipeline.AND = [
      ...oldAndArray,
      { locationName: { contains: locationName, mode: 'insensitive' } },
    ];
  }

  // Apply role filter
  if (role) {
    const oldAnd = pipeline.AND;
    const oldAndArray = Array.isArray(oldAnd) ? oldAnd : oldAnd ? [oldAnd] : [];
    pipeline.AND = [...oldAndArray, { role: role as Role }];
  }

  // Apply additional custom filters
  if (Object.keys(filtersData).length) {
    const oldAnd = pipeline.AND;
    const oldAndArray = Array.isArray(oldAnd) ? oldAnd : oldAnd ? [oldAnd] : [];
    pipeline.AND = [
      { isDeleted: false },
      ...oldAndArray,
      ...Object.entries(filtersData).map(([key, value]) => ({
        [key]: { equals: value },
      })),
    ];
  }

  // Exclude admins unless explicitly searching for a role
  if (!role) {
    pipeline.NOT = { role: 'admin' as Role };
  }

  return pipeline;
};

/**
 * Determine rider risk level based on average delay
 * @param averageDelay - Average delay in minutes
 * @returns Risk level: 'low' | 'medium' | 'high'
 */
const calculateRiskLevel = (
  averageDelay: number,
): 'low' | 'medium' | 'high' => {
  if (averageDelay < 10) return 'low';
  if (averageDelay <= 20) return 'medium';
  return 'high';
};

/**
 * Calculate rider performance statistics
 * @param riderId - ID of the rider
 * @returns Object with jobsCompleted, acceptanceRate, averageDelay, and riskLevel
 */
export const calculateRiderStats = async (riderId: string) => {
  // Count jobs with 'completed' status
  const jobsCompleted = await prisma.booking.count({
    where: { riderId, status: 'completed' },
  });

  // Count total bookings
  const totalBookings = await prisma.booking.count({
    where: { riderId },
  });

  // Count accepted bookings (where acceptedAt is set)
  const acceptedBookings = await prisma.booking.count({
    where: {
      riderId,
      acceptedAt: { not: null },
    },
  });

  // Calculate acceptance rate as percentage
  const acceptanceRate =
    totalBookings > 0
      ? parseFloat(((acceptedBookings / totalBookings) * 100).toFixed(2))
      : 0;

  // Fetch bookings with both acceptance and arrival times
  const delayData = await prisma.booking.findMany({
    where: {
      riderId,
      acceptedAt: { not: null },
      arrivedAtPickup: { not: null },
    },
    select: {
      acceptedAt: true,
      arrivedAtPickup: true,
    },
  });

  // Calculate average delay in minutes from acceptance to arrival
  let averageDelay = 0;
  if (delayData.length > 0) {
    const totalDelayMs = delayData.reduce((sum, booking) => {
      if (!booking.acceptedAt || !booking.arrivedAtPickup) return sum;
      const delayMs =
        booking.arrivedAtPickup.getTime() - booking.acceptedAt.getTime();
      return sum + delayMs;
    }, 0);
    averageDelay = parseFloat(
      (totalDelayMs / delayData.length / 1000 / 60).toFixed(2),
    );
  }

  // Calculate risk level based on average delay
  const riskLevel = calculateRiskLevel(averageDelay);

  return { jobsCompleted, acceptanceRate, averageDelay, riskLevel };
};

/**
 * Enrich user objects with rider statistics
 * Can be used to add stats to any array of users
 * @param users - Array of user objects to enrich
 * @returns Enriched users with riderStats property
 */
export const enrichRidersWithStats = async (users: any[]) => {
  return Promise.all(
    users.map(async user => ({
      ...user,
      riderStats: await calculateRiderStats(user.id),
    })),
  );
};

/**
 * Filter array of users by geographic radius using Haversine formula
 * Calculates distance between two points on Earth
 * @param users - Array of user objects with location data
 * @param latitude - Reference latitude (center point)
 * @param longitude - Reference longitude (center point)
 * @param radiusInKm - Radius in kilometers
 * @returns Filtered array of users within radius
 */
export const filterUsersByRadius = (
  users: any[],
  latitude: number,
  longitude: number,
  radiusInKm: number,
): any[] => {
  const userLat = parseFloat(String(latitude));
  const userLon = parseFloat(String(longitude));

  return users.filter(user => {
    // Validate location structure
    if (!user.location || typeof user.location !== 'object') return false;

    const location = user.location as any;
    if (
      !location.coordinates ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length < 2
    ) {
      return false;
    }

    const userLocLon = parseFloat(location.coordinates[0]);
    const userLocLat = parseFloat(location.coordinates[1]);

    // Haversine formula: calculate great-circle distance between two points
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((userLocLat - userLat) * Math.PI) / 180;
    const dLon = ((userLocLon - userLon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLat * Math.PI) / 180) *
        Math.cos((userLocLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance <= radiusInKm;
  });
};

/**
 * Convert sort string into Prisma orderBy format
 * Supports ascending (default) and descending (prefix with '-') sorts
 * Can chain multiple fields with comma separation: 'createdAt,-name'
 * @param sort - Sort string (e.g., 'createdAt' or '-name' or 'createdAt,-updatedAt')
 * @returns Array of sort objects for Prisma orderBy
 */
export const buildSortArray = (sort: string): Record<string, any>[] => {
  if (!sort) return [];
  return sort.split(',').map(field => {
    const trimmedField = field.trim();
    if (trimmedField.startsWith('-')) {
      return { [trimmedField.slice(1)]: 'desc' };
    }
    return { [trimmedField]: 'asc' };
  });
};
