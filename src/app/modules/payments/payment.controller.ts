import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import { paymentServices } from './payment.service';

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  console.log('req.body:', req.body);
  console.log('req.user.userId:', req.user.userId);
  const { bookingId } = req.body;
  const result = await paymentServices.initiatePayment(
    req.user.userId,
    bookingId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment link generated',
    data: result,
  });
});

const paystackWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers['x-paystack-signature'] as string;
  const isValid = paymentServices.verifyWebhook(req.body, signature);

  if (!isValid)
    return res.status(httpStatus.BAD_REQUEST).send('Invalid Signature');

  await paymentServices.handleWebhook(req.body);
  res.status(httpStatus.OK).send('Webhook Received');
});

export const paymentControllers = {
  initiatePayment,
  paystackWebhook,
};
