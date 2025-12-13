import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  status?: number;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);
  const error = err instanceof Error ? err : new Error('Unknown error')
  res.status(500).json({
    success: false,
    message: error.message || 'Internal server error',
  });
};