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

module.exports = { getConnection };
