function notFound(req, res, next) {
  const err = new Error(`Not found: ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Hide internal details of server errors in production
  const message =
    status === 500 && isProduction ? 'Internal server error' : err.message;

  if (status === 500) {
    console.error(err);
  }

  // API requests get JSON
  const wantsJson =
    req.originalUrl.startsWith('/api') ||
    (req.headers.accept || '').includes('application/json');

  if (wantsJson) {
    return res.status(status).json({ success: false, message });
  }

  const view = [403, 404].includes(status) ? `errors/${status}` : 'errors/500';
  res.status(status).render(view, { title: `Error ${status}`, message }, (renderErr, html) => {
    if (renderErr) {
      console.error('Could not render error page:', renderErr.message);
      const plain = { 403: 'Access denied', 404: 'Page not found' }[status] || 'Something went wrong';
      return res.status(status).type('text/plain').send(`${status} - ${plain}`);
    }
    res.send(html);
  });
}

module.exports = { notFound, errorHandler };