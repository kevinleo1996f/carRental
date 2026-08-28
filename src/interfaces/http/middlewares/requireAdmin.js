const { ForbiddenError } = require('../../../domain/errors');

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ForbiddenError('Admin access required.'));
  }
  next();
}

module.exports = requireAdmin;
