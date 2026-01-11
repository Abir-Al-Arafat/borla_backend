/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  IChangePassword,
  IJwtPayload,
  ILogin,
  IResetPassword,
} from './auth.interface';
import prisma from 'app/shared/prisma';
import AppError from 'app/error/AppError';
import httpStatus from 'http-status';
import { createToken, isPasswordMatched, verifyToken } from './user.utils';
import config from 'app/config';
import { Request } from 'express';
import UAParser from 'ua-parser-js';
import bcrypt from 'bcrypt';
import { generateOtp } from 'app/utils/otpGenerator';
import moment from 'moment';
import path from 'path';
import { sendEmail } from 'app/utils/mailSender';
import fs from 'fs';

const login = async (payload: ILogin, req: Request) => {
  payload.email = payload?.email?.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      email: payload.email,
    },
    include: {
      verification: {
        select: {
          status: true,
        },
      },
    },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user?.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted');
  }

  //   if (user?.registerWith !== REGISTER_WITH.credentials) {
  //     throw new AppError(
  //       httpStatus.BAD_REQUEST,
  //       `This account is registered with ${user.registerWith}, so you should try logging in using that method.`,
  //     );
  //   }

  if (!(await isPasswordMatched(payload.password, user.password))) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password does not match');
  }

  if (!user?.verification?.status) {
    throw new AppError(httpStatus.FORBIDDEN, 'User account is not verified');
  }

  const jwtPayload: { userId: string; role: string } = {
    userId: user?.id?.toString() as string,
    role: user?.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );

  const refreshToken = createToken(
    jwtPayload,
    config.jwt_refresh_secret as string,
    config.jwt_refresh_expires_in as string,
  );

  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0] ||
    req.socket.remoteAddress ||
    '';

  const userAgent = req.headers['user-agent'] || '';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  //   const device = {
  //     userId: user.id?.toString() as string,
  //     ip,
  //     browser: result.browser.name,
  //     os: result.os.name,
  //     device: result.device.model || 'Desktop',
  //     lastLogin: new Date().toISOString(),
  //   };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      deviceHistory: {
        create: {
          ip,
          browser: result.browser.name,
          os: result.os.name,
          device: result.device.model || 'Desktop',
        },
      },
    },
    include: {
      deviceHistory: true,
    },
  });

  return {
    user,
    accessToken,
    refreshToken,
  };
};

const changePassword = async (id: string, payload: IChangePassword) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!(await isPasswordMatched(payload?.oldPassword, user.password))) {
    throw new AppError(httpStatus.FORBIDDEN, 'Old password does not match');
  }
  if (payload?.newPassword !== payload?.confirmPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'New password and confirm password do not match',
    );
  }

  const hashedPassword = await bcrypt.hash(
    payload?.newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const result = await prisma.user.update({
    where: { id },
    data: {
      password: hashedPassword,
    },
  });

  return result;
};

const forgotPassword = async (email: string) => {
  const user = await prisma.user.findFirst({
    where: { email },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const jwtPayload = {
    email: email,
    userId: user?.id,
  };

  const token = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    '3m',
  );

  const currentTime = new Date();
  const otp = generateOtp();
  const expiresAt = moment(currentTime).add(3, 'minute');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verification: {
        update: {
          otp: Number(otp),
          expiredAt: expiresAt.toDate(),
        },
      },
    },
  });

  const otpEmailPath = path.join(
    __dirname,
    '../../../../public/view/forgot_pass_mail.html',
  );

  await sendEmail(
    user?.email,
    'Your reset password OTP is',
    fs
      .readFileSync(otpEmailPath, 'utf8')
      .replace('{{otp}}', otp)
      .replace('{{email}}', user?.email),
  );
  return { email, token };
};

// Reset password
const resetPassword = async (token: string, payload: IResetPassword) => {
  let decode;
  try {
    decode = verifyToken(token, config.jwt_access_secret as string);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err: any) {
    console.log(err);
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Session has expired. Please try again',
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: decode?.userId },
    include: {
      verification: {
        select: {
          status: true,
          expiredAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // if (new Date() > (user?.verification?.expiredAt as Date)) {
  //   throw new AppError(httpStatus.FORBIDDEN, 'Session has expired');
  // }

  if (!user?.verification?.status) {
    throw new AppError(httpStatus.FORBIDDEN, 'OTP is not verified yet');
  }

  if (payload?.newPassword !== payload?.confirmPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'New password and confirm password do not match',
    );
  }

  const hashedPassword = await bcrypt.hash(
    payload?.newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const result = await prisma.user.update({
    where: { id: decode?.userId },
    data: {
      password: hashedPassword,
      verification: {
        update: {
          otp: 0,
          status: true,
        },
      },
    },
  });

  return result;
};

const refreshToken = async (token: string) => {
  // Checking if the given token is valid
  const decoded = verifyToken(token, config.jwt_refresh_secret as string);
  const { userId } = decoded;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      verification: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  const isDeleted = user?.isDeleted;

  if (isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted');
  }

  const jwtPayload: IJwtPayload = {
    userId: user?.id?.toString() as string,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );

  return {
    accessToken,
  };
};

export const authServices = {
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  //   registerWithGoogle,
  //   registerWithFacebook,
};
