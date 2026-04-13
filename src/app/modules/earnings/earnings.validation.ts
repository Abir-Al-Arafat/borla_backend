import { z } from 'zod';

const earningsListZodSchema = z.object({
  query: z
    .object({
      search: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    })
    .optional()
    .default({}),
});

const earningDetailsZodSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Transaction id is required'),
  }),
});

export const earningsValidations = {
  earningsListZodSchema,
  earningDetailsZodSchema,
};
