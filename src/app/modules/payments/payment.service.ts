import axios from 'axios';
import prisma from 'app/shared/prisma';
import AppError from 'app/error/AppError';
import httpStatus from 'http-status';
import crypto from 'crypto';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

const authToken = `Bearer ${PAYSTACK_SECRET.trim()}`;

const initiatePayment = async (userId: string, bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: true },
  });

  if (!booking) throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  if (booking.status !== 'awaiting_payment') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Booking is not ready for payment',
    );
  }

  const response = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    {
      email: booking.user.email,
      amount: Math.round(Number(booking.price) * 100), // Convert GHS to Pesewas
      currency: 'GHS',
      callback_url: 'https://standard.paystack.co/close',
      metadata: {
        bookingId: booking.id,
        userId: userId,
      },
    },
    { headers: { Authorization: authToken } },
  );

  return response.data.data; // Contains authorization_url and access_code
};

const verifyWebhook = (payload: any, signature: string) => {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  return hash === signature;
};

const handleWebhook = async (payload: any) => {
  console.log('handleWebhook', { payload });
  if (payload.event === 'charge.success') {
    const { bookingId } = payload.data.metadata;

    if (!bookingId) {
      console.error('Webhook received but no bookingId found in metadata');
      return;
    }

    // Update Booking Status in Prisma
    return await prisma.booking.update({
      where: { id: bookingId },
      data: {
        isPaid: true,
        paidAt: new Date(),
        status: 'completed',
        completedAt: new Date(),
        paymentMethod: 'momo',
      },
    });
  }
};

export const paymentServices = {
  initiatePayment,
  verifyWebhook,
  handleWebhook,
};
