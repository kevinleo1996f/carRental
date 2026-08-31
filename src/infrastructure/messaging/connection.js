const amqplib = require('amqplib');
const config = require('../../config/env');

let connectionPromise = null;

function getConnection() {
  if (!connectionPromise) {
    const { user, password, host, port } = config.rabbitmq;
    const url = `amqp://${user}:${password}@${host}:${port}`;
    connectionPromise = amqplib.connect(url);
  }
  return connectionPromise;
}

async function closeConnection() {
  if (connectionPromise) {
    const connection = await connectionPromise;
    connectionPromise = null;
    await connection.close();
  }
}

module.exports = { getConnection, closeConnection };
