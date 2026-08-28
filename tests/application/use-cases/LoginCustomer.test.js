const LoginCustomer = require('../../../src/application/use-cases/LoginCustomer');

const existingCustomer = {
  id: 1,
  email: 'kevin@example.com',
  fullName: 'Kevin Leo',
  passwordHash: 'hashed:hunter22',
};

const fakeCustomerRepository = {
  async findByEmail(email) {
    return email === existingCustomer.email ? existingCustomer : null;
  },
};

const fakePasswordHasher = {
  async compare(password, passwordHash) {
    return `hashed:${password}` === passwordHash;
  },
};

const fakeTokenService = {
  sign(payload) {
    return `token:${JSON.stringify(payload)}`;
  },
};

const adminConfig = { email: 'admin@carrental.local', password: 'admin-secret' };

function makeUseCase() {
  return new LoginCustomer({
    customerRepository: fakeCustomerRepository,
    passwordHasher: fakePasswordHasher,
    tokenService: fakeTokenService,
    adminConfig,
  });
}

describe('LoginCustomer', () => {
  it('logs a customer in with the correct password', async () => {
    const result = await makeUseCase().execute({ email: 'kevin@example.com', password: 'hunter22' });
    expect(result.role).toBe('customer');
    expect(result.token).toContain('"customerId":1');
  });

  it('rejects a wrong password with a generic message', async () => {
    await expect(makeUseCase().execute({ email: 'kevin@example.com', password: 'wrong' }))
      .rejects.toThrow('Invalid email or password.');
  });

  it('rejects an email that does not exist, with the same generic message', async () => {
    await expect(makeUseCase().execute({ email: 'nobody@example.com', password: 'whatever' }))
      .rejects.toThrow('Invalid email or password.');
  });

  it('logs the admin in from env config, without touching the customer repository', async () => {
    const result = await makeUseCase().execute({ email: adminConfig.email, password: adminConfig.password });
    expect(result.role).toBe('admin');
  });

  it('rejects the admin email with the wrong password', async () => {
    await expect(makeUseCase().execute({ email: adminConfig.email, password: 'nope' }))
      .rejects.toThrow('Invalid email or password.');
  });
});
