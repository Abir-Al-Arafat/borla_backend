import { Request, Response } from 'express';
import catchAsync from 'app/utils/catchAsync';
import sendResponse from 'app/utils/sendResponse';
import httpStatus from 'http-status';
import { zoneServices } from './zone.service';
import pick from 'app/utils/pick';

const createZone = catchAsync(async (req: Request, res: Response) => {
  const result = await zoneServices.createZone(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Zone created successfully',
    data: result,
  });
});

const getAllZones = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query, ['searchTerm', 'page', 'limit']);
  const result = await zoneServices.getAllZones(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Zones retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getZoneById = catchAsync(async (req: Request, res: Response) => {
  const result = await zoneServices.getZoneById(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Zone retrieved successfully',
    data: result,
  });
});

const updateZone = catchAsync(async (req: Request, res: Response) => {
  const result = await zoneServices.updateZone(
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Zone updated successfully',
    data: result,
  });
});

const deleteZone = catchAsync(async (req: Request, res: Response) => {
  const result = await zoneServices.deleteZone(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

export const zoneControllers = {
  createZone,
  getAllZones,
  getZoneById,
  updateZone,
  deleteZone,
};
