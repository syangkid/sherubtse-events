function httpError(status, message, field) {
  const err = new Error(message);
  err.status = status;
  if (field) err.field = field;
  return err;
}

module.exports = httpError;