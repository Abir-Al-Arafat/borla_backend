import { z } from 'zod';

const zoneRiderLoyaltyCardsZodSchema = z.object({
  query: z
    .object({
      zoneId: z.string().optional(),
      zoneName: z.string().optional(),
      limit: z.string().optional(),
    })
    .optional()
    .default({}),
});

const customerLoyaltyZodSchema = z.object({
  query: z
    .object({
      search: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    })
    .optional()
    .default({}),
});

export const incentivesLoyaltyValidations = {
  zoneRiderLoyaltyCardsZodSchema,
  customerLoyaltyZodSchema,
};
