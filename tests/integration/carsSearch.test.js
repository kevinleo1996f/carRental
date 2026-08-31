jest.mock('../../src/infrastructure/external/ninjaApiClient');

const request = require('supertest');
const app = require('../../src/app');
const ninjaApiClient = require('../../src/infrastructure/external/ninjaApiClient');
const { resetDb, pool } = require('./helpers/db');

async function loginAsCustomer() {
  await request(app).post('/auth/register')
    .send({ full_name: 'Search Tester', email: 'search@example.com', password: 'testpass123' });
  const res = await request(app).post('/auth/login')
    .send({ email: 'search@example.com', password: 'testpass123' });
  return res.body.token;
}

beforeEach(async () => {
  await resetDb();
  jest.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe('GET /cars/search (integration, Ninja client mocked)', () => {
  it('returns a live Ninja result and caches it in the real database', async () => {
    ninjaApiClient.fetchCars.mockResolvedValue([
      { make: 'kia', model: 'seltos fwd', fuel_type: 'gas', transmission: 'a', year: 2021, drive: 'fwd' },
    ]);
    ninjaApiClient.mapToCarRecord.mockReturnValue({
      brand: 'kia', model: 'seltos fwd', fuelType: 'gas', transmission: 'automatic', year: 2021, drive: 'fwd',
    });

    const token = await loginAsCustomer();
    const res = await request(app)
      .get('/cars/search?brand=kia&year=2021')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('ninja_api');
    expect(res.body.car.brand).toBe('kia');

    const dbCheck = await pool.query('SELECT * FROM cars WHERE brand = $1', ['kia']);
    expect(dbCheck.rowCount).toBe(1);
  });

  it('falls back to the database when Ninja fails', async () => {
    await pool.query(
      `INSERT INTO cars (brand, model, fuel_type, transmission, year, drive)
       VALUES ('honda', 'civic', 'gas', 'manual', 2022, 'fwd')`
    );
    ninjaApiClient.fetchCars.mockRejectedValue(new Error('Ninja API request failed (401): Invalid API Key.'));

    const token = await loginAsCustomer();
    const res = await request(app)
      .get('/cars/search?brand=honda&year=2022')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('database_fallback');
    expect(res.body.car.brand).toBe('honda');
  });

  it('returns 404 when neither Ninja nor the database has a match', async () => {
    ninjaApiClient.fetchCars.mockResolvedValue([]);

    const token = await loginAsCustomer();
    const res = await request(app)
      .get('/cars/search?brand=doesnotexist&year=1899')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
