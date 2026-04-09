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
    const { ResponseCode, Data, Message } = req.body;
    const clientReference = Data?.ClientReference;
    // 0000 = Success
    if (ResponseCode === '0000') {
      if (!clientReference) {
        console.error(
          'Callback received success but no ClientReference found in Data',
        );
        return res.sendStatus(200);
      }
      const transaction = await prisma.transaction.findUnique({
        where: { clientReference: clientReference },
        include: { booking: true },
      });

      console.log('Matching transaction found in DB:', transaction);
      if (!transaction) {
        console.error(
          `No transaction found for ClientReference: ${clientReference}`,
        );
        res.sendStatus(200); // Still return 200 to Hubtel to prevent retries
        return;
      }
      // 2. Prevent double-processing
      if (transaction && transaction.status === 'pending') {
        const totalAmount = Number(transaction.amount);
        const riderShare = totalAmount * 0.8; // Borla Split: 80% to Rider

        // 3. Atomically update all records
        const [updatedTransaction, updatedWallet, updatedBooking] =
          await prisma.$transaction([
            // Update Transaction status and store Hubtel's reference
            prisma.transaction.update({
              where: { clientReference: clientReference },
              data: {
                status: 'success',
                hubtelId: Data.SalesInvoiceId || Data.CheckoutId,
                salesInvoiceId: Data.SalesInvoiceId,
                checkoutId: Data.CheckoutId,
                commission: totalAmount - riderShare,
                comissionPercentage: 20, // 20% commission for Borla
                riderEarnings: riderShare,
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
          `updatedTransaction: ${JSON.stringify(updatedTransaction, null, 2)}, updatedWallet: ${JSON.stringify(updatedWallet, null, 2)}, updatedBooking: ${JSON.stringify(updatedBooking, null, 2)}`,
        );
      }
    } else {
      // 4. Handle Failed Payments (e.g., Wrong PIN, Insufficient Funds)
      console.warn(`Payment failed for ${clientReference}: ${Message}`);
      if (clientReference) {
        await prisma.transaction.update({
          where: { clientReference: clientReference },
          data: { status: 'failed' },
        });
      }
    }

    // 5. Mandatory: Always return 200 OK to Hubtel
    res.sendStatus(200);
  },
);

const initiateRefund = catchAsync(async (req: Request, res: Response) => {
  const { orderId, reason } = req.body;
  const result = await paymentServices.processRefund(orderId, reason);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Refund session initiated successfully.',
    data: result,
  });
});

// payment.controller.ts

const handleRefundCallback = catchAsync(async (req: Request, res: Response) => {
  console.log('Received Refund Callback:', JSON.stringify(req.body, null, 2));
  console.log('Received Refund Callback:', req.body);

  const { responseCode, data, message } = req.body;
  console.log('Extracted responseCode:', responseCode);
  console.log('Extracted data:', data);
  console.log('Extracted message:', message);
  // responseCode "0000" means the refund is complete
  if (responseCode === '0000' && data?.orderId) {
    const orderId = data.orderId;

    // Find the original transaction using the SalesInvoiceId (orderId)
    const transaction = await prisma.transaction.findFirst({
      where: { salesInvoiceId: orderId },
    });

    if (transaction) {
      const [updatedTransaction, updatedBooking] = await prisma.$transaction([
        // 1. Update Transaction status
        prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'refunded' },
        }),
        // 2. Update Booking payment status if applicable
        ...(transaction.bookingId
          ? [
              prisma.booking.update({
                where: { id: transaction.bookingId },
                data: { isRefunded: true, refundedAt: new Date() },
              }),
            ]
          : []),
      ]);

      console.log(`Successfully processed refund for Order: ${orderId}`);

      console.log(
        `updatedTransaction: ${JSON.stringify(updatedTransaction, null, 2)}, updatedBooking: ${JSON.stringify(updatedBooking, null, 2)}`,
      );
    }
  } else {
    console.warn(
      `Refund callback returned non-success: ${responseCode} - ${message}`,
    );
  }

  // Mandatory: Always return 200 OK to Hubtel
  res.sendStatus(200);
});

export const paymentControllers = {
  initiatePayment,
  handleBookingCallback,
  initiateRefund,
  handleRefundCallback,
};
