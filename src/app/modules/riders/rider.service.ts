import prisma from 'app/shared/prisma';
import { IFindRidersQuery } from './rider.interface';
import { getUserLocation } from './rider.helpers';
import {
  extractCoordinates,
  calculateDistance,
  formatEstimatedTime,
  calculateEstimatedPrice,
} from './rider.utils';
import { PRICING_CONFIG } from './rider.constants';

// Find available riders within radius
const findAvailableRiders = async (userId: string, query: IFindRidersQuery) => {
  const { radius = 10 } = query;
  let { latitude, longitude } = query;

  // Get user's location if not provided in query
  if (!latitude || !longitude) {
    const userLocation = await getUserLocation(userId);
    latitude = userLocation.latitude;
    longitude = userLocation.longitude;
  }

  // Fetch all verified, online riders
  const riders = await prisma.user.findMany({
    where: {
      role: 'rider',
      riderVerified: true,
      isDeleted: false,
      onlineStatus: 'online',
      location: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      profilePicture: true,
      location: true,
      locationName: true,
      onlineStatus: true,
    },
  });

  // Process riders: calculate distance, filter by radius, and enrich with metadata
  const ridersWithinRadius = riders
    .map(rider => {
      const riderCoords = extractCoordinates(rider.location);
      if (!riderCoords) return null;

      const distance = calculateDistance(
        latitude!,
        longitude!,
        riderCoords.latitude,
        riderCoords.longitude,
      );

      // Filter out riders outside the radius
      if (distance > radius) return null;

      // Calculate time and price estimates
      const timeInMinutes = Math.round(
        (distance / PRICING_CONFIG.avgSpeed) * 60,
      );
      const estimatedTime = formatEstimatedTime(timeInMinutes);
      const estimatedPrice = calculateEstimatedPrice(distance, timeInMinutes);

      return {
        ...rider,
        distance: parseFloat(distance.toFixed(2)),
        estimatedTime,
        estimatedPrice,
      };
    })
    .filter((rider): rider is NonNullable<typeof rider> => rider !== null)
    .sort((a, b) => a.distance - b.distance);

  return {
    riders: ridersWithinRadius,
    meta: {
      page: 1,
      limit: ridersWithinRadius.length,
      total: ridersWithinRadius.length,
      totalPage: 1,
      radius,
      searchLocation: { latitude, longitude },
    },
  };
};

export const riderServices = {
  findAvailableRiders,
};
