const RegisterCustomer = require('../../../application/use-cases/RegisterCustomer');
const LoginCustomer = require('../../../application/use-cases/LoginCustomer');
const PostgresCustomerRepository = require('../../../infrastructure/db/repositories/PostgresCustomerRepository');
const passwordHasher = require('../../../infrastructure/auth/passwordHasher');
const tokenService = require('../../../infrastructure/auth/tokenService');
const config = require('../../../config/env');

const customerRepository = new PostgresCustomerRepository();
const registerCustomer = new RegisterCustomer({ customerRepository, passwordHasher });
const loginCustomer = new LoginCustomer({
  customerRepository,
  passwordHasher,
  tokenService,
  adminConfig: config.admin,
});

async function register(req, res, next) {
  try {
    const { full_name: fullName, email, password } = req.body;
    const customer = await registerCustomer.execute({ fullName, email, password });
    res.status(201).json({
      id: customer.id,
      full_name: customer.fullName,
      email: customer.email,
      created_at: customer.createdAt,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await loginCustomer.execute({ email, password });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

function me(req, res) {
  res.status(200).json(req.user);
}

module.exports = { register, login, me };
