const PostgresCarRepository = require('../../src/infrastructure/db/repositories/PostgresCarRepository');
const PostgresCustomerRepository = require('../../src/infrastructure/db/repositories/PostgresCustomerRepository');
const { resetDb, pool } = require('./helpers/db');

const carRepository = new PostgresCarRepository();
const customerRepository = new PostgresCustomerRepository();

const sampleCar = {
  brand: 'kia', model: 'seltos fwd', fuelType: 'gas', transmission: 'automatic', year: 2021, drive: 'fwd',
};

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('PostgresCarRepository.create (only called by the seed script otherwise)', () => {
  it('inserts a new car and returns it', async () => {
    const car = await carRepository.create(sampleCar);
    expect(car.id).toBeDefined();
    expect(car.brand).toBe('kia');
  });

  it('returns null instead of a duplicate row on a repeat brand/model/year/transmission/drive', async () => {
    await carRepository.create(sampleCar);
    const second = await carRepository.create(sampleCar);
    expect(second).toBeNull();

    const { rows } = await pool.query('SELECT COUNT(*) FROM cars');
    expect(Number(rows[0].count)).toBe(1);
  });
});

describe('PostgresCustomerRepository.findById (not used by any current endpoint)', () => {
  it('returns the customer for a real id', async () => {
    const created = await customerRepository.create({
      fullName: 'Repo Test', email: 'repotest@example.com', passwordHash: 'hashed',
    });

    const found = await customerRepository.findById(created.id);
    expect(found.email).toBe('repotest@example.com');
  });

  it('returns null for an id that does not exist', async () => {
    const found = await customerRepository.findById(999999);
    expect(found).toBeNull();
  });
});
