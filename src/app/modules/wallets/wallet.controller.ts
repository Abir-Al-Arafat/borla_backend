import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import { walletServices } from './wallet.service';

// 1. Initiate Top Up (Customer/Rider)
const initiateTopUp = catchAsync(async (req: Request, res: Response) => {
  const { amount } = req.body; // From your 'Top Up' screen
  const result = await walletServices.initiateTopUp(req.user.userId, amount);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Top up initialization successful',
    data: result, // Contains the authorization_url for your Flutter WebView
  });
});

// 2. Initiate Withdrawal (Rider)
const initiateWithdrawal = catchAsync(async (req: Request, res: Response) => {
  const { amount, momoNumber, bankCode } = req.body; // From your 'Withdraw' screen
  console.log('Initiating withdrawal controller.');
  // Note: This requires your Paystack account to be 'Registered'
  const result = await walletServices.initiateWithdrawal(
    req.user.userId,
    amount,
    momoNumber,
    bankCode,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Withdrawal request processed',
    data: result,
  });
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
  initiateTopUp,
  initiateWithdrawal,
  getWallet,
};
