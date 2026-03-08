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

const rankingQueryZodSchema = z.object({
  query: z
    .object({
      period: z.enum(['daily', 'weekly', 'monthly']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.string().optional(), // Keep as string, converted to number in service
    })
    .optional()
    .default({}),
});

const zoneQueryZodSchema = z.object({
  params: z.object({
    zoneId: z.string().min(1, 'Zone ID is required'),
  }),
  query: z
    .object({
      period: z.enum(['daily', 'weekly', 'monthly']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
    .optional()
    .default({}),
});

export const operationsValidations = {
  dashboardQueryZodSchema,
  rankingQueryZodSchema,
  zoneQueryZodSchema,
};
