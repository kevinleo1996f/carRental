const { getConnection } = require('./connection');

async function publish(queue, message) {
  const connection = await getConnection();
  const channel = await connection.createChannel();
  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
  await channel.close();
}

module.exports = { publish };
