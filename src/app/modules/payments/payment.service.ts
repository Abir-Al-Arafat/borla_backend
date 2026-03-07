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

// const handleWebhook = async (payload: any) => {
//   console.log('handleWebhook', { payload });
//   if (payload.event === 'charge.success') {
//     const { bookingId } = payload.data.metadata;

//     if (!bookingId) {
//       console.error('Webhook received but no bookingId found in metadata');
//       return;
//     }

//     // Update Booking Status in Prisma
//     return await prisma.booking.update({
//       where: { id: bookingId },
//       data: {
//         isPaid: true,
//         paidAt: new Date(),
//         status: 'completed',
//         completedAt: new Date(),
//         paymentMethod: 'momo',
//       },
//     });
//   }
// };

// const handleWebhook = async (payload: any) => {
//   const { event, data } = payload;
//   console.log('payload:', payload);
//   console.log('Received webhook event:', event, 'with data:', data);
//   // HANDLE PAYMENTS (Inbound)
//   if (event === 'charge.success') {
//     const { type, userId, bookingId } = data.metadata;

//     if (type === 'TOP_UP') {
//       // Increment Wallet Balance
//       return await prisma.wallet.update({
//         where: { userId },
//         data: { balance: { increment: data.amount / 100 } },
//       });
//     }

//     if (bookingId) {
//       // Update Booking Status in Prisma
//       return await prisma.booking.update({
//         where: { id: bookingId },
//         data: {
//           isPaid: true,
//           paidAt: new Date(),
//           status: 'completed',
//           completedAt: new Date(),
//           paymentMethod: 'momo',
//         },
//       });
//     }
//   }

//   // HANDLE WITHDRAWALS (Outbound)
//   if (event === 'transfer.success') {
//     // Confirm the withdrawal in your DB
//     console.log('Transfer was successful to recipient');
//   }

//   if (event === 'transfer.failed') {
//     // Refund the money back to the Rider's app wallet
//     console.log('Transfer failed, refunding user wallet...');
//   }

//   if (event === 'refund.processed') {
//     console.log('Refund processed, updating booking and wallet...');
//   }
// };

const handleWebhook = async (payload: any) => {
  const { event, data } = payload;
  const reference = data.reference || data.transfer_code;

  // 1. IDEMPOTENCY CHECK: Ensure we haven't processed this reference already
  const existingTransaction = await prisma.transaction.findUnique({
    where: { reference },
  });
  if (existingTransaction && existingTransaction.status === 'SUCCESS') {
    console.log(`Transaction ${reference} already processed.`);
    return;
  }

  console.log('event:', event, 'with data:', data);

  // HANDLE PAYMENTS (Inbound)
  if (event === 'charge.success') {
    const { type, userId, bookingId } = data.metadata;

    return await prisma.$transaction(async tx => {
      if (type === 'TOP_UP') {
        // Get or create wallet for the user
        let wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: { userId, balance: 0.0 },
          });
        }

        // Create transaction record linked to wallet
        await tx.transaction.create({
          data: {
            reference,
            userId,
            walletId: wallet.id,
            amount: data.amount / 100,
            type: 'TOP_UP',
            status: 'SUCCESS',
          },
        });

        // Update wallet balance
        return await tx.wallet.update({
          where: { userId },
          data: { balance: { increment: data.amount / 100 } },
        });
      }

      if (bookingId) {
        // Get booking with rider info
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { rider: true },
        });

        if (!booking || !booking.riderId) {
          throw new Error('Booking or rider not found');
        }

        // Get or create wallet for the rider
        let riderWallet = await tx.wallet.findUnique({
          where: { userId: booking.riderId },
        });
        if (!riderWallet) {
          riderWallet = await tx.wallet.create({
            data: { userId: booking.riderId, balance: 0.0 },
          });
        }

        // Create  transaction record for the booking payment
        await tx.transaction.create({
          data: {
            reference,
            userId: userId,
            riderId: booking.riderId,
            walletId: riderWallet.id,
            amount: data.amount / 100,
            type: 'RIDE_PAYMENT',
            status: 'SUCCESS',
          },
        });

        // Update rider's wallet balance
        await tx.wallet.update({
          where: { userId: booking.riderId },
          data: { balance: { increment: data.amount / 100 } },
        });

        // Update booking status
        return await tx.booking.update({
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
    });
  }

  // HANDLE WITHDRAWALS (Outbound)
  if (event === 'transfer.success') {
    const { userId } = data.metadata;
    // Update your internal withdrawal record to 'SUCCESS'
    return await prisma.transaction.update({
      where: { reference: data.transfer_code },
      data: { status: 'SUCCESS' },
    });
  }

  if (event === 'transfer.failed') {
    const { userId } = data.metadata;

    // Get the failed transaction to find the walletId
    const failedTransaction = await prisma.transaction.findUnique({
      where: { reference: data.transfer_code },
    });

    if (!failedTransaction || !failedTransaction.walletId) {
      console.error('Failed transaction or walletId not found');
      return;
    }

    // REFUND the user wallet because the outbound transfer failed
    return await prisma.$transaction([
      prisma.wallet.update({
        where: { id: failedTransaction.walletId },
        data: { balance: { increment: data.amount / 100 } },
      }),
      prisma.transaction.update({
        where: { reference: data.transfer_code },
        data: { status: 'FAILED' },
      }),
    ]);
  }
};

export const paymentServices = {
  initiatePayment,
  verifyWebhook,
  handleWebhook,
};
