import axios from 'axios';
import prisma from 'app/shared/prisma';
import AppError from 'app/error/AppError';
import httpStatus from 'http-status';
import crypto from 'crypto';
import config from 'app/config';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

const authToken = `Bearer ${PAYSTACK_SECRET.trim()}`;

const normalizeLegacyBookingPaymentMethods = async () => {
  await prisma.$runCommandRaw({
    update: 'bookings',
    updates: [
      {
        q: { paymentMethod: 'momo' },
        u: { $set: { paymentMethod: 'hubtel' } },
        multi: true,
      },
    ],
  });
};

// Initiate payment when Rider arrives at pickup
const initiateBookingPayment = async (
  // userId : string,
  bookingId: string,
) => {
  console.log('Initiating payment for bookingId:', bookingId);

  // Backward compatibility: old bookings may still store paymentMethod as "momo".
  // Prisma now expects "hubtel", so normalize legacy records before reading.
  await normalizeLegacyBookingPaymentMethods();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: true, rider: true },
  });

  if (!booking) throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');

  // Ensure only the assigned rider can trigger the payment
  // if (booking.userId !== userId) {
  //   throw new AppError(
  //     httpStatus.FORBIDDEN,
  //     'You are not assigned to this booking',
  //   );
  // }

  // Ensure payment is only requested after arrival at pickup
  if (booking.status !== 'arrived_pickup') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Rider must arrive at pickup before requesting payment',
    );
  }

  // PayProxy Authentication (Basic Auth)
  // const auth = Buffer.from(
  //   `${config.HUBTEL_CLIENT_ID}:${config.HUBTEL_CLIENT_SECRET}`,
  // ).toString('base64');
  const auth = Buffer.from(
    `${config.HUBTEL_API_ID}:${config.HUBTEL_API_KEY}`,
  ).toString('base64');

  // Payload structure based on Page 4 of your PDF
  const payload = {
    totalAmount: Number(booking.price) < 10 ? Number(booking.price) : 10, // Hubtel may have a minimum amount requirement; adjust as needed
    description: `Borla Service: ${booking.wasteCategory} collection`,
    callbackUrl: `${config.server_url}/api/v1/payments/booking-callback`,
    // returnUrl: `${config.CLIENT_URL}/booking/success`,
    returnUrl: `${config.server_url}/booking/success`,
    // cancellationUrl: `${config.CLIENT_URL}/booking/failed`,
    cancellationUrl: `${config.server_url}/booking/failed`,
    merchantAccountNumber: config.HUBTEL_POS_ID,
    // clientReference: `BK-${bookingId}`,
    clientReference: `BK-${Date.now()}`,
  };
  console.log('Initiating payment with payload:', payload);

  try {
    const response = await axios.post(
      'https://payproxyapi.hubtel.com/items/initiate',
      payload,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    // const response = await axios.post(
    //   'https://webhook.site/036f6f0d-cb17-486d-967f-9eb3de264390',
    //   payload,
    //   { headers: { Authorization: `Basic ${auth}` } },
    // );
    console.log('response', response);
    // Track the transaction in Prisma
    const pendingReference = `RIDE-PAY-INIT-${booking.id}-${Date.now()}`;
    await prisma.transaction.create({
      data: {
        userId: booking.userId,
        riderId: booking.riderId,
        amount: booking.price!,
        type: 'RIDE_PAYMENT',
        clientReference: payload.clientReference,
        bookingId: booking.id,
        reference: pendingReference,
        status: 'pending',
      },
    });

    // The PayProxy API returns a checkoutUrl in the response data
    return response.data.data.checkoutUrl;
  } catch (error: any) {
    console.error('Error initiating payment:');
    console.error('error:', error);
    console.error(
      'error.response?.data || error.message:',
      error.response?.data || error.message,
    );
    if (error.response && error.response.data) {
      // This looks for the specific validation messages Hubtel sends
      const hubtelErrors = error.response.data.errors;
      const detailMessage = hubtelErrors
        ? Object.entries(hubtelErrors)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ')
        : error.response.data.title || 'Hubtel Validation Error';

      console.error(
        'Hubtel Validation Error:',
        JSON.stringify(hubtelErrors, null, 2),
      );

      // This will now send the "Client reference exceeds maximum length" to Postman
      throw new AppError(httpStatus.BAD_REQUEST, detailMessage);
    }

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'External Service Error',
    );
  }
};

