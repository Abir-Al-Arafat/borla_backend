// error/PrismaDuplicateError.ts
import { Prisma } from '@prisma/client';
import { TErrorSources, TGenericErrorResponse } from '../interface/error';

const handleDuplicateError = (
  err: Prisma.PrismaClientKnownRequestError,
): TGenericErrorResponse => {
  // Prisma P2002 duplicate error
  const target = err?.meta?.target;

  let field = 'Field';

  if (Array.isArray(target)) {
    field = target.join(', ');
  } else if (typeof target === 'string') {
    field = target;
  }

  const errorSources: TErrorSources = [
    {
      path: field,
      message: `${field} already exists`,
    },
  ];

  return {
    statusCode: 400,
    message: 'Duplicate value error',
    errorSources,
  };
};

export default handleDuplicateError;
