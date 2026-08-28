const { ValidationError, UnauthorizedError } = require('../../domain/errors');

class LoginCustomer {
  constructor({ customerRepository, passwordHasher, tokenService, adminConfig }) {
    this.customerRepository = customerRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
    this.adminConfig = adminConfig;
  }

  async execute({ email, password }) {
    if (!email || !password) {
      throw new ValidationError('email and password are both required.');
    }

    // Admin has no database row at all — checked against .env directly.
    if (this.adminConfig.email && email === this.adminConfig.email) {
      if (password !== this.adminConfig.password) {
        throw new UnauthorizedError('Invalid email or password.');
      }
      return { token: this.tokenService.sign({ role: 'admin' }), role: 'admin' };
    }

    const customer = await this.customerRepository.findByEmail(email);
    // Same error for "no such customer" and "wrong password" so the
    // response never reveals which part was wrong.
    if (!customer) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const passwordMatches = await this.passwordHasher.compare(password, customer.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    return {
      token: this.tokenService.sign({ customerId: customer.id, role: 'customer' }),
      role: 'customer',
    };
  }
}

module.exports = LoginCustomer;
