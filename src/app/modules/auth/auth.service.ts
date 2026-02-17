/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  IChangePassword,
  IJwtPayload,
  ILogin,
  IResetPassword,
  ISignup,
  ISocialAuth,
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
import axios from 'axios';

const signup = async (payload: ISignup) => {
  payload.email = payload?.email?.trim().toLowerCase();

  // Check if passwords match
  if (payload.password !== payload.confirmPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Password and confirm password do not match',
    );
  }

  // Check if user already exists by email or phoneNumber
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: payload.email }, { phoneNumber: payload.phoneNumber }],
    },
    include: {
      verification: true,
    },
  });

  if (existingUser && existingUser.verification?.status) {
    if (existingUser.email === payload.email) {
      throw new AppError(
        httpStatus.CONFLICT,
        'User with this email already exists',
      );
    }
    if (existingUser.phoneNumber === payload.phoneNumber) {
      throw new AppError(
        httpStatus.CONFLICT,
        'User with this phone number already exists',
      );
    }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(
    payload.password,
    Number(config.bcrypt_salt_rounds),
  );

  // Generate OTP
  const otp = generateOtp(4);
  const currentTime = new Date();
  const expiresAt = moment(currentTime).add(3, 'minutes');

  let user;

  // Determine role (default to 'user' if not provided)
  const userRole = payload.role || 'user';

  // If user exists but not verified, update the user
  if (existingUser) {
    user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: payload.name,
        phoneNumber: payload.phoneNumber,
        role: userRole,
        location: payload.location || null,
        locationName: payload.locationName || null,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
        ghanaCardId: payload.ghanaCardId || [],
        riderVerified: userRole === 'rider' ? false : true, // Riders need admin approval
        password: hashedPassword,
        verification: {
          update: {
            otp: Number(otp),
            expiredAt: expiresAt.toDate(),
            status: false,
          },
        },
        documents:
          userRole === 'rider' &&
          payload.ghanaCardId &&
          payload.ghanaCardId.length
            ? {
                create: payload.ghanaCardId.map(path => ({
                  document: path,
                  type: 'idCard',
                  status: 'pending',
                })),
              }
            : undefined,
      },
      include: {
        verification: true,
      },
    });
  } else {
    // Create new user
    user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        phoneNumber: payload.phoneNumber,
        role: userRole,
        location: payload.location || null,
        locationName: payload.locationName || null,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
        ghanaCardId: payload.ghanaCardId || [],
        riderVerified: userRole === 'rider' ? false : true, // Riders need admin approval
        password: hashedPassword,
        verification: {
          create: {
            otp: Number(otp),
            expiredAt: expiresAt.toDate(),
            status: false,
          },
        },
        documents:
          userRole === 'rider' &&
          payload.ghanaCardId &&
          payload.ghanaCardId.length > 0
            ? {
                create: payload.ghanaCardId.map(path => ({
                  document: path,
                  type: 'idCard',
                  status: 'pending',
                })),
              }
            : undefined,
      },
      include: {
        verification: true,
      },
    });
  }

  // Send OTP to email
  const otpEmailPath = path.join(
    __dirname,
    '../../../../public/view/signup_otp_mail.html',
  );

  await sendEmail(
    user.email,
    'Verify your account - Borla',
    fs
      .readFileSync(otpEmailPath, 'utf8')
      .replace('{{otp}}', otp)
      .replace('{{email}}', user.email)
      .replace('{{name}}', user.name),
  );

  try {
    await sendTermiiSMS(payload.phoneNumber, otp);
  } catch (err) {
    console.error('Failed to send SMS OTP:', err);
  }

  // Create verification token
  const jwtPayload = {
    email: user.email,
    userId: user.id,
  };

  const verificationToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    '15m',
  );

  return {
    email: user.email,
    name: user.name,
    verificationToken,
    message: 'OTP sent to your email. Please verify to complete signup.',
  };
};

