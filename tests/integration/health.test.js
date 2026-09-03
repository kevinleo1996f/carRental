const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('./helpers/db');
const { closeConnection } = require('../../src/infrastructure/messaging/connection');

afterAll(async () => {
  await pool.end();
  // The health check itself opens a real RabbitMQ connection (to prove
  // it's actually reachable, not just configured) -- same reason
  // bookings.test.js and cars.test.js close it too.
  await closeConnection();
});

describe('GET /health (integration, real dependencies)', () => {
  it('reports ok with both dependencies healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dependencies.postgres).toBe('ok');
    expect(res.body.dependencies.rabbitmq).toBe('ok');
  });
});
