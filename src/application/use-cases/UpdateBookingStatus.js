const { NotFoundError, ConflictError } = require('../../domain/errors');

class UpdateBookingStatus {
  constructor({ bookingRepository, eventPublisher }) {
    this.bookingRepository = bookingRepository;
    this.eventPublisher = eventPublisher;
  }

  async execute(id, newStatus) {
    const booking = await this.bookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundError(`Booking ${id} not found.`);
    }
    if (booking.status !== 'pending') {
      throw new ConflictError(`Booking ${id} is already ${booking.status} and cannot be changed.`);
    }

    const updated = await this.bookingRepository.updateStatus(id, newStatus);

    // Same resilience decision as CreateBooking's publish -- the status
    // change is already committed to Postgres, so a RabbitMQ outage
    // should never fail the admin's request.
    try {
      await this.eventPublisher.publish('booking.status_changed', {
        bookingId: updated.id,
        status: updated.status,
      });
    } catch (err) {
      console.warn(`Failed to publish booking.status_changed for booking ${updated.id}: ${err.message}`);
    }

    return updated;
  }
}

module.exports = UpdateBookingStatus;
