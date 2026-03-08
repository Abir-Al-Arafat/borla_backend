import { z } from 'zod';

const dashboardQueryZodSchema = z.object({
  query: z
    .object({
      period: z.enum(['daily', 'weekly', 'monthly']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      zoneId: z.string().optional(),
    })
    .optional()
    .default({}),
});

export const operationsValidations = {
  dashboardQueryZodSchema,
};
