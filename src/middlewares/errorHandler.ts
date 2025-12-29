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
  
  // Ensure CORS headers are set even on error responses
  // const origin = req.headers.origin;
  // if (origin) {
  //   res.setHeader('Access-Control-Allow-Origin', origin);
  //   res.setHeader('Access-Control-Allow-Credentials', 'true');
  // } else {
  //   res.setHeader('Access-Control-Allow-Origin', '*');
  // }
  // res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  // res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, X-Requested-With');
  
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: error.message || 'Internal server error',
  });
};