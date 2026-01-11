import config from '@app/config';
import HashPassword from '@app/shared/hashPassword';
import prisma from '@app/shared/prisma';

export async function defaultTask() {
  // Add your default task here
  const email = config?.admin_credentials?.email || 'admin@gmail.com';
  // check admin is exist

  const admin = await prisma.user.findFirst({
    where: {
      role: 'admin',
    },
  });
  if (!admin) {
    await prisma.user.upsert({
      where: { email },
      update: {
        role: 'admin',
      },
      create: {
        name: 'MD Admin',
        email,
        phoneNumber: '+8801321834780',
        password: await HashPassword('112233'),
        role: 'admin',
        expireAt: null,
        verification: {
          create: {
            otp: 0,
            status: true,
          },
        },
      },
    });
  }

  const content = await prisma?.contents.findFirst({});
  if (!content) {
    await prisma.contents.create({
      data: {
        termsAndCondition: 'This is Terms and condition page',
        privacyPolicy: 'This is privacy policy page',
      },
    });
  }
}
