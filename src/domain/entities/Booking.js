const VALID_STATUSES = ['pending', 'confirmed', 'rejected'];

class Booking {
  constructor({ id, customerId, carId, startDate, endDate, status = 'pending', createdAt, updatedAt }) {
    if (new Date(endDate) < new Date(startDate)) {
      throw new Error('end_date must not be before start_date');
    }
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    this.id = id;
    this.customerId = customerId;
    this.carId = carId;
    this.startDate = startDate;
    this.endDate = endDate;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

Booking.VALID_STATUSES = VALID_STATUSES;

module.exports = Booking;
