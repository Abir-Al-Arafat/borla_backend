import { Request, Response } from 'express';
import prisma from 'app/shared/prisma';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import { walletServices } from './wallet.service';

// 1. Initiate Top Up (Customer/Rider)
const topUp = catchAsync(async (req: Request, res: Response) => {
  console.log('Initiating top-up with req.body:', req.body);
  const { amount, phoneNumber, channel } = req.body;
  const userId = req.user.userId;
  const checkoutUrl = await walletServices.initiateRiderTopUp(
    userId,
    amount,
    // req.user.phoneNumber,
    phoneNumber,
    channel,
  );
  console.log('Top-up initiated, checkoutUrl:', checkoutUrl);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Top-up initiated',
    data: { checkoutUrl },
  });
});

// 2. Initiate Withdrawal (Rider)
const withdraw = catchAsync(async (req: Request, res: Response) => {
  const { amount } = req.body;
  const userId = req.user.userId;
  const result = await walletServices.requestRiderWithdrawal(
    userId,
    amount,
    req.body.channel,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Withdrawal successful',
    data: result,
  });
});

const handleReceiveCallback = catchAsync(
  async (req: Request, res: Response) => {
    // Hubtel sends ResponseCode "0000" for a successful PIN entry [cite: 283, 477]
    const { ResponseCode, ClientReference, Data } = req.body;
    console.log('Received Hubtel callback req.body:', req.body);
    if (ResponseCode === '0000') {
      console.log(
        'Successful top-up callback received from Hubtel for ClientReference:',
        ClientReference,
      );
      const transaction = await prisma.transaction.findUnique({
        where: { clientReference: ClientReference },
      });
      console.log('Matching transaction found in DB:', transaction);
      // Only update if the transaction is still pending to avoid double-crediting
      if (transaction && transaction.status === 'pending') {
        console.log(
          'Updating transaction status to success and crediting wallet...',
        );
        const [updatedTransaction, updatedWallet] = await prisma.$transaction([
          prisma.transaction.update({
            where: { clientReference: ClientReference },
            data: { status: 'success', hubtelId: Data.TransactionId },
          }),
          prisma.wallet.update({
            where: { userId: transaction.userId },
            data: { balance: { increment: transaction.amount } },
          }),
        ]);
        console.log(
          `Wallet credited for Rider transaction.userId: ${transaction.userId}`,
        );

        console.log(`transaction.status: ${updatedTransaction.status}`);
        console.log(`transaction.hubtelId ${updatedTransaction.hubtelId}`);

        console.log(`updatedWallet.balance: ${updatedWallet.balance}`);
      }
    } else {
      // Log failed attempts (e.g., wrong PIN or insufficient funds) [cite: 483-492]
      console.log(
        'Failed top-up callback received from Hubtel for ClientReference:',
        ClientReference,
      );
      const transaction = await prisma.transaction.update({
        where: { clientReference: ClientReference },
        data: { status: 'failed' },
      });
      console.log(`transaction.status: ${transaction.status}`);
    }

    // Always send 200 OK back to Hubtel so they stop retrying [cite: 247, 420]
    res.sendStatus(200);
  },
);

const handleSendCallback = catchAsync(async (req: Request, res: Response) => {
  // Callback for Withdrawals (Direct Send Money) [cite: 786, 791]
  const { ResponseCode, ClientReference, Data } = req.body;
  console.log('Received Hubtel send callback req.body:', req.body);
  if (ResponseCode === '0000') {
    console.log(
      'Successful withdrawal callback received from Hubtel for ClientReference:',
      ClientReference,
    );
    const transaction = await prisma.transaction.update({
      where: { clientReference: ClientReference },
      data: { status: 'success', hubtelId: Data.TransactionId },
    });

    console.log(`transaction.status: ${transaction.status}`);
    console.log(`transaction.hubtelId ${transaction.hubtelId}`);
    // Note: We already deducted the balance when the rider clicked "Withdraw"
    // to prevent "double spending" while the transaction was processing.
  } else {
    console.log(
      'Failed withdrawal callback received from Hubtel for ClientReference:',
      ClientReference,
    );
    // If the withdrawal fails at the Hubtel/Network level, REFUND the rider's wallet
    const transaction = await prisma.transaction.findUnique({
      where: { clientReference: ClientReference },
    });
    console.log(
      'Matching transaction found in DB for failed withdrawal:',
      transaction,
    );
    if (transaction && transaction.status === 'pending') {
      const [updatedTransaction, updatedWallet] = await prisma.$transaction([
        prisma.transaction.update({
          where: { clientReference: ClientReference },
          data: { status: 'failed' },
        }),
        prisma.wallet.update({
          where: { userId: transaction.userId },
          data: { balance: { increment: transaction.amount } },
        }),
      ]);
      console.log(
        `Transaction status updatedTransaction.status: ${updatedTransaction.status}`,
      );
      console.log(
        `Wallet credited for Rider updatedWallet.balance: ${updatedWallet.balance}`,
      );
    }
  }
  res.sendStatus(200);
});

const getWallet = catchAsync(async (req: Request, res: Response) => {
  const wallet = await walletServices.getWallet(req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Wallet balance retrieved successfully',
    data: wallet,
  });
});

export const walletControllers = {
  topUp,
  withdraw,
  getWallet,
  handleReceiveCallback,
  handleSendCallback,
};
