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

const headingToStationZodSchema = z.object({
  body: z.object({
    stationId: z.string().nonempty('Station ID is required'),
  }),
});

const getBookingsQueryZodSchema = z.object({
  query: z.preprocess(
    val => {
      // Ensure we always have an object with default values
      const query = typeof val === 'object' && val !== null ? val : {};
      return {
        status: (query as any).status || 'pending',
        page: (query as any).page || '1',
        limit: (query as any).limit || '10',
        latitude: (query as any).latitude || undefined,
        longitude: (query as any).longitude || undefined,
        radius: (query as any).radius || '10',
      };
    },
    z.object({
      status: z
        .string()
        .transform(val => {
          if (!val || val.trim() === '') return 'pending';
          return val.trim();
        })
        .refine(
          val =>
            [
              'pending',
              'accepted',
              'arrived_pickup',
              'in_progress',
              'arrived_dropoff',
              'awaiting_payment',
              'completed',
              'cancelled',
            ].includes(val),
          {
            message:
              'Status must be one of: pending, accepted, arrived_pickup, in_progress, arrived_dropoff, awaiting_payment, completed, cancelled',
          },
        ),
      page: z.string().transform(val => {
        if (!val || val.trim() === '') return 1;
        const parsed = parseInt(val, 10);
        return isNaN(parsed) || parsed < 1 ? 1 : parsed;
      }),
      limit: z.string().transform(val => {
        if (!val || val.trim() === '') return 10;
        const parsed = parseInt(val, 10);
        return isNaN(parsed) || parsed < 1 ? 10 : Math.min(parsed, 100);
      }),
      latitude: z
        .string()
        .optional()
        .transform(val => {
          if (!val || val.trim() === '') return undefined;
          const parsed = parseFloat(val);
          return isNaN(parsed) ? undefined : parsed;
        }),
      longitude: z
        .string()
        .optional()
        .transform(val => {
          if (!val || val.trim() === '') return undefined;
          const parsed = parseFloat(val);
          return isNaN(parsed) ? undefined : parsed;
        }),
      radius: z.string().transform(val => {
        if (!val || val.trim() === '') return 10;
        const parsed = parseFloat(val);
        return isNaN(parsed) || parsed < 1 ? 10 : parsed;
      }),
    }),
  ),
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
  headingToStationZodSchema,
};
