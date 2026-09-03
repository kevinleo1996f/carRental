const request = require('supertest');
const app = require('../../src/app');
const { resetDb, pool } = require('./helpers/db');
const { closeConnection } = require('../../src/infrastructure/messaging/connection');

async function registerAndLogin(email) {
  await request(app).post('/auth/register')
    .send({ full_name: 'Cars Tester', email, password: 'testpass123' });
  const res = await request(app).post('/auth/login').send({ email, password: 'testpass123' });
  return res.body.token;
}

async function loginAsAdmin() {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  return res.body.token;
}

async function insertCar(brand) {
  const { rows } = await pool.query(
    `INSERT INTO cars (brand, model, fuel_type, transmission, year, drive)
     VALUES ($1, 'seltos', 'gas', 'automatic', 2022, 'fwd')
     RETURNING id`,
    [brand]
  );
  return rows[0].id;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
  // The 409-conflict test below creates a real booking, which publishes
  // to RabbitMQ -- see bookings.test.js for why this matters.
  await closeConnection();
});

describe('Cars (integration, real Postgres)', () => {
  it('lists cars, optionally filtered by brand', async () => {
    await insertCar('kia');
    await insertCar('honda');
    const token = await registerAndLogin('carsbrowser@example.com');

    const all = await request(app).get('/cars').set('Authorization', `Bearer ${token}`);
    expect(all.status).toBe(200);
    expect(all.body.length).toBe(2);

    const filtered = await request(app).get('/cars?brand=kia').set('Authorization', `Bearer ${token}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.length).toBe(1);
    expect(filtered.body[0].brand).toBe('kia');
  });

  it('requires a token to list cars', async () => {
    const res = await request(app).get('/cars');
    expect(res.status).toBe(401);
  });

  it('gets a single car by id, and 404s for one that does not exist', async () => {
    const carId = await insertCar('kia');
    const token = await registerAndLogin('carsgetter@example.com');

    const found = await request(app).get(`/cars/${carId}`).set('Authorization', `Bearer ${token}`);
    expect(found.status).toBe(200);
    expect(found.body.brand).toBe('kia');

    const missing = await request(app).get('/cars/999999').set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });

  it('rejects a non-integer car id with 400', async () => {
    const token = await registerAndLogin('carsbadid@example.com');
    const res = await request(app).get('/cars/not-a-number').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  describe('DELETE /admin/cars/:id', () => {
    it('deletes a car with no bookings', async () => {
      const carId = await insertCar('kia');
      const adminToken = await loginAsAdmin();

      const res = await request(app)
        .delete(`/admin/cars/${carId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);

      const check = await pool.query('SELECT * FROM cars WHERE id = $1', [carId]);
      expect(check.rowCount).toBe(0);
    });

    it('blocks deleting a car that has a booking, with 409', async () => {
      const carId = await insertCar('kia');
      const customerToken = await registerAndLogin('carsbooker@example.com');
      await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ car_id: carId, start_date: '2027-04-01', end_date: '2027-04-05' });

      const adminToken = await loginAsAdmin();
      const res = await request(app)
        .delete(`/admin/cars/${carId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(409);
    });

    it('returns 404 deleting a car that does not exist', async () => {
      const adminToken = await loginAsAdmin();
      const res = await request(app)
        .delete('/admin/cars/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('rejects a non-admin token with 403', async () => {
      const carId = await insertCar('kia');
      const customerToken = await registerAndLogin('carsnotadmin@example.com');
      const res = await request(app)
        .delete(`/admin/cars/${carId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });
});
