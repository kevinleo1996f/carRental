const tokenService = require('../../../infrastructure/auth/tokenService');
const { UnauthorizedError } = require('../../../domain/errors');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Missing or malformed Authorization header.'));
  }

  try {
    req.user = tokenService.verify(token);
    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid or expired token.'));
  }
}

module.exports = authMiddleware;
