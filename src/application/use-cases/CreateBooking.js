const Booking = require('../../domain/entities/Booking');
const { NotFoundError, ConflictError } = require('../../domain/errors');

class CreateBooking {
  constructor({ bookingRepository, carRepository, eventPublisher }) {
    this.bookingRepository = bookingRepository;
    this.carRepository = carRepository;
    this.eventPublisher = eventPublisher;
  }

  async execute({ customerId, carId, startDate, endDate }) {
    // Reuses Booking's own validation (valid dates, end >= start) instead
    // of duplicating those checks here. The instance itself is discarded --
    // this call is only for the validation it runs in its constructor.
    new Booking({ customerId, carId, startDate, endDate });

    const car = await this.carRepository.findById(carId);
    if (!car) {
      throw new NotFoundError(`Car ${carId} not found.`);
    }

    const isOverlapping = await this.bookingRepository.hasOverlap(carId, startDate, endDate);
    if (isOverlapping) {
      throw new ConflictError('Car is not available for the requested dates.');
    }

    const booking = await this.bookingRepository.create({ customerId, carId, startDate, endDate });

    // The booking is already safely committed to Postgres at this point --
    // a RabbitMQ outage should never fail the customer's request. Worst
    // case, the worker's side effects just run late (once RabbitMQ is back)
    // instead of not running at all.
    try {
      await this.eventPublisher.publish('booking.created', { bookingId: booking.id });
    } catch (err) {
      console.warn(`Failed to publish booking.created for booking ${booking.id}: ${err.message}`);
    }

    return booking;
  }
}

module.exports = CreateBooking;
