import { NextFunction, Request, Response } from 'express';
import { ZodObject } from 'zod';
import catchAsync from '../utils/catchAsync';

const validateRequest = (schema: ZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const parsedData = await schema.parseAsync({
      body: req.body,
      files: req.files,
      file: req.file,
      cookies: req.cookies,
    });

    // Apply transformed values back to request
    req.body = parsedData.body;

    next();
  });
};

export default validateRequest;
