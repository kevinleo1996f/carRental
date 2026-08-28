const { ValidationError, ConflictError } = require('../../domain/errors');

class RegisterCustomer {
  constructor({ customerRepository, passwordHasher }) {
    this.customerRepository = customerRepository;
    this.passwordHasher = passwordHasher;
  }

  async execute({ fullName, email, password }) {
    if (!fullName || !email || !password) {
      throw new ValidationError('full_name, email, and password are all required.');
    }

    const existing = await this.customerRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('Email already registered.');
    }

    const passwordHash = await this.passwordHasher.hash(password);
    return this.customerRepository.create({ fullName, email, passwordHash });
  }
}

module.exports = RegisterCustomer;
