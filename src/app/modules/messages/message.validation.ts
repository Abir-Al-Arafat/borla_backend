import { z } from 'zod';

const bookingIdSchema = z
  .string()
  .trim()
  .min(1, 'Please provide booking ID')
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID format');

const sendMessageZodSchema = z.object({
  params: z.object({
    bookingId: bookingIdSchema,
  }),
  body: z.object({
    text: z
      .string()
      .trim()
      .min(1, 'Message text cannot be empty')
      .max(2000, 'Message text cannot exceed 2000 characters')
      .optional(),
  }),
});

const getMessagesZodSchema = z.object({
  params: z.object({
    bookingId: bookingIdSchema,
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

const getChatsZodSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const messageValidations = {
  sendMessageZodSchema,
  getMessagesZodSchema,
  getChatsZodSchema,
};
