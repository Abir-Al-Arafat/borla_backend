import AppError from 'app/error/AppError';
import httpStatus from 'http-status';
import { IGetBookingsQuery } from './booking.interface';

interface ValidatedBookingQuery {
  status: string;
  page: number;
  limit: number;
  radius: number;
  latitude?: number;
  longitude?: number;
  populateUser: boolean;
}

/**
 * Validates and sanitizes booking query parameters
 * Handles empty strings, invalid values, and applies defaults
 */
export const validateBookingQuery = (
  query: IGetBookingsQuery,
): ValidatedBookingQuery => {
  const { status, page, limit, radius, latitude, longitude, populateUser } =
    query;

  // Validate and sanitize status
  const validStatus =
    status && status.trim() !== '' ? status.trim() : 'pending';

  const validStatuses = [
    'pending',
    'accepted',
    'arrived_pickup',
    'in_progress',
    'arrived_dropoff',
    'awaiting_payment',
    'completed',
    'cancelled',
  ];

  if (!validStatuses.includes(validStatus)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    );
  }

  // Validate and sanitize page
  const validPage =
    typeof page === 'number' && page > 0
      ? page
      : page
        ? parseInt(String(page), 10) || 1
        : 1;

  // Validate and sanitize limit (max 100)
  const validLimit =
    typeof limit === 'number' && limit > 0
      ? Math.min(limit, 100)
      : limit
        ? Math.min(parseInt(String(limit), 10) || 10, 100)
        : 10;

  // Validate and sanitize radius (default 10km)
  const validRadius =
    typeof radius === 'number' && radius > 0
      ? radius
      : radius
        ? parseFloat(String(radius)) || 10
        : 10;

  const validPopulateUser =
    typeof populateUser === 'boolean'
      ? populateUser
      : ['true', '1', 'yes'].includes(String(populateUser).toLowerCase());

  return {
    status: validStatus,
    page: validPage,
    limit: validLimit,
    radius: validRadius,
    latitude,
    longitude,
    populateUser: validPopulateUser,
  };
};
