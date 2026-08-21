console.log('Worker process started. RabbitMQ consumer wiring is added in a later step.');

// Nothing is scheduling any work yet, so without this the process would run
// to completion and exit immediately, and Docker would keep restarting it.
setInterval(() => {}, 1000 * 60 * 60);
