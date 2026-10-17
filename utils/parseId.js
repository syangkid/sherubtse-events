const httpError = require('./httpError');

const MAX_INT4 = 2147483647;

function parseId(value, label = 'id') {
  const text = String(value);
  if (!/^\d+$/.test(text)) {
    throw httpError(400, `Invalid ${label}.`);
  }
  const number = Number(text);
  if (number < 1 || number > MAX_INT4) {
    throw httpError(400, `Invalid ${label}.`);
  }
  return number;
}

module.exports = parseId;