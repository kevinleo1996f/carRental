const Booking = require('../../domain/entities/Booking');
const { NotFoundError, ConflictError } = require('../../domain/errors');

class CreateBooking {
  constructor({ bookingRepository, carRepository }) {
    this.bookingRepository = bookingRepository;
    this.carRepository = carRepository;
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

    return this.bookingRepository.create({ customerId, carId, startDate, endDate });
  }
}

module.exports = CreateBooking;
