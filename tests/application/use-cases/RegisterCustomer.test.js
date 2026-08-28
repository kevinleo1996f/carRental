const RegisterCustomer = require('../../../src/application/use-cases/RegisterCustomer');

function makeFakeRepository(existingCustomers = []) {
  const customers = [...existingCustomers];
  return {
    async findByEmail(email) {
      return customers.find((c) => c.email === email) || null;
    },
    async create({ fullName, email, passwordHash }) {
      const customer = { id: customers.length + 1, fullName, email, passwordHash };
      customers.push(customer);
      return customer;
    },
  };
}

const fakePasswordHasher = {
  async hash(password) {
    return `hashed:${password}`;
  },
};

describe('RegisterCustomer', () => {
  it('creates a customer with a hashed password', async () => {
    const customerRepository = makeFakeRepository();
    const useCase = new RegisterCustomer({ customerRepository, passwordHasher: fakePasswordHasher });

    const customer = await useCase.execute({
      fullName: 'Kevin Leo',
      email: 'kevin@example.com',
      password: 'hunter22',
    });

    expect(customer.email).toBe('kevin@example.com');
    expect(customer.passwordHash).toBe('hashed:hunter22');
  });

  it('rejects a duplicate email', async () => {
    const customerRepository = makeFakeRepository([
      { id: 1, email: 'kevin@example.com', fullName: 'Kevin', passwordHash: 'x' },
    ]);
    const useCase = new RegisterCustomer({ customerRepository, passwordHasher: fakePasswordHasher });

    await expect(useCase.execute({
      fullName: 'Someone Else',
      email: 'kevin@example.com',
      password: 'hunter22',
    })).rejects.toThrow('Email already registered.');
  });

  it('rejects missing fields', async () => {
    const useCase = new RegisterCustomer({
      customerRepository: makeFakeRepository(),
      passwordHasher: fakePasswordHasher,
    });

    await expect(useCase.execute({ email: 'kevin@example.com', password: 'hunter22' }))
      .rejects.toThrow('full_name, email, and password are all required.');
  });
});
