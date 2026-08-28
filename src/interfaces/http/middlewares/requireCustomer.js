const { ForbiddenError } = require('../../../domain/errors');

function requireCustomer(req, res, next) {
  if (req.user?.role !== 'customer') {
    return next(new ForbiddenError('Customer access required.'));
  }
  next();
}

module.exports = requireCustomer;
