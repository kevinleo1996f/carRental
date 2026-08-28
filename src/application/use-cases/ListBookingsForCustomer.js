class ListBookingsForCustomer {
  constructor({ bookingRepository }) {
    this.bookingRepository = bookingRepository;
  }

  async execute(customerId) {
    return this.bookingRepository.findByCustomerId(customerId);
  }
}

module.exports = ListBookingsForCustomer;
