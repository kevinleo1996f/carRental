const pool = require('../../../src/infrastructure/db/pool');

async function resetDb() {
  await pool.query('TRUNCATE bookings, cars, customers RESTART IDENTITY CASCADE');
}

module.exports = { resetDb, pool };
