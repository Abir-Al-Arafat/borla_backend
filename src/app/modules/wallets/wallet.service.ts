import prisma from 'app/shared/prisma';
import AppError from 'app/error/AppError';
import httpStatus from 'http-status';
import axios from 'axios';

const initiateTopUp = async (userId: string, amount: number) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  const response = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    {
      email: user?.email,
      amount: amount * 100,
      callback_url: 'https://standard.paystack.co/close',
      metadata: {
        type: 'TOP_UP', // Critical for webhook logic
        userId: userId,
      },
    },
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } },
  );

  return response.data.data;
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

const initiateWithdrawal = async (
  userId: string,
  amount: number,
  momoNumber: string,
  bankCode: string,
) => {
  try {
    // 1. Create Recipient
    const recipientResponse = await axios.post(
      'https://api.paystack.co/transferrecipient',
      {
        type: 'mobile_money',
        name: 'Rider Name',
        account_number: momoNumber,
        bank_code: bankCode,
        currency: 'GHS',
      },
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      },
    );

    const recipientCode = recipientResponse.data.data.recipient_code;

    // 2. Initiate Transfer
    const transferResponse = await axios.post(
      'https://api.paystack.co/transfer',
      {
        source: 'balance',
        amount: Math.round(amount * 100), // Ensure it's an integer
        recipient: recipientCode,
        reason: 'Borla Rider Earnings Withdrawal',
        // Optional: Add a unique reference to avoid duplicate errors
        reference: `withdraw_${Date.now()}_${userId}`,
      },
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      },
    );

    console.log('Transfer initiated successfully:', transferResponse.data.data);
    return transferResponse.data.data;
  } catch (error: any) {
    // Log the EXACT reason Paystack rejected the request
    if (error.response) {
      console.error('Paystack Transfer Error:', error.response.data);
    } else {
      console.error('General Withdrawal Error:', error.message);
    }
    throw error;
  }
};

export const walletServices = {
  initiateTopUp,
  initiateWithdrawal,
  getWallet,
};
