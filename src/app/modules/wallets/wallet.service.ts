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
        amount: Number(amount),
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
  console.log(
    'Requesting withdrawal with userId:',
    userId,
    'amount:',
    amount,
    'channel:',
    channel,
  );
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
    PrimaryCallbackURL: `${config.server_url}/api/v1/wallets/send-callback`,
    Description: `Rider Withdrawal: ${user.name}`,
    ClientReference: clientReference,
  };

  const url = `https://smp.hubtel.com/api/merchants/${config.HUBTEL_PREPAID_ID}/send/mobilemoney`; //
  const response = await axios.post(url, payload, {
    headers: { Authorization: `Basic ${auth}` },
  });
  // const url = `https://webhook.site/a1779570-ea58-4b91-8d08-8b922f0f75ab`; //
  // const response = await axios.post(url, payload, {
  //   headers: { Authorization: `Basic ${auth}` },
  // });

  console.log('Withdrawal response:', response);
  console.log('Withdrawal response.data:', response.data);

  // Log the pending withdrawal
  const transaction = await prisma.transaction.create({
    data: {
      userId,
      amount: Number(amount),
      type: 'WITHDRAWAL',
      clientReference,
      reference,
      status: 'pending',
    },
  });

  console.log('Withdrawal transaction created in DB:', transaction);

  return response.data; // ResponseCode 0001 means "Accepted for Processing" [cite: 917]
};

/**
 * assignBonusToRider
 * Strictly follows Hubtel Direct Send Money API
 * URL: https://smp.hubtel.com/api/merchants/{MerchantID}/send/mobilemoney
 */
const assignBonusToRider = async (
  riderId: string,
  amount: number,
  reason: string,
) => {
  console.log(
    'Assigning bonus with riderId:',
    riderId,
    'amount:',
    amount,
    'reason:',
    reason,
  );
  const rider = await prisma.user.findUnique({
    where: { id: riderId },
    include: { wallet: true },
  });

  console.log('Rider found for bonus assignment:', rider);

  if (!rider || rider.role !== 'rider') {
    throw new AppError(httpStatus.NOT_FOUND, 'Rider not found');
  }

  const auth = Buffer.from(
    `${config.HUBTEL_CLIENT_ID}:${config.HUBTEL_CLIENT_SECRET}`,
  ).toString('base64');

  // Format phone to international 233 format without '+'
  const formattedPhone = rider.phoneNumber?.replace('+', '') || '';

  console.log('Formatted phone number for Hubtel:', formattedPhone);

  // ClientReference must be unique and max 36 chars
  const clientReference = `BNS-${riderId.slice(-8)}-${Date.now()}`.slice(0, 36);

  const payload = {
    RecipientName: rider.name,
    RecipientMsisdn: formattedPhone,
    CustomerEmail: rider.email,
    Channel: 'tigo-gh', // Defaulting to Tigo-GH or make dynamic based on rider data
    Amount: amount,
    PrimaryCallbackURL: `${config.server_url}/api/v1/wallets/bonus-callback`,
    Description: `Bonus: ${reason}`,
    ClientReference: clientReference,
  };

  // Endpoint uses the MerchantID (Prepaid ID)
  const url = `https://smp.hubtel.com/api/merchants/${config.HUBTEL_PREPAID_ID}/send/mobilemoney`;

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
    });

    console.log('Bonus assignment response:', response);
    console.log('Bonus assignment response.data:', response.data);

    // Track the bonus in your database
    const transaction = await prisma.transaction.create({
      data: {
        userId: riderId,
        amount,
        type: 'BONUS',
        status: 'pending',
        clientReference,
        reference: clientReference,
        description: reason,
      },
    });

    console.log('Bonus transaction created in DB:', transaction);

    return response.data;
  } catch (error: any) {
    if (error.response) {
      // Check for 4075: Insufficient prepaid balance
      const errorMessage =
        error.response.data.message || 'Bonus initiation failed';
      console.error(
        'Hubtel Bonus Error:',
        JSON.stringify(error.response.data, null, 2),
      );
      throw new AppError(
        error.response.status,
        `Bonus Failed: ${errorMessage}`,
      );
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Hubtel SMP Service Unreachable',
    );
  }
};

export const walletServices = {
  initiateRiderTopUp,
  requestRiderWithdrawal,
  getWallet,
  assignBonusToRider,
};
