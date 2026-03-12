import prisma from 'app/shared/prisma';
import AppError from 'app/error/AppError';
import httpStatus from 'http-status';
import { STATUS_MAP } from './booking.constants';
import {
  ICreateBooking,
  IGetBookingsQuery,
  IUpdateBookingStatus,
} from './booking.interface';
import { validateBookingQuery } from './booking.utils';

// Helper function to get rider statistics
const getRiderStats = async (riderId: string) => {
  // Get average rating for this rider
  const ratingStats = await prisma.rating.aggregate({
    where: {
      booking: {
        riderId: riderId,
      },
    },
    _avg: {
      rating: true,
    },
    _count: {
      rating: true,
    },
  });

  // Get count of completed bookings
  const completedBookingsCount = await prisma.booking.count({
    where: {
      riderId: riderId,
      status: 'completed',
    },
  });

  return {
    averageRating: ratingStats._avg.rating || 0,
    totalRatings: ratingStats._count.rating || 0,
    completedBookings: completedBookingsCount,
  };
};

// Helper function to attach rider stats to a booking
const attachRiderStatsToBooking = async (booking: any) => {
  if (booking.riderId && booking.rider) {
    const riderStats = await getRiderStats(booking.riderId);
    return {
      ...booking,
      rider: {
        ...booking.rider,
        averageRating: riderStats.averageRating,
        totalRatings: riderStats.totalRatings,
        completedBookings: riderStats.completedBookings,
      },
    };
  }
  return booking;
};

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

  // Handle scheduling
  let scheduledFor: Date | undefined = undefined;
  if (payload.isScheduled && payload.scheduledFor) {
    scheduledFor = new Date(payload.scheduledFor);
    
    // Validate that scheduled date is in the future
    if (scheduledFor <= new Date()) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Scheduled time must be in the future',
      );
    }
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
      // Scheduling fields
      isScheduled: payload.isScheduled || false,
      scheduledFor: scheduledFor,
      scheduledDate: payload.scheduledDate,
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

// Get available bookings for riders (within their assigned zone)
const getAvailableBookingsForRider = async (
  riderId: string,
  query: IGetBookingsQuery,
) => {
  // Verify rider exists and is verified, and get their zone
  const rider = await prisma.user.findUnique({
    where: { id: riderId },
    select: {
      role: true,
      riderVerified: true,
      zoneId: true,
      isDeleted: true,
      zone: {
        select: {
          id: true,
          name: true,
          boundary: true,
        },
      },
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

  if (!rider.zoneId || !rider.zone) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You have not been assigned to a zone yet. Please contact admin.',
    );
  }

  // Validate and sanitize query parameters
  const { status, page, limit } = validateBookingQuery(query);

  const skip = (page - 1) * limit;

  // Get the zone boundary
  const zoneBoundary = rider.zone.boundary as any;

  // Use MongoDB's $geoWithin operator to find bookings within the zone boundary
  const bookingsInZone = await prisma.booking.aggregateRaw({
    pipeline: [
      {
        $match: {
          status: status,
          riderId: null,
        },
      },
      {
        $match: {
          pickupLocation: {
            $geoWithin: {
              $geometry: zoneBoundary,
            },
          },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          riderId: 1,
          wasteCategory: 1,
          wasteImages: 1,
          binSize: 1,
          binQuantity: 1,
          wasteSize: 1,
          pickupLocation: 1,
          pickupAddress: 1,
          dropoffLocation: 1,
          dropoffAddress: 1,
          vehicleType: 1,
          estimatedDistance: 1,
          estimatedTime: 1,
          paymentMethod: 1,
          price: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          'user._id': 1,
          'user.name': 1,
          'user.email': 1,
          'user.phoneNumber': 1,
          'user.profilePicture': 1,
        },
      },
    ],
  });

  // Get total count of bookings in zone
  const totalCountResult = await prisma.booking.aggregateRaw({
    pipeline: [
      {
        $match: {
          status: status,
          riderId: null,
        },
      },
      {
        $match: {
          pickupLocation: {
            $geoWithin: {
              $geometry: zoneBoundary,
            },
          },
        },
      },
      {
        $count: 'total',
      },
    ],
  });

  const total =
    Array.isArray(totalCountResult) && totalCountResult.length > 0
      ? (totalCountResult[0] as any).total
      : 0;

  // Transform the results to match the expected format
  const bookings = Array.isArray(bookingsInZone)
    ? bookingsInZone.map((booking: any) => ({
        id: booking._id.$oid,
        userId: booking.userId.$oid,
        riderId: booking.riderId?.$oid || null,
        wasteCategory: booking.wasteCategory,
        wasteImages: booking.wasteImages,
        binSize: booking.binSize,
        binQuantity: booking.binQuantity,
        wasteSize: booking.wasteSize,
        pickupLocation: booking.pickupLocation,
        pickupAddress: booking.pickupAddress,
        dropoffLocation: booking.dropoffLocation,
        dropoffAddress: booking.dropoffAddress,
        vehicleType: booking.vehicleType,
        estimatedDistance: booking.estimatedDistance,
        estimatedTime: booking.estimatedTime,
        paymentMethod: booking.paymentMethod,
        price: booking.price,
        status: booking.status,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        user: booking.user
          ? {
              id: booking.user._id.$oid,
              name: booking.user.name,
              email: booking.user.email,
              phoneNumber: booking.user.phoneNumber,
              profilePicture: booking.user.profilePicture,
            }
          : null,
      }))
    : [];

  return {
    bookings,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
      zone: {
        id: rider.zone.id,
        name: rider.zone.name,
      },
    },
  };
};

