import prisma from 'app/shared/prisma';
import AppError from 'app/error/AppError';
import httpStatus from 'http-status';
import axios from 'axios';
import config from 'app/config';

const initiateRiderTopUp = async (userId: string, amount: number) => {
  console.log('Initiating top-up with userId:', userId, 'amount:', amount);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');

  const auth = Buffer.from(
    `${config.HUBTEL_API_ID}:${config.HUBTEL_API_KEY}`,
  ).toString('base64');

  // BK-TOP (6) + userId suffix (8) + timestamp (13) = 27 chars (Safe < 36)
  const clientReference = `BK-TOP-${userId.slice(-8)}-${Date.now()}`;

  const payload = {
    totalAmount: amount,
    description: `Borla Wallet Top-up: ${user.name}`,
    callbackUrl: `${config.server_url}/api/v1/wallets/receive-callback`,
    returnUrl: `${config.server_url}/wallet/success`,
    cancellationUrl: `${config.server_url}/wallet/failed`,
    merchantAccountNumber: config.HUBTEL_POS_ID,
    clientReference: clientReference,
  };

  try {
    const response = await axios.post(
      'https://payproxyapi.hubtel.com/items/initiate',
      payload,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    console.log('response:', response);
    console.log('response.data:', response.data);
    // Track the top-up intent in the transactions table
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount,
        type: 'TOPUP',
        status: 'pending',
        clientReference,
        reference: clientReference,
      },
    });
    console.log('Top-up transaction created in DB:', transaction);
    // Return the hosted checkout URL to the frontend
    return response.data.data.checkoutUrl;
  } catch (error: any) {
    console.error('Hubtel Top-up Error:', error);
    console.error('error.response?.data:', error.response?.data);
    console.error('error.message:', error.message);
    if (error.response) {
      console.error(
        'Hubtel Top-up Error:',
        JSON.stringify(error.response.data, null, 2),
      );
      throw new AppError(
        error.response.status,
        'Hubtel failed to initiate top-up',
      );
    }
    throw error;
  }
};

/*
    get or create wallet for user
*/
const getWallet = async (userId: string) => {
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
    // select: { balance: true },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        userId,
        balance: 0.0,
      },
    });
  }
  console.log(wallet);
  return wallet;
};

const requestRiderWithdrawal = async (
  userId: string,
  amount: number,
  channel: string,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });
  if (!user || user.role !== 'rider')
    throw new AppError(httpStatus.FORBIDDEN, 'Only riders can withdraw');
  if (!user.wallet) {
    throw new AppError(httpStatus.NOT_FOUND, 'Wallet not found for this rider');
  }
  // Commission Check: UI requires $20 (approx GH₵ 300) minimum float
  const minFloat = 300;
  const currentBalance = Number(user.wallet.balance);
  if (currentBalance - amount < minFloat) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `You must maintain a minimum float of GH₵ ${minFloat}`,
    );
  }

  const clientReference = `WDL-${Date.now()}`;
  const reference = `WDL-INIT-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const auth = Buffer.from(
    `${config.HUBTEL_CLIENT_ID}:${config.HUBTEL_CLIENT_SECRET}`,
  ).toString('base64');

  const payload = {
    RecipientName: user.name,
    RecipientMsisdn: user.phoneNumber,
    Channel: channel,
    Amount: amount,
    PrimaryCallbackURL: `${config.server_url}/api/v1/payments/send-callback`,
    Description: `Rider Withdrawal: ${user.name}`,
    ClientReference: clientReference,
  };

  const url = `https://smp.hubtel.com/api/merchants/${config.HUBTEL_PREPAID_ID}/send/mobilemoney`; //
  const response = await axios.post(url, payload, {
    headers: { Authorization: `Basic ${auth}` },
  });

  // Log the pending withdrawal
  await prisma.transaction.create({
    data: {
      userId,
      amount,
      type: 'WITHDRAWAL',
      clientReference,
      reference,
      status: 'pending',
    },
  });

  return response.data; // ResponseCode 0001 means "Accepted for Processing" [cite: 917]
};

export const walletServices = {
  initiateRiderTopUp,
  requestRiderWithdrawal,
  getWallet,
};
