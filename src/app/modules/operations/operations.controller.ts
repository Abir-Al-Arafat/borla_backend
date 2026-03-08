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

const getPickupSuccessRate = catchAsync(async (req: Request, res: Response) => {
  const result = await operationsServices.getPickupSuccessRate(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Pickup success rate retrieved successfully',
    data: result,
  });
});

const getZoneRanking = catchAsync(async (req: Request, res: Response) => {
  const result = await operationsServices.getZoneRanking(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Zone ranking retrieved successfully',
    data: result,
  });
});

const getTopRiders = catchAsync(async (req: Request, res: Response) => {
  const result = await operationsServices.getTopRiders(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Top performing riders retrieved successfully',
    data: result,
  });
});

const getZoneDetails = catchAsync(async (req: Request, res: Response) => {
  const result = await operationsServices.getZoneDetails({
    zoneId: req.params.zoneId as string,
    ...req.query,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Zone details retrieved successfully',
    data: result,
  });
});

const getZoneTrends = catchAsync(async (req: Request, res: Response) => {
  const result = await operationsServices.getZoneTrends({
    zoneId: req.params.zoneId as string,
    ...req.query,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Zone performance trends retrieved successfully',
    data: result,
  });
});

const getZoneComparison = catchAsync(async (req: Request, res: Response) => {
  const result = await operationsServices.getZoneComparison(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Zone comparison data retrieved successfully',
    data: result,
  });
});

export const operationsControllers = {
  getPickupsPerHour,
  getAvgPickupTimeByDay,
  getCompletionRate,
  getZoneHealth,
  getOperationsDashboard,
  getPickupSuccessRate,
  getZoneRanking,
  getTopRiders,
  getZoneDetails,
  getZoneTrends,
  getZoneComparison,
};
