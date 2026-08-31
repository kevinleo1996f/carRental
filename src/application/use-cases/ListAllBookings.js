class ListAllBookings {
  constructor({ bookingRepository }) {
    this.bookingRepository = bookingRepository;
  }

  async execute(filters = {}) {
    return this.bookingRepository.findAll(filters);
  }
}

module.exports = ListAllBookings;
