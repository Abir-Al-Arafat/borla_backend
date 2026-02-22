import prisma from 'app/shared/prisma';
import AppError from 'app/error/AppError';
import httpStatus from 'http-status';

interface IFindRidersQuery {
  latitude?: number;
  longitude?: number;
  radius?: number; // in km
}

// Find available riders within radius
const findAvailableRiders = async (userId: string, query: IFindRidersQuery) => {
  // Get user's location if lat/lng not provided
  let { latitude, longitude, radius = 10 } = query;

  if (!latitude || !longitude) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { location: true, isDeleted: true },
    });

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (user.isDeleted) {
      throw new AppError(httpStatus.FORBIDDEN, 'User account is deleted');
    }

    if (user.location && typeof user.location === 'object') {
      const location = user.location as any;
      if (
        location.coordinates &&
        Array.isArray(location.coordinates) &&
        location.coordinates.length >= 2
      ) {
        longitude = parseFloat(location.coordinates[0]);
        latitude = parseFloat(location.coordinates[1]);
      }
    }
  }

  if (!latitude || !longitude) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Location is required. Please update your location first.',
    );
  }

  // Get all verified, online riders
  const riders = await prisma.user.findMany({
    where: {
      role: 'rider',
      riderVerified: true,
      isDeleted: false,
      onlineStatus: 'online',
      location: {
        not: null,
      },
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

  // Filter riders within the specified radius using Haversine formula
  const ridersWithinRadius = riders
    .filter(rider => {
      if (!rider.location || typeof rider.location !== 'object') return false;

      const location = rider.location as any;
      if (
        !location.coordinates ||
        !Array.isArray(location.coordinates) ||
        location.coordinates.length < 2
      ) {
        return false;
      }

      const riderLon = parseFloat(location.coordinates[0]);
      const riderLat = parseFloat(location.coordinates[1]);

      // Haversine formula to calculate distance
      const R = 6371; // Earth's radius in kilometers
      const dLat = ((riderLat - latitude!) * Math.PI) / 180;
      const dLon = ((riderLon - longitude!) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((latitude! * Math.PI) / 180) *
          Math.cos((riderLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      return distance <= radius;
    })
    .map(rider => {
      // Calculate exact distance for each rider
      const location = rider.location as any;
      const riderLon = parseFloat(location.coordinates[0]);
      const riderLat = parseFloat(location.coordinates[1]);

      const R = 6371;
      const dLat = ((riderLat - latitude!) * Math.PI) / 180;
      const dLon = ((riderLon - longitude!) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((latitude! * Math.PI) / 180) *
          Math.cos((riderLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      // Calculate estimated time based on distance
      // Assuming average speed of 15 km/h for tri-cycle
      const avgSpeed = 15; // km/h
      const timeInHours = distance / avgSpeed;
      const timeInMinutes = Math.round(timeInHours * 60);

      // Format estimated time
      let estimatedTime: string;
      if (timeInMinutes < 60) {
        estimatedTime = `${timeInMinutes} min`;
      } else {
        const hours = Math.floor(timeInMinutes / 60);
        const minutes = timeInMinutes % 60;
        estimatedTime = minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
      }

      return {
        ...rider,
        distance: parseFloat(distance.toFixed(2)), // Distance in km
        estimatedTime,
      };
    })
    .sort((a, b) => a.distance - b.distance); // Sort by distance (nearest first)

  return {
    riders: ridersWithinRadius,
    meta: {
      page: 1,
      limit: ridersWithinRadius.length,
      total: ridersWithinRadius.length,
      totalPage: 1,
      radius,
      searchLocation: {
        latitude,
        longitude,
      },
    },
  };
};

export const riderServices = {
  findAvailableRiders,
};
