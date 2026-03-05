import prisma from 'app/shared/prisma';
import AppError from 'app/error/AppError';
import httpStatus from 'http-status';
import {
  ICreateBooking,
  IGetBookingsQuery,
  IUpdateBookingStatus,
} from './booking.interface';

// Create a new booking (User)
const createBooking = async (userId: string, payload: ICreateBooking) => {
  // Verify user exists and is not a rider
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isDeleted: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'User account is deleted');
  }

  if (user.role === 'rider') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Riders cannot create booking requests',
    );
  }

  // Create GeoJSON Point for pickup location
  const pickupLocation = {
    type: 'Point',
    coordinates: [payload.pickupLongitude, payload.pickupLatitude],
  };

  // Create GeoJSON Point for dropoff location if provided
  let dropoffLocation = null;
  if (payload.dropoffLatitude && payload.dropoffLongitude) {
    dropoffLocation = {
      type: 'Point',
      coordinates: [payload.dropoffLongitude, payload.dropoffLatitude],
    };
  }

  const booking = await prisma.booking.create({
    data: {
      userId,
      wasteCategory: payload.wasteCategory,
      wasteImages: payload.wasteImages,
      binSize: payload.binSize,
      binQuantity: payload.binQuantity,
      wasteSize: payload.wasteSize,
      pickupLocation,
      pickupAddress: payload.pickupAddress,
      dropoffLocation,
      dropoffAddress: payload.dropoffAddress,
      vehicleType: payload.vehicleType,
      estimatedDistance: payload.estimatedDistance,
      estimatedTime: payload.estimatedTime,
      paymentMethod: payload.paymentMethod,
      price: payload.price,
      status: 'pending',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
    },
  });

  return booking;
};

// Get available bookings for riders (within radius)
const getAvailableBookingsForRider = async (
  riderId: string,
  query: IGetBookingsQuery,
) => {
  // Verify rider exists and is verified
  const rider = await prisma.user.findUnique({
    where: { id: riderId },
    select: {
      role: true,
      riderVerified: true,
      location: true,
      isDeleted: true,
    },
  });

  if (!rider) {
    throw new AppError(httpStatus.NOT_FOUND, 'Rider not found');
  }

  if (rider.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'Rider account is deleted');
  }

  if (rider.role !== 'rider') {
    throw new AppError(httpStatus.FORBIDDEN, 'Only riders can access this');
  }

  if (!rider.riderVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Your rider account is not verified yet',
    );
  }

  const { status = 'pending', page = 1, limit = 10, radius = 10 } = query;
  let { latitude, longitude } = query;

  // Use rider's location if not provided
  if (!latitude || !longitude) {
    if (rider.location && typeof rider.location === 'object') {
      const location = rider.location as any;
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

  const skip = (page - 1) * limit;

  // Get all pending bookings
  const bookings = await prisma.booking.findMany({
    where: {
      status: status as any,
      riderId: null, // Only unassigned bookings
    },
    skip,
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Filter bookings within radius using Haversine formula
  const bookingsWithinRadius = bookings.filter(booking => {
    if (!booking.pickupLocation || typeof booking.pickupLocation !== 'object') {
      return false;
    }

    const pickupLoc = booking.pickupLocation as any;
    if (
      !pickupLoc.coordinates ||
      !Array.isArray(pickupLoc.coordinates) ||
      pickupLoc.coordinates.length < 2
    ) {
      return false;
    }

    const bookingLon = parseFloat(pickupLoc.coordinates[0]);
    const bookingLat = parseFloat(pickupLoc.coordinates[1]);

    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = ((bookingLat - latitude!) * Math.PI) / 180;
    const dLon = ((bookingLon - longitude!) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((latitude! * Math.PI) / 180) *
        Math.cos((bookingLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance <= radius;
  });

  return {
    bookings: bookingsWithinRadius,
    meta: {
      page,
      limit,
      total: bookingsWithinRadius.length,
      totalPage: Math.ceil(bookingsWithinRadius.length / limit),
      radius,
    },
  };
};

// Get user's own bookings
const getMyBookings = async (userId: string, query: IGetBookingsQuery) => {
  const { status, page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const whereCondition: any = {
    userId,
  };

  if (status) {
    whereCondition.status = status;
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: whereCondition,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            profilePicture: true,
          },
        },
        rider: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            profilePicture: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.booking.count({ where: whereCondition }),
  ]);

  return {
    bookings,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

// Get rider's accepted bookings
const getRiderBookings = async (riderId: string, query: IGetBookingsQuery) => {
  const { status, page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const whereCondition: any = {
    riderId,
  };

  if (status) {
    whereCondition.status = status;
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: whereCondition,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            profilePicture: true,
          },
        },
        rider: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            profilePicture: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.booking.count({ where: whereCondition }),
  ]);

  return {
    bookings,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

// Get booking by ID
const getBookingById = async (bookingId: string, userId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
      rider: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
    },
  });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  // Check if user has access to this booking
  if (booking.userId !== userId && booking.riderId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have access to this booking',
    );
  }

  return booking;
};

// Accept booking (Rider)
const acceptBooking = async (bookingId: string, riderId: string) => {
  // Verify rider
  const rider = await prisma.user.findUnique({
    where: { id: riderId },
    select: { role: true, riderVerified: true, isDeleted: true },
  });

  if (!rider) {
    throw new AppError(httpStatus.NOT_FOUND, 'Rider not found');
  }

  if (rider.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'Rider account is deleted');
  }

  if (rider.role !== 'rider') {
    throw new AppError(httpStatus.FORBIDDEN, 'Only riders can accept bookings');
  }

  if (!rider.riderVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Your rider account is not verified yet',
    );
  }

  // Get booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.status !== 'pending') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot accept booking with status: ${booking.status}`,
    );
  }

  if (booking.riderId) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Booking has already been accepted by another rider',
    );
  }

  // Update booking
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      riderId,
      status: 'accepted',
      acceptedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
      rider: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
    },
  });

  return updatedBooking;
};