const login = async (payload: ILogin, req: Request) => {
  // Trim input
  if (payload.phoneNumber) {
    payload.phoneNumber = payload.phoneNumber.trim();
  }
  if (payload.email) {
    payload.email = payload.email.trim().toLowerCase();
  }

  // Build where condition - support email or phoneNumber
  const whereCondition: any = {};
  if (payload.email) {
    whereCondition.email = payload.email;
  } else if (payload.phoneNumber) {
    whereCondition.phoneNumber = payload.phoneNumber;
  }

  const user = await prisma.user.findFirst({
    where: whereCondition,
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

  if (!(await isPasswordMatched(payload.password, user.password as string))) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password does not match');
  }

  if (!user?.verification?.status) {
    throw new AppError(httpStatus.FORBIDDEN, 'User account is not verified');
  }

  // Check if rider is approved by admin
  if (user.role === 'rider' && !user.riderVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Your rider account is pending admin approval. Please wait for verification.',
    );
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

  if (
    !(await isPasswordMatched(payload?.oldPassword, user.password as string))
  ) {
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
  const otp = generateOtp(4);
  const expiresAt = moment(currentTime).add(3, 'minute');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verification: {
        update: {
          otp: Number(otp),
          expiredAt: expiresAt.toDate(),
          status: false,
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
          expiredAt: null,
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

const registerWithGoogle = async (payload: ISocialAuth, req: Request) => {
  payload.email = payload?.email?.trim().toLowerCase();

  let user = await prisma.user.findFirst({
    where: { email: payload.email },
    include: { verification: true },
  });

  if (!user) {
    // Create new user with Google OAuth
    user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        phoneNumber: payload.phoneNumber,
        profile: payload.profile,
        role: 'user',
        password: null,
        verification: {
          create: {
            otp: 0,
            expiredAt: null,
            status: true, // OAuth users are auto-verified
          },
        },
      },
      include: { verification: true },
    });
  }

  if (user?.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted');
  }

  const jwtPayload = {
    userId: user.id,
    role: user.role,
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

  // Track device history
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0] ||
    req.socket.remoteAddress ||
    '';

  const userAgent = req.headers['user-agent'] || '';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

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
  });

  return {
    user,
    accessToken,
    refreshToken,
  };
};

const registerWithApple = async (payload: ISocialAuth, req: Request) => {
  payload.email = payload?.email?.trim().toLowerCase();

  let user = await prisma.user.findFirst({
    where: { email: payload.email },
    include: { verification: true },
  });

  if (!user) {
    // Create new user with Apple OAuth
    user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        phoneNumber: payload.phoneNumber,
        profile: payload.profile,
        role: 'user',
        password: null,
        verification: {
          create: {
            otp: 0,
            expiredAt: null,
            status: true, // OAuth users are auto-verified
          },
        },
      },
      include: { verification: true },
    });
  }

  if (user?.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted');
  }

  const jwtPayload = {
    userId: user.id,
    role: user.role,
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

  // Track device history
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0] ||
    req.socket.remoteAddress ||
    '';

  const userAgent = req.headers['user-agent'] || '';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

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
  });

  return {
    user,
    accessToken,
    refreshToken,
  };
};

const sendTermiiSMS = async (phoneNumber: string, otp: string) => {
  try {
    const data = {
      api_key: config.TERMII_API_KEY, // Add this to your config/env
      to: phoneNumber,
      from: config.TERMII_SENDER_ID, // Or your registered Sender ID
      channel: config.TERMII_CHANNEL, // e.g., "generic", "dnd", etc.
      pin_attempts: 3,
      pin_time_to_live: 5,
      pin_length: 4,
      pin_type: 'NUMERIC',
      message_text: `Your Borla verification code is ${otp}`,
      pin_placeholder: otp,
    };

    // Using axios (ensure it's installed)
    await axios.post('https://api.ng.termii.com/api/sms/otp/send', data);
  } catch (error: any) {
    // Check if the error came from Termii's response
    if (error.response) {
      console.error('Termii API Error Details:', error.response.data);
    } else {
      console.error('Connection Error:', error.message);
    }
    // Re-throw with more detail during debugging
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.response?.data?.message || 'Failed to send SMS verification',
    );
  }
};

export const authServices = {
  signup,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  registerWithGoogle,
  registerWithApple,
};
