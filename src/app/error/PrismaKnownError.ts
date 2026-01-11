import { TErrorSources, TGenericErrorResponse } from '../interface/error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlePrismaKnownError = (err: any): TGenericErrorResponse => {
  let message = 'Database error';

  switch (err.code) {
    case 'P2000':
      message = 'Input value is too long for this field';
      break;

    case 'P2003':
      message = 'Invalid reference (foreign key constraint failed)';
      break;

    default:
      message = 'Database request error';
  }

  const errorSources: TErrorSources = [
    {
      path: err?.meta?.field_name || '',
      message,
    },
  ];

  return {
    statusCode: 400,
    message,
    errorSources,
  };
};

export default handlePrismaKnownError;
