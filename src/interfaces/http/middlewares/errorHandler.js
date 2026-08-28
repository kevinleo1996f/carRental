const { DomainError } = require('../../../domain/errors');

function errorHandler(err, req, res, next) {
  if (err instanceof DomainError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // express.json() throws this before any route/use-case code runs -- it's
  // the caller sending broken JSON, not a server failure, so it's a 400.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must be valid JSON.' });
  }

  console.error(err);
  return res.status(500).json({ message: 'Something went wrong.' });
}

module.exports = errorHandler;
