const { getConnection } = require('./infrastructure/messaging/connection');

const QUEUES = ['booking.created', 'booking.status_changed'];

function handleBookingCreated(event) {
  console.log(`[booking.created] booking ${event.bookingId} is pending -- notifying admin to review.`);
}

function handleBookingStatusChanged(event) {
  console.log(`[booking.status_changed] booking ${event.bookingId} is now "${event.status}" -- notifying customer.`);
}

const HANDLERS = {
  'booking.created': handleBookingCreated,
  'booking.status_changed': handleBookingStatusChanged,
};

async function start() {
  const connection = await getConnection();
  const channel = await connection.createChannel();

  for (const queue of QUEUES) {
    await channel.assertQueue(queue, { durable: true });
    channel.consume(queue, (msg) => {
      if (!msg) return;
      const event = JSON.parse(msg.content.toString());
      HANDLERS[queue](event);
      channel.ack(msg);
    });
  }

  console.log('Worker connected to RabbitMQ. Listening on:', QUEUES.join(', '));
}

start().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
