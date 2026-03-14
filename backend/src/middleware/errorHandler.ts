import type { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  details?: unknown;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      details: err.details || undefined,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    },
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
