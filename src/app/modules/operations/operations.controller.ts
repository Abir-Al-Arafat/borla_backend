import { Request, Response } from 'express';
import catchAsync from 'app/utils/catchAsync';
import sendResponse from 'app/utils/sendResponse';
import httpStatus from 'http-status';
import { operationsServices } from './operations.service';

const getPickupsPerHour = catchAsync(async (req: Request, res: Response) => {
  const result = await operationsServices.getPickupsPerHour(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Pickups per hour data retrieved successfully',
    data: result,
  });
});

const getAvgPickupTimeByDay = catchAsync(
  async (req: Request, res: Response) => {
    const result = await operationsServices.getAvgPickupTimeByDay(req.query);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Average pickup time by day retrieved successfully',
      data: result,
    });
  },
);

const getCompletionRate = catchAsync(async (req: Request, res: Response) => {
  const result = await operationsServices.getCompletionRate(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Completion rate retrieved successfully',
    data: result,
  });
});

const getZoneHealth = catchAsync(async (req: Request, res: Response) => {
  const result = await operationsServices.getZoneHealth(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Zone health data retrieved successfully',
    data: result,
  });
});

const getOperationsDashboard = catchAsync(
  async (req: Request, res: Response) => {
    const result = await operationsServices.getOperationsDashboard(req.query);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Operations dashboard data retrieved successfully',
      data: result,
    });
  },
);

export const operationsControllers = {
  getPickupsPerHour,
  getAvgPickupTimeByDay,
  getCompletionRate,
  getZoneHealth,
  getOperationsDashboard,
};
