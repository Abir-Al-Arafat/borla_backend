import cron from 'node-cron';
import prisma from 'app/shared/prisma';
import { paymentServices } from '../../modules/payments/payment.service';

// Schedule to run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running Cron: Checking for stuck pending transactions...');

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  // Find transactions still pending after 10 minutes
  const pendingTransactions = await prisma.transaction.findMany({
    where: {
      status: 'pending',
      createdAt: { lte: tenMinutesAgo },
      type: 'RIDE_PAYMENT',
    },
    take: 10, // Process in small batches
  });

  for (const tx of pendingTransactions) {
    try {
      console.log(`Syncing status for: ${tx.clientReference}`);
      await paymentServices.syncTransactionStatus(tx.clientReference);
    } catch (error) {
      console.error(`Cron failed for ${tx.clientReference}:`, error);
    }
  }
});
