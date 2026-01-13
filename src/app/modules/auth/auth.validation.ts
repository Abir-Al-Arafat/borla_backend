import { z } from 'zod';

const signupZodSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .nonempty('Name is required')
        .min(2, 'Name must be at least 2 characters'),
      email: z
        .string()
        .nonempty('Email is required')
        .email('Invalid email format'),
      phoneNumber: z.string().nonempty('Phone number is required'),
      location: z
        .object({
          type: z.literal('Point'),
          coordinates: z
            .array(z.union([z.number(), z.string()]))
            .length(2, 'Coordinates must be an array of two numbers')
            .transform(coords => {
              return coords.map(c => {
                const num = typeof c === 'string' ? parseFloat(c) : c;
                if (isNaN(num)) {
                  throw new Error('Coordinates must be valid numbers');
                }
                return num;
              });
            }),
        })
        .optional(),
      locationName: z.string().optional(),
      password: z
        .string()
        .nonempty('Password is required')
        .min(6, 'Password must be at least 6 characters'),
      confirmPassword: z.string().nonempty('Confirm password is required'),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }),
});

const loginZodSchema = z.object({
  body: z.object({
    phoneNumber: z.string().nonempty('Phone number is required'),
    password: z.string().nonempty('Password is required'),
  }),
});

const changePasswordZodSchema = z.object({
  body: z
    .object({
      oldPassword: z.string().nonempty('Old password is required'),
      newPassword: z
        .string()
        .nonempty('New password is required')
        .min(6, 'Password must be at least 6 characters'),
      confirmPassword: z.string().nonempty('Confirm password is required'),
    })
    .refine(data => data.newPassword === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }),
});

const forgotPasswordZodSchema = z.object({
  body: z.object({
    email: z
      .string()
      .nonempty('Email is required')
      .email('Invalid email format'),
  }),
});

const resetPasswordZodSchema = z.object({
  body: z
    .object({
      newPassword: z
        .string()
        .nonempty('New password is required')
        .min(6, 'Password must be at least 6 characters'),
      confirmPassword: z.string().nonempty('Confirm password is required'),
    })
    .refine(data => data.newPassword === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }),
});

const socialAuthZodSchema = z.object({
  body: z.object({
    email: z
      .string()
      .nonempty('Email is required')
      .email('Invalid email format'),
    name: z.string().nonempty('Name is required'),
    socialId: z.string().nonempty('Social ID is required'),
    provider: z.enum(['google', 'apple']),
    phoneNumber: z.string().optional(),
    profile: z.string().optional(),
  }),
});

export const authValidations = {
  signupZodSchema,
  loginZodSchema,
  changePasswordZodSchema,
  forgotPasswordZodSchema,
  resetPasswordZodSchema,
  socialAuthZodSchema,
};
