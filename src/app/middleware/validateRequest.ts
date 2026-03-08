import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';
import catchAsync from '../utils/catchAsync';

const validateRequest = (schema: AnyZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Use passthrough to allow extra keys (params, query) that aren't in all schemas
    const parsedData = await schema.passthrough().parseAsync({
      body: req.body,
      files: req.files,
      file: req.file,
      cookies: req.cookies,
      params: req.params,
      query: req.query,
    });

    // Apply transformed values back to request
    // Note: req.query is read-only in Express 5, so we can't reassign it
    req.body = parsedData.body;

    next();
  });
};

export default validateRequest;
