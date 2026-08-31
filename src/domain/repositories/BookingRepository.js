class BookingRepository {
  async create(booking) {
    throw new Error('Not implemented');
  }

  async findById(id) {
    throw new Error('Not implemented');
  }

  async findByCustomerId(customerId) {
    throw new Error('Not implemented');
  }

  async updateStatus(id, status) {
    throw new Error('Not implemented');
  }

  async hasOverlap(carId, startDate, endDate) {
    throw new Error('Not implemented');
  }

  async findAll(filters) {
    throw new Error('Not implemented');
  }
}

module.exports = BookingRepository;
