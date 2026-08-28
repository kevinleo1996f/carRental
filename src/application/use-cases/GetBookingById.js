const { NotFoundError } = require('../../domain/errors');

class GetBookingById {
  constructor({ bookingRepository }) {
    this.bookingRepository = bookingRepository;
  }

  async execute(id, requestingUser) {
    const booking = await this.bookingRepository.findById(id);
    const isOwner = booking && booking.customerId === requestingUser.customerId;
    const isAdmin = requestingUser.role === 'admin';

    // Same 404 whether the booking doesn't exist or just isn't yours --
    // never reveals that someone else's booking id is real.
    if (!booking || (!isOwner && !isAdmin)) {
      throw new NotFoundError(`Booking ${id} not found.`);
    }

    return booking;
  }
}

module.exports = GetBookingById;
