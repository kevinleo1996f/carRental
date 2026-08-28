const { DomainError } = require('../../../domain/errors');

function errorHandler(err, req, res, next) {
  if (err instanceof DomainError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  console.error(err);
  return res.status(500).json({ message: 'Something went wrong.' });
}

module.exports = errorHandler;
