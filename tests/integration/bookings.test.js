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
  it('lists only the logged-in customer\'s own bookings', async () => {
    const carId = await insertCar('toyota');
    const aliceToken = await registerAndLogin('alicelist@example.com');
    const bobToken = await registerAndLogin('boblist@example.com');
    await request(app).post('/bookings').set('Authorization', `Bearer ${aliceToken}`)
      .send({ car_id: carId, start_date: '2027-08-01', end_date: '2027-08-02' });
    await request(app).post('/bookings').set('Authorization', `Bearer ${bobToken}`)
      .send({ car_id: carId, start_date: '2027-09-01', end_date: '2027-09-02' });

    const res = await request(app).get('/bookings').set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('rejects an admin token trying to create a booking, with 403', async () => {
    const carId = await insertCar('toyota');
    const adminToken = await loginAsAdmin();
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ car_id: carId, start_date: '2027-10-01', end_date: '2027-10-02' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid/garbage token with 401', async () => {
    const res = await request(app)
      .get('/bookings')
      .set('Authorization', 'Bearer garbage.not.a.real.token');
    expect(res.status).toBe(401);
  });

  it('returns a JSON 404 for a route that does not exist at all', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Route not found/);
  });

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

  describe('admin approve/reject edge cases', () => {
    it('rejects a non-admin token with 403', async () => {
      const carId = await insertCar('toyota');
      const customerToken = await registerAndLogin('nonadmin@example.com');
      const createRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ car_id: carId, start_date: '2027-03-01', end_date: '2027-03-05' });

      const res = await request(app)
        .patch(`/admin/bookings/${createRes.body.id}/approve`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 404 acting on a booking that does not exist', async () => {
      const adminToken = await loginAsAdmin();
      const res = await request(app)
        .patch('/admin/bookings/999999/approve')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('returns 409 re-approving an already-confirmed booking, and rejecting works too', async () => {
      const carId = await insertCar('toyota');
      const customerToken = await registerAndLogin('twice@example.com');
      const createRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ car_id: carId, start_date: '2027-03-10', end_date: '2027-03-15' });
      const bookingId = createRes.body.id;

      const adminToken = await loginAsAdmin();
      const firstApprove = await request(app)
        .patch(`/admin/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(firstApprove.status).toBe(200);

      const secondApprove = await request(app)
        .patch(`/admin/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(secondApprove.status).toBe(409);

      const rejectAttempt = await request(app)
        .patch(`/admin/bookings/${bookingId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(rejectAttempt.status).toBe(409);
    });

    it('rejects a pending booking, and it shows up under GET /admin/bookings?status=rejected', async () => {
      const carId = await insertCar('toyota');
      const customerToken = await registerAndLogin('rejectme@example.com');
      const createRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ car_id: carId, start_date: '2027-03-20', end_date: '2027-03-25' });
      const bookingId = createRes.body.id;

      const adminToken = await loginAsAdmin();
      const rejectRes = await request(app)
        .patch(`/admin/bookings/${bookingId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.status).toBe('rejected');

      const listRes = await request(app)
        .get('/admin/bookings?status=rejected')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.map((b) => b.id)).toContain(bookingId);
    });
  });

  describe('GET /admin/bookings', () => {
    it('lists every booking regardless of which customer created it', async () => {
      const carId = await insertCar('toyota');
      const aliceToken = await registerAndLogin('alice@example.com');
      const bobToken = await registerAndLogin('bob@example.com');
      await request(app).post('/bookings').set('Authorization', `Bearer ${aliceToken}`)
        .send({ car_id: carId, start_date: '2027-06-01', end_date: '2027-06-02' });
      await request(app).post('/bookings').set('Authorization', `Bearer ${bobToken}`)
        .send({ car_id: carId, start_date: '2027-07-01', end_date: '2027-07-02' });

      const adminToken = await loginAsAdmin();
      const res = await request(app).get('/admin/bookings').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it('rejects a non-admin token with 403', async () => {
      const customerToken = await registerAndLogin('notadminlisting@example.com');
      const res = await request(app).get('/admin/bookings').set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });
});
