const ListBookingsForCustomer = require('../../../src/application/use-cases/ListBookingsForCustomer');

describe('ListBookingsForCustomer', () => {
  it('asks the repository for that customer\'s bookings only', async () => {
    const bookings = [{ id: 1, customerId: 1 }];
    const bookingRepository = { findByCustomerId: jest.fn().mockResolvedValue(bookings) };
    const useCase = new ListBookingsForCustomer({ bookingRepository });

    const result = await useCase.execute(1);

    expect(bookingRepository.findByCustomerId).toHaveBeenCalledWith(1);
    expect(result).toBe(bookings);
  });
});
