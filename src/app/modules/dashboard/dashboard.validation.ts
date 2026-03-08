import { z } from 'zod';

const userOverviewQueryZodSchema = z.object({
  query: z
    .object({
      year: z.string().optional(),
      userType: z.enum(['User', 'Rider']).optional(),
    })
    .optional()
    .default({}),
});

const revenueChartQueryZodSchema = z.object({
  query: z.object({
    period: z.enum(['weekly', 'monthly']),
  }),
});

const wasteDistributionQueryZodSchema = z.object({
  query: z.object({
    period: z.enum(['weekly', 'monthly']),
  }),
});

const recentAccountsQueryZodSchema = z.object({
  query: z
    .object({
      accountType: z.enum(['User', 'Rider']).optional(),
      status: z.enum(['Active', 'Inactive']).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    })
    .optional()
    .default({}),
});

export const dashboardValidations = {
  userOverviewQueryZodSchema,
  revenueChartQueryZodSchema,
  wasteDistributionQueryZodSchema,
  recentAccountsQueryZodSchema,
};
