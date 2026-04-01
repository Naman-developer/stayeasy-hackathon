const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: error.message || "Server error.",
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  });
};

module.exports = {
  notFound,
  errorHandler,
};
