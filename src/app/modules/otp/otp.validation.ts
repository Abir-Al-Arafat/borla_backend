import { z } from 'zod';

const verifyOtpZodSchema = z.object({
  body: z.object({
    otp: z
      .string()
      .nonempty('otp is required')
      .length(6, { message: 'otp must be exactly 6 characters long' }),
  }),
});

const resentOtpZodSchema = z.object({
  body: z.object({
    email: z.string().nonempty('Email is required').email(),
  }),
});

export const resentOtpValidations = {
  resentOtpZodSchema,
  verifyOtpZodSchema,
};
