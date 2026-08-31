const request = require('supertest');
const app = require('../../src/app');
const { resetDb, pool } = require('./helpers/db');
const { closeConnection } = require('../../src/infrastructure/messaging/connection');

async function registerAndLogin(email) {
  await request(app).post('/auth/register')
    .send({ full_name: 'Booking Tester', email, password: 'testpass123' });
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
     VALUES ($1, 'corolla', 'gas', 'automatic', 2022, 'fwd')
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
  // POST /bookings and the admin approve route both publish to RabbitMQ,
  // opening a real connection -- left open, it's exactly the kind of
  // handle that stops Jest (and this container) from ever exiting.
  await closeConnection();
});

describe('Booking lifecycle (integration, real Postgres)', () => {
  it('creates, reads, and gets approved end to end', async () => {
    const carId = await insertCar('toyota');
    const customerToken = await registerAndLogin('booker@example.com');

    const createRes = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ car_id: carId, start_date: '2027-01-01', end_date: '2027-01-05' });

    expect(createRes.status).toBe(202);
    expect(createRes.body.status).toBe('pending');
    const bookingId = createRes.body.id;

    const getRes = await request(app)
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('pending');

    const adminToken = await loginAsAdmin();
    const approveRes = await request(app)
      .patch(`/admin/bookings/${bookingId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('confirmed');

    const finalRes = await request(app)
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(finalRes.body.status).toBe('confirmed');
  });

  it('blocks a different customer from viewing this booking with 404, not 403', async () => {
    const carId = await insertCar('toyota');
    const ownerToken = await registerAndLogin('owner@example.com');
    const strangerToken = await registerAndLogin('stranger@example.com');

    const createRes = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ car_id: carId, start_date: '2027-02-01', end_date: '2027-02-05' });
    const bookingId = createRes.body.id;

    const res = await request(app)
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(res.status).toBe(404);
  });
});
