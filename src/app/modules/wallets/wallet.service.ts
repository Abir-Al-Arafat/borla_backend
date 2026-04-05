import prisma from 'app/shared/prisma';
import AppError from 'app/error/AppError';
import httpStatus from 'http-status';
import axios from 'axios';
import config from 'app/config';

const RECEIVE_MONEY_URL = (posId: string) =>
  `https://rmp.hubtel.com/merchantaccount/merchants/${posId}/receive/mobilemoney`;

const initiateRiderTopUp = async (
  userId: string,
  amount: number,
  phone: string,
  channel: string,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.role !== 'rider')
    throw new AppError(httpStatus.FORBIDDEN, 'Only riders can top up');

  const clientReference = `TOP-${Date.now()}`;
  const reference = `TOPUP-INIT-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  const payload = {
    CustomerName: user.name || 'Borla User', // Optional [cite: 100]
    CustomerMsisdn: phone, // International format (e.g., 233...) [cite: 124]
    Channel: channel, // mtn-gh, vodafone-gh, or tigo-gh [cite: 131-133]
    Amount: amount, // Max 2 decimal places [cite: 138-140]
    PrimaryCallbackURL: `${config.server_url}/api/v1/payments/receive-callback`,
    Description: `Wallet Top-up: ${user.name || 'Borla User'}`,
    ClientReference: clientReference,
  };

  const auth = Buffer.from(
    `${config.HUBTEL_CLIENT_ID}:${config.HUBTEL_CLIENT_SECRET}`,
  ).toString('base64');

  const response = await axios.post(
    RECEIVE_MONEY_URL(config.HUBTEL_POS_ID as string),
    payload,
    {
      headers: { Authorization: `Basic ${auth}` },
    },
  );

  // Log "pending" transaction to Prisma
  await prisma.transaction.create({
    data: {
      userId,
      amount,
      type: 'TOPUP',
      clientReference,
      reference,
      status: 'pending',
    },
  });

  return response.data; // ResponseCode "0001" means pending customer approval [cite: 478, 480]
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
