const GetBookingById = require('../../../src/application/use-cases/GetBookingById');

const booking = { id: 1, customerId: 1, status: 'pending' };

function makeUseCase(foundBooking = booking) {
  const bookingRepository = { findById: async () => foundBooking };
  return new GetBookingById({ bookingRepository });
}

describe('GetBookingById', () => {
  it('returns the booking to its own customer', async () => {
    const result = await makeUseCase().execute(1, { customerId: 1, role: 'customer' });
    expect(result).toBe(booking);
  });

  it('returns the booking to an admin regardless of who owns it', async () => {
    const result = await makeUseCase().execute(1, { role: 'admin' });
    expect(result).toBe(booking);
  });

  it('hides the booking from a different customer behind a 404, not a 403', async () => {
    await expect(makeUseCase().execute(1, { customerId: 2, role: 'customer' }))
      .rejects.toThrow('Booking 1 not found.');
  });

  it('returns 404 for a booking that does not exist at all', async () => {
    await expect(makeUseCase(null).execute(999, { customerId: 1, role: 'customer' }))
      .rejects.toThrow('Booking 999 not found.');
  });
});
