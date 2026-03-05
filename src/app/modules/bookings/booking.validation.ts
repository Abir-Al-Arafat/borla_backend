import { z } from 'zod';

const createBookingZodSchema = z.object({
  body: z.object({
    wasteCategory: z.enum(['organic', 'metal', 'plastic', 'general', 'paper']),
    wasteImages: z.array(z.string()).optional().default([]),
    binSize: z.string().nonempty('Bin size is required'),
    binQuantity: z
      .union([z.number(), z.string()])
      .transform(val => {
        const num = typeof val === 'string' ? parseInt(val) : val;
        if (isNaN(num)) throw new Error('Invalid bin quantity');
        return num;
      })
      .refine(val => val > 0, 'Bin quantity must be greater than 0'),
    wasteSize: z
      .union([z.number(), z.string()])
      .transform(val => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) throw new Error('Invalid waste size');
        return num;
      })
      .refine(val => val > 0, 'Waste size must be greater than 0'),
    pickupLatitude: z
      .union([z.number(), z.string()])
      .transform(val => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) throw new Error('Invalid pickup latitude');
        return num;
      })
      .refine(
        val => val >= -90 && val <= 90,
        'Pickup latitude must be between -90 and 90',
      ),
    pickupLongitude: z
      .union([z.number(), z.string()])
      .transform(val => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) throw new Error('Invalid pickup longitude');
        return num;
      })
      .refine(
        val => val >= -180 && val <= 180,
        'Pickup longitude must be between -180 and 180',
      ),
    pickupAddress: z.string().nonempty('Pickup address is required'),
    dropoffLatitude: z
      .union([z.number(), z.string()])
      .transform(val => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) throw new Error('Invalid dropoff latitude');
        return num;
      })
      .refine(
        val => val >= -90 && val <= 90,
        'Dropoff latitude must be between -90 and 90',
      )
      .optional(),
    dropoffLongitude: z
      .union([z.number(), z.string()])
      .transform(val => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) throw new Error('Invalid dropoff longitude');
        return num;
      })
      .refine(
        val => val >= -180 && val <= 180,
        'Dropoff longitude must be between -180 and 180',
      )
      .optional(),
    dropoffAddress: z.string().optional(),
    vehicleType: z.string().optional(),
    estimatedDistance: z
      .union([z.number(), z.string()])
      .transform(val => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) throw new Error('Invalid estimated distance');
        return num;
      })
      .optional(),
    estimatedTime: z.string().optional(),
    paymentMethod: z.enum(['momo', 'cash']),
    price: z
      .union([z.number(), z.string()])
      .transform(val => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) throw new Error('Invalid price');
        return num;
      })
      .refine(val => val >= 0, 'Price must be non-negative'),
  }),
});

const updateBookingStatusZodSchema = z.object({
  body: z.object({
    status: z.enum(['accepted', 'in_progress', 'completed', 'cancelled']),
  }),
});

const getBookingsQueryZodSchema = z.object({
  query: z
    .object({
      status: z.string().optional(),
      page: z
        .string()
        .optional()
        .transform(val => (val ? parseInt(val) : 1)),
      limit: z
        .string()
        .optional()
        .transform(val => (val ? parseInt(val) : 10)),
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
        .transform(val => (val ? parseFloat(val) : undefined)),
    })
    .optional()
    .default({
      status: undefined,
      page: 1,
      limit: 10,
      latitude: undefined,
      longitude: undefined,
      radius: undefined,
    }),
});

const processPaymentZodSchema = z.object({
  body: z.object({
    paymentMethod: z
      .enum(['momo', 'cash'])
      .refine(val => val === 'momo' || val === 'cash', {
        message: 'Payment method must be either momo or cash',
      }),
  }),
});

export const bookingValidations = {
  createBookingZodSchema,
  updateBookingStatusZodSchema,
  getBookingsQueryZodSchema,
  processPaymentZodSchema,
};
