import { z } from 'zod';

const coordinateSchema = z.tuple([z.number(), z.number()]);
const polygonSchema = z.array(z.array(coordinateSchema));

const createZoneZodSchema = z.object({
  body: z.object({
    name: z.string().min(1, { message: 'Zone name is required' }),
    boundary: z.object({
      type: z.literal('Polygon'),
      coordinates: polygonSchema,
    }),
  }),
});

const updateZoneZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    boundary: z
      .object({
        type: z.literal('Polygon'),
        coordinates: polygonSchema,
      })
      .optional(),
  }),
});

export const zoneValidations = {
  createZoneZodSchema,
  updateZoneZodSchema,
};
