import { z } from 'zod';

const findAvailableRidersQueryZodSchema = z.object({
  query: z
    .object({
      latitude: z
        .string()
        .optional()
        .transform(val => (val ? parseFloat(val) : undefined)),
      longitude: z
        .string()
        .optional()
        .transform(val => (val ? parseFloat(val) : undefined)),
      radius: z
        .string()
        .optional()
        .transform(val => (val ? parseFloat(val) : 10)),
    })
    .optional()
    .default({
      latitude: undefined,
      longitude: undefined,
      radius: 10,
    }),
});

export const riderValidations = {
  findAvailableRidersQueryZodSchema,
};
