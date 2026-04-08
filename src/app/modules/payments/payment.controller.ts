import { Request, Response } from 'express';
import prisma from 'app/shared/prisma';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import { paymentServices } from './payment.service';

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  console.log('req.body:', req.body);
  console.log('req.user.userId:', req.user.userId);
  const { bookingId } = req.body;
  const result = await paymentServices.initiateBookingPayment(
    // req.user.userId,
    bookingId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment session initiated successfully.',
    data: result,
  });
});

const handleBookingCallback = catchAsync(
  async (req: Request, res: Response) => {
    console.log('Received payment callback with req.body:', req.body);
    // 1. Extract data from Hubtel's payload
    const { ResponseCode, ClientReference, Data, Message } = req.body;

    // 0000 = Success
    if (ResponseCode === '0000') {
      const transaction = await prisma.transaction.findUnique({
        where: { clientReference: ClientReference },
        include: { booking: true },
      });

      console.log('Matching transaction found in DB:', transaction);

      // 2. Prevent double-processing
      if (transaction && transaction.status === 'pending') {
        const totalAmount = Number(transaction.amount);
        const riderShare = totalAmount * 0.8; // Borla Split: 80% to Rider

        // 3. Atomically update all records
        const [updatedTransaction, updatedWallet, updatedBooking] =
          await prisma.$transaction([
            // Update Transaction status and store Hubtel's reference
            prisma.transaction.update({
              where: { clientReference: ClientReference },
              data: {
                status: 'success',
                hubtelId: Data.TransactionId || Data.OrderId,
              },
            }),
            // Credit the Rider's Virtual Wallet
            prisma.wallet.update({
              where: { userId: transaction.booking?.riderId! },
              data: { balance: { increment: riderShare } },
            }),
            // Mark the Booking as completed
            prisma.booking.update({
              where: { id: transaction.bookingId as string },
              data: {
                // status: 'completed',
                paymentMethod: 'hubtel',
                isPaid: true,
                paidAt: new Date(),
              },
            }),
          ]);
        console.log(
          `Transaction ${updatedTransaction.id} marked as success, Rider wallet credited with ${riderShare}, Booking ${updatedBooking.id} marked as paid.`,
        );
        console.log(
          `Successfully split payment for Booking ${transaction.bookingId}`,
        );

        console.log(
          `updatedTransaction: ${updatedTransaction}, updatedWallet: ${updatedWallet}, updatedBooking: ${updatedBooking}`,
        );
      }
    } else {
      // 4. Handle Failed Payments (e.g., Wrong PIN, Insufficient Funds)
      console.warn(`Payment failed for ${ClientReference}: ${Message}`);

      await prisma.transaction.update({
        where: { clientReference: ClientReference },
        data: { status: 'failed' },
      });
    }

    // 5. Mandatory: Always return 200 OK to Hubtel
    res.sendStatus(200);
  },
);

export const paymentControllers = {
  initiatePayment,
  handleBookingCallback,
};
