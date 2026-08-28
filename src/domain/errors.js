class DomainError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

class ValidationError extends DomainError {
  constructor(message) {
    super(message, 400);
  }
}

class UnauthorizedError extends DomainError {
  constructor(message) {
    super(message, 401);
  }
}

class ForbiddenError extends DomainError {
  constructor(message) {
    super(message, 403);
  }
}

class NotFoundError extends DomainError {
  constructor(message) {
    super(message, 404);
  }
}

class ConflictError extends DomainError {
  constructor(message) {
    super(message, 409);
  }
}

module.exports = {
  DomainError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