// Admin Refund Logic (Full or Partial)
// payment.service.ts

/**
 * processRefund
 * Strictly follows the Hubtel Refund API
 * URL: https://refund-api.hubtel.com/refund/{Hubtel_POS_Sales_ID}/order/{orderId}
 */
const processRefund = async (
  orderId: string, // This is the SalesInvoiceId from your callback Data
  reason: string, // Description for the refund
) => {
  console.log(
    `Processing refund for Order ID: ${orderId} with reason: ${reason}`,
  );
  const auth = Buffer.from(
    `${config.HUBTEL_API_ID}:${config.HUBTEL_API_KEY}`,
  ).toString('base64');

  // Your Hubtel POS ID from config (e.g., 2038240)
  const posId = config.HUBTEL_POS_ID;

  // The endpoint path variable structure from your sample request
  const url = `https://refund-api.hubtel.com/refund/${posId}/order/${orderId}`;

  // Constructing payload based on your Sample Request snippets
  const payload = {
    callbackUrl: `${config.server_url}/api/v1/payments/refund-callback`, // Optional as per sample
    description: reason, // Explanation for the refund
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
    });
    console.log('Refund API response:', response);
    // Handle Hubtel Success Response Codes
    // 0000 = Success, 0001 = Pending
    return response.data;
  } catch (error: any) {
    let errorMessage = 'An unknown error occurred';
    let errorData = null;

    if (error.response) {
      console.error('Hubtel Refund API error:', error);
      console.error('Hubtel Refund API error.response:', error.response);
      console.error(
        'Hubtel Refund API error.response.data:',
        error.response.data,
      );

      errorData = error.response.data;

      // Check if Hubtel sent an HTML error (like the 403 Forbidden AWS block)
      if (typeof errorData === 'string' && errorData.includes('<html>')) {
        errorMessage = `Infrastructure Block (403 Forbidden): Your Server IP is likely not whitelisted on Hubtel's Firewall.`;
      }
      // Check if Hubtel sent a JSON validation error
      else if (errorData && typeof errorData === 'object') {
        errorMessage =
          errorData.message ||
          JSON.stringify(errorData.errors) ||
          'Hubtel API rejected the request';
      }

      // Hubtel Refund API specific error handling
      const hubtelData = error.response.data;

      // Error 3000 = Order not found, 4000 = Amount < 1 cedi, etc.
      // const errorMessage = hubtelData.errors
      //   ? JSON.stringify(hubtelData.errors)
      //   : hubtelData.message || 'Refund API rejected the request';

      console.error(
        `Hubtel Refund API Error [${error.response.status}]:`,
        errorMessage,
      );

      throw new AppError(
        error.response.status,
        `Refund Failed: ${errorMessage}`,
      );
    } else {
      errorMessage = error.message;
    }

    // --- CONSOLE LOG FOR HUBTEL DEVELOPERS ---
    console.log('\n--- DEBUG INFO FOR HUBTEL SUPPORT ---');
    console.log(`URL: ${url}`);
    console.log(`Status: ${error.response?.status}`);
    console.log(
      `Response Data: ${typeof errorData === 'object' ? JSON.stringify(errorData) : errorData}`,
    );
    console.log(`Headers: ${JSON.stringify(error.config?.headers)}`);
    console.log('-------------------------------------\n');

    // --- RESPONSE FOR POSTMAN ---
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, errorMessage);
  }
};

export const paymentServices = {
  initiateBookingPayment,
  processRefund,
};
