import { Request, Response } from 'express';
import catchAsync from 'app/utils/catchAsync';
import sendResponse from 'app/utils/sendResponse';
import httpStatus from 'http-status';
import { incentivesLoyaltyServices } from './incentivesLoyalty.service';

const getZoneRiderLoyaltyCards = catchAsync(
  async (req: Request, res: Response) => {
    const result = await incentivesLoyaltyServices.getZoneRiderLoyaltyCards(
      req.query,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Rider incentives and loyalty cards retrieved successfully',
      data: result,
    });
  },
);

export const incentivesLoyaltyControllers = {
  getZoneRiderLoyaltyCards,
};
