const pool = require('../../../infrastructure/db/pool');
const { getConnection } = require('../../../infrastructure/messaging/connection');

async function check(req, res) {
  const dependencies = {};

  try {
    await pool.query('SELECT 1');
    dependencies.postgres = 'ok';
  } catch (err) {
    dependencies.postgres = `error: ${err.message}`;
  }

  try {
    await getConnection();
    dependencies.rabbitmq = 'ok';
  } catch (err) {
    dependencies.rabbitmq = `error: ${err.message}`;
  }

  const allOk = Object.values(dependencies).every((status) => status === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    dependencies,
  });
}

module.exports = { check };
