import catchAsync from '../../utils/catchAsync';
import { Request, Response } from 'express';
import { riderServices } from './rider.service';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';

// Find available riders within radius
const findAvailableRiders = catchAsync(async (req: Request, res: Response) => {
  const result = await riderServices.findAvailableRiders(
    req.user.userId,
    req.query,
  );

  const message = !result.riders.length
    ? `No riders available within ${result.meta.radius}km radius`
    : `Found ${result.riders.length} rider(s) within ${result.meta.radius}km`;

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message,
    data: result.riders,
    meta: result.meta,
  });
});

export const riderControllers = {
  findAvailableRiders,
};
