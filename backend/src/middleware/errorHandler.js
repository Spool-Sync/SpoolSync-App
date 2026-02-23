import logger from './logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, _next) {
  logger.error(err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message, errors: err.errors });
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'A record with that value already exists.' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Record not found.' });
    }
  }

  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
