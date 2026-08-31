const ListAllBookings = require('../../../src/application/use-cases/ListAllBookings');

describe('ListAllBookings', () => {
  it('passes an empty filter through when no status is given', async () => {
    const bookingRepository = { findAll: jest.fn().mockResolvedValue([]) };
    const useCase = new ListAllBookings({ bookingRepository });

    await useCase.execute();

    expect(bookingRepository.findAll).toHaveBeenCalledWith({});
  });

  it('passes a status filter through to the repository', async () => {
    const bookings = [{ id: 1, status: 'pending' }];
    const bookingRepository = { findAll: jest.fn().mockResolvedValue(bookings) };
    const useCase = new ListAllBookings({ bookingRepository });

    const result = await useCase.execute({ status: 'pending' });

    expect(bookingRepository.findAll).toHaveBeenCalledWith({ status: 'pending' });
    expect(result).toBe(bookings);
  });
});
