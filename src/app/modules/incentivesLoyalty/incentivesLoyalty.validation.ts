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

export const incentivesLoyaltyValidations = {
  zoneRiderLoyaltyCardsZodSchema,
};
