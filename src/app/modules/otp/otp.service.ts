import AppError from '../../error/AppError';
import httpStatus from 'http-status';
import { status } from '../../../generated/prisma';
import { generateOtp } from '../../utils/otpGenerator';
import moment from 'moment';
import config from '../../config';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import path from 'path';
import { sendEmail } from '../../utils/mailSender';
import fs from 'fs';
import prisma from '../../shared/prisma';

const resendOtp = async (payload: { email: string }) => {
  try {
    const user = await prisma.user.findFirst({
      where: {
        email: payload?.email,
      },
    });

    if (!user)
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'you are not registered with this mail',
      );

    if (user?.status === status.blocked)
      throw new AppError(httpStatus.FORBIDDEN, 'this user has been blocked ');

    if (user?.isDeleted)
      throw new AppError(httpStatus.FORBIDDEN, 'this user has been deleted ');

    const otp = generateOtp();
    const expiresAt = moment().utc().add(3, 'minute');

    const updateOtp = await prisma.verification.upsert({
      where: {
        userId: user.id,
      },
      update: {
        otp: Number(otp),
        expiredAt: expiresAt.toDate(),
      },

      create: {
        userId: user.id,
        otp: Number(otp),
        expiredAt: expiresAt.toDate(),
        status: false,
      },
    });

    if (!updateOtp)
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Failed to resend OTP. Please try again later',
      );

    const jwtPayload = {
      email: user?.email,
      userId: user?.id,
    };
    const token = jwt.sign(jwtPayload, config.jwt_access_secret as Secret, {
      expiresIn: '3m',
    });

    const otpEmailPath = path.join(
      __dirname,
      '../../../../public/view/otp_mail.html',
    );

    await sendEmail(
      user?.email,
      'Your One Time OTP',
      fs
        .readFileSync(otpEmailPath, 'utf8')
        .replace('{{otp}}', otp)
        .replace('{{email}}', user?.email),
    );

    return { token };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, error?.message);
  }
};

const verifyOtp = async (token: string, otp: string | number) => {
  if (!token)
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized');

  let decode: JwtPayload;

  try {
    decode = jwt.verify(
      token,
      config.jwt_access_secret as Secret,
    ) as JwtPayload;
  } catch {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Session has expired. Please try to submit OTP within 3 minutes',
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: decode.userId },
    include: { verification: true },
  });

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found');
  }

  if (!user.verification) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Verification record not found');
  }

  if (!user.verification?.expiredAt) {
    throw new AppError(httpStatus.BAD_REQUEST, 'OTP expiration date missing');
  }

  if (new Date() > user.verification.expiredAt) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'OTP has expired. Please resend it',
    );
  }

  if (Number(otp) !== Number(user.verification.otp)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'OTP did not match');
  }

  // Update verification record - mark status true, reset OTP & expiresAt
  const updateUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      expireAt: null,
      verification: {
        update: {
          where: { userId: user.id },
          data: {
            otp: 0,
            expiredAt: null,
            status: true,
          },
        },
      },
    },
  });

  const jwtPayload = {
    email: updateUser.email,
    role: updateUser.role,
    userId: updateUser.id,
  };

  const jwtToken = jwt.sign(jwtPayload, config.jwt_access_secret as Secret, {
    expiresIn: '30d',
  });

  return { user: updateUser, token: jwtToken };
};

export const otpServices = {
  verifyOtp,
  resendOtp,
};