// Update booking status
const updateBookingStatus = async (
  bookingId: string,
  userId: string,
  payload: IUpdateBookingStatus,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  // Check if user has access to update this booking
  if (booking.userId !== userId && booking.riderId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have access to update this booking',
    );
  }

  const updateData: any = {
    status: payload.status,
  };

  // Set timestamp based on status
  if (payload.status === 'completed') {
    updateData.completedAt = new Date();
  } else if (payload.status === 'cancelled') {
    updateData.cancelledAt = new Date();
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
      rider: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
    },
  });

  return updatedBooking;
};

// Decline booking (Rider)
const declineBooking = async (bookingId: string, riderId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  // Riders can only decline pending bookings that are not yet assigned
  if (booking.status !== 'pending') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Can only decline pending bookings',
    );
  }

  // Just return success - the booking remains available for other riders
  return { message: 'Booking declined successfully' };
};

// Mark rider arrived at pickup (Rider)
const markArrivedAtPickup = async (bookingId: string, riderId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
  });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.riderId !== riderId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not assigned to this booking',
    );
  }

  if (booking.status !== 'accepted') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot mark arrived from status: ${booking.status}`,
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'arrived_pickup',
      arrivedAtPickup: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
      rider: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
    },
  });

  // TODO: Send notification to customer that rider has arrived

  return updatedBooking;
};

// Start collecting waste (Rider)
const startCollection = async (bookingId: string, riderId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.riderId !== riderId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not assigned to this booking',
    );
  }

  if (booking.status !== 'arrived_pickup') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot start collection from status: ${booking.status}`,
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'in_progress',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
      rider: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
    },
  });

  return updatedBooking;
};

// Mark arrived at dropoff (Rider) - if dropoff location exists
const markArrivedAtDropoff = async (bookingId: string, riderId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.riderId !== riderId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not assigned to this booking',
    );
  }

  if (booking.status !== 'in_progress') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot mark arrived at dropoff from status: ${booking.status}`,
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'arrived_dropoff',
      arrivedAtDropoff: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
      rider: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
    },
  });

  return updatedBooking;
};

// Request payment (Rider)
const requestPayment = async (bookingId: string, riderId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.riderId !== riderId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not assigned to this booking',
    );
  }

  // Can request payment from either arrived_dropoff or in_progress
  if (!['in_progress', 'arrived_dropoff'].includes(booking.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot request payment from status: ${booking.status}`,
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'awaiting_payment',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
      rider: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
        },
      },
    },
  });

  // TODO: Send notification to customer to make payment

  return updatedBooking;
};

export const bookingServices = {
  createBooking,
  getAvailableBookingsForRider,
  getMyBookings,
  getRiderBookings,
  getBookingById,
  acceptBooking,
  updateBookingStatus,
  declineBooking,
  markArrivedAtPickup,
  startCollection,
  markArrivedAtDropoff,
  requestPayment,
};
