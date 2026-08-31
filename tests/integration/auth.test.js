const request = require('supertest');
const app = require('../../src/app');
const { resetDb, pool } = require('./helpers/db');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('Auth (integration, real Postgres)', () => {
  it('registers a new customer and can log in with the same credentials', async () => {
    const registerRes = await request(app)
      .post('/auth/register')
      .send({ full_name: 'Integration Test', email: 'integration@example.com', password: 'testpass123' });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.password).toBeUndefined();
    expect(registerRes.body.password_hash).toBeUndefined();

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'integration@example.com', password: 'testpass123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.role).toBe('customer');
    expect(typeof loginRes.body.token).toBe('string');
  });

  it('rejects registering the same email twice', async () => {
    await request(app).post('/auth/register')
      .send({ full_name: 'A', email: 'dup@example.com', password: 'testpass123' });

    const res = await request(app).post('/auth/register')
      .send({ full_name: 'B', email: 'dup@example.com', password: 'testpass123' });

    expect(res.status).toBe(409);
  });

  it('logs the admin in from env config, with no database row involved', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });
});
