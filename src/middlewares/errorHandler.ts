import { Response, NextFunction } from 'express';

export interface AppError extends Error {
  status?: number;
}

export const errorHandler = (
  err: AppError,
  // req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(err);
  const error = err instanceof Error ? err : new Error('Unknown error')
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: error.message || 'Internal server error',
  });
};