// Get user's own bookings
const getMyBookings = async (userId: string, query: IGetBookingsQuery) => {
  let { status, page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const whereCondition: any = {
    userId,
  };

  if (status) {
    status = STATUS_MAP[status] || status; // Map to internal status if needed
  }

  if (status && typeof status === 'string') {
    whereCondition.status = status;
  }

  if (status && typeof status === 'object' && Array.isArray(status)) {
    whereCondition.status = { in: status };
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

  // Get unique rider IDs from bookings
  const riderIds = [
    ...new Set(bookings.map(b => b.riderId).filter(Boolean) as string[]),
  ];

  // Fetch rider stats for all riders
  const riderStatsMap = new Map();
  await Promise.all(
    riderIds.map(async riderId => {
      const stats = await getRiderStats(riderId);
      riderStatsMap.set(riderId, stats);
    }),
  );

  // Attach rider stats to bookings
  const bookingsWithStats = bookings.map(booking => ({
    ...booking,
    rider: booking.rider
      ? {
          ...booking.rider,
          averageRating: riderStatsMap.get(booking.riderId)?.averageRating || 0,
          totalRatings: riderStatsMap.get(booking.riderId)?.totalRatings || 0,
          completedBookings:
            riderStatsMap.get(booking.riderId)?.completedBookings || 0,
        }
      : null,
  }));

  return {
    bookings: bookingsWithStats,
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
  let { status, page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const whereCondition: any = {
    riderId,
  };

  if (status) {
    status = STATUS_MAP[status] || status; // Map to internal status if needed
  }

  if (status && typeof status === 'string') {
    whereCondition.status = status;
  }

  if (status && typeof status === 'object' && Array.isArray(status)) {
    whereCondition.status = { in: status };
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
            role: true,
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
            location: true,
            locationName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.booking.count({ where: whereCondition }),
  ]);

  // Get rider stats for this specific rider
  const riderStats = await getRiderStats(riderId);

  // Attach rider stats to all bookings
  const bookingsWithStats = bookings.map(booking => ({
    ...booking,
    rider: booking.rider
      ? {
          ...booking.rider,
          averageRating: riderStats.averageRating,
          totalRatings: riderStats.totalRatings,
          completedBookings: riderStats.completedBookings,
        }
      : null,
  }));

  return {
    bookings: bookingsWithStats,
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

  // Add rider stats if rider exists
  if (booking.riderId) {
    const riderStats = await getRiderStats(booking.riderId);
    return {
      ...booking,
      rider: booking.rider
        ? {
            ...booking.rider,
            averageRating: riderStats.averageRating,
            totalRatings: riderStats.totalRatings,
            completedBookings: riderStats.completedBookings,
          }
        : null,
    };
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

// Mark payment collected at pickup (Rider)
const markPaymentCollectedAtPickup = async (
  bookingId: string,
  riderId: string,
) => {
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
      `Cannot mark payment collected from status: ${booking.status}`,
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'payment_collected',
      isPaid: true,
      paidAt: new Date(),
      paymentCollectedAt: new Date(),
    },
  });

  if (updatedBooking) {
    return updatedBooking;
  } else {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Failed to mark payment collected',
    );
  }
};

// Mark heading to station (Rider) - for bookings with dropoff to station
const markHeadingToStation = async (
  bookingId: string,
  riderId: string,
  stationId: string,
) => {
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

  if (booking.status !== 'payment_collected') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot mark heading to station from status: ${booking.status}`,
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'heading_to_station',
      headingToStationAt: new Date(),
      stationId: stationId,
    },
  });

  if (updatedBooking) {
    return updatedBooking;
  } else {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Failed to mark heading to station',
    );
  }
};

// Mark completed (Rider) - for bookings with dropoff to station after arriving at station
const markCompleted = async (bookingId: string, riderId: string) => {
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

  if (booking.status !== 'heading_to_station') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot mark completed from status: ${booking.status}`,
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
    include: {
      station: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    },
  });

  if (updatedBooking) {
    return updatedBooking;
  } else {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to mark completed');
  }
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
  if (
    !['in_progress', 'arrived_dropoff', 'arrived_pickup'].includes(
      booking.status,
    )
  ) {
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
  markPaymentCollectedAtPickup,
  markHeadingToStation,
  markCompleted,
  startCollection,
  markArrivedAtDropoff,
  requestPayment,
};
