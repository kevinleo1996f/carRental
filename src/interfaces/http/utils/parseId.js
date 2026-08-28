const { ValidationError } = require('../../../domain/errors');

function parseId(rawId, fieldName = 'id') {
  const id = Number(rawId);
  if (!Number.isInteger(id)) {
    throw new ValidationError(`${fieldName} must be an integer.`);
  }
  return id;
}

module.exports = parseId;
