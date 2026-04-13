import { Request, Response } from 'express';
import catchAsync from 'app/utils/catchAsync';
import sendResponse from 'app/utils/sendResponse';
import httpStatus from 'http-status';
import { earningsServices } from './earnings.service';

const getEarnings = catchAsync(async (req: Request, res: Response) => {
  const result = await earningsServices.getEarnings(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Earnings list retrieved successfully',
    data: result.data,
    meta: result.pagination,
  });
});

const getEarningDetailsById = catchAsync(
  async (req: Request, res: Response) => {
    const result = await earningsServices.getEarningDetailsById(
      req.params.id as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Earning details retrieved successfully',
      data: result,
    });
  },
);

export const earningsControllers = {
  getEarnings,
  getEarningDetailsById,
};
