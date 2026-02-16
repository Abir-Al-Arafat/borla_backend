import { z } from 'zod';

const updateVerificationStatusZodSchema = z.object({
  body: z.object({
    status: z.enum(['verified', 'rejected'], {
      message: 'Status is required',
    }),
  }),
});

const getRidersQueryZodSchema = z.object({
  query: z
    .object({
      status: z.enum(['pending', 'verified', 'rejected']).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
      searchTerm: z.string().optional(),
    })
    .optional()
    .default({}),
});

export const riderVerificationValidations = {
  updateVerificationStatusZodSchema,
  getRidersQueryZodSchema,
};
