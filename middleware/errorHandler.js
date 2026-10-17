function notFound(req, res, next) {
  const err = new Error(`Not found: ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  const message =
    status === 500 && isProduction ? 'Internal server error' : err.message;

  if (status === 500) {
    console.error(err);
  }

  const wantsJson =
    req.originalUrl.startsWith('/api') ||
    (req.headers.accept || '').includes('application/json');

  if (wantsJson) {
    return res.status(status).json({ success: false, message });
  }

  const view = [403, 404].includes(status) ? `errors/${status}` : 'errors/500';
  res.status(status).render(view, {
    title: `Error ${status}`,
    message,
  });
}

module.exports = { notFound, errorHandler };