import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { uploadToS3 } from '../../utils/s3';
import { userService } from './user.service';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import { otpServices } from '../otp/otp.service';
import fs from 'fs';
import prisma from '../../shared/prisma';

const createUser = catchAsync(async (req: Request, res: Response) => {
  if (req?.file) {
    // Local storage - save file path instead of uploading to S3
    req.body.profilePicture = req.file.path;
    // Uncomment below to use S3 upload
    // req.body.profilePicture = await uploadToS3({
    //   file: req.file,
    //   fileName: `images/user/profile/${Math.floor(100000 + Math.random() * 900000)}`,
    // });
  }
  const result = await userService.create(req.body);
  const sendOtp = await otpServices.resendOtp({ email: result?.email });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User created successfully',
    data: { user: result, otpToken: sendOtp },
  });
});

const getAllUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getAll(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Users fetched successfully',
    data: result,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const includeDeviceHistory = req.query.includeDeviceHistory === 'true';
  const result = await userService.getById(
    req.params.id as string,
    includeDeviceHistory,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User fetched successfully',
    data: result,
  });
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const includeDeviceHistory = req.query.includeDeviceHistory === 'true';
  const result = await userService.getById(
    req?.user?.userId,
    includeDeviceHistory,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'profile fetched successfully',
    data: result,
  });
});

const updateUser = catchAsync(async (req: Request, res: Response) => {
  if (req?.file) {
    // Get old profile picture path
    const user = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      select: { profilePicture: true },
    });

    // Delete old profile picture if exists
    if (user?.profilePicture && fs.existsSync(user.profilePicture)) {
      fs.unlinkSync(user.profilePicture);
    }

    // Local storage - save file path instead of uploading to S3
    req.body.profilePicture = req.file.path;
    // Uncomment below to use S3 upload
    // req.body.profilePicture = await uploadToS3({
    //   file: req.file,
    //   fileName: `images/user/profile/${Math.floor(100000 + Math.random() * 900000)}`,
    // });
  }

  const result = await userService.update(req.params.id as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User updated successfully',
    data: result,
  });
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  if (req?.file) {
    // Get old profile picture path
    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: { profilePicture: true },
    });

    // Delete old profile picture if exists
    if (user?.profilePicture && fs.existsSync(user.profilePicture)) {
      fs.unlinkSync(user.profilePicture);
    }

    // Local storage - save file path instead of uploading to S3
    req.body.profilePicture = req.file.path;
    // Uncomment below to use S3 upload
    // req.body.profilePicture = await uploadToS3({
    //   file: req.file,
    //   fileName: `images/user/profile/${Math.floor(100000 + Math.random() * 900000)}`,
    // });
  }

  if (!req.body || !Object.keys(req.body).length) {
    sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'No data provided for update. Please send at least one field.',
      data: null,
    });
    return;
  }

  // Handle location update if coordinates are provided
  if (req.body.latitude && req.body.longitude) {
    const latitude =
      typeof req.body.latitude === 'string'
        ? parseFloat(req.body.latitude)
        : req.body.latitude;
    const longitude =
      typeof req.body.longitude === 'string'
        ? parseFloat(req.body.longitude)
        : req.body.longitude;

    req.body.location = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };

    // Remove the raw coordinates from body
    delete req.body.latitude;
    delete req.body.longitude;
  }

  const result = await userService.update(req?.user?.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'profile updated successfully',
    data: result,
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.deleteUser(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User deleted successfully',
    data: result,
  });
});

const deleteMYAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.deleteUser(req.user?.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User deleted successfully',
    data: result,
  });
});

const toggleUserStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.toggleUserStatus(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `User status toggled to ${result.onlineStatus} successfully`,
    data: result,
  });
});

const toggleMyStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.toggleUserStatus(req.user?.userId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Your status is now ${result.onlineStatus}`,
    data: result,
  });
});

const toggleAccountStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.toggleAccountStatus(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `User account is now ${result.status}`,
    data: result,
  });
});

const updateMyLocation = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.updateMyLocation(
    req.user?.userId as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Location updated successfully',
    data: result,
  });
});

export const userController = {
  createUser,
  getAllUser,
  getUserById,
  getMyProfile,
  updateUser,
  updateMyProfile,
  deleteUser,
  deleteMYAccount,
  toggleUserStatus,
  toggleMyStatus,
  toggleAccountStatus,
  updateMyLocation,
};
