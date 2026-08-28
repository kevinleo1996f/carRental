const CreateBooking = require('../../../src/application/use-cases/CreateBooking');

function makeUseCase({ overlap = false, car = { id: 1 }, publishImpl } = {}) {
  const bookingRepository = {
    hasOverlap: jest.fn().mockResolvedValue(overlap),
    create: jest.fn().mockImplementation(async (data) => ({ id: 1, status: 'pending', ...data })),
  };
  const carRepository = { findById: jest.fn().mockResolvedValue(car) };
  const eventPublisher = { publish: publishImpl || jest.fn().mockResolvedValue(undefined) };
  const useCase = new CreateBooking({ bookingRepository, carRepository, eventPublisher });
  return { useCase, bookingRepository, carRepository, eventPublisher };
}

describe('CreateBooking', () => {
  it('creates a pending booking when the car exists and is available', async () => {
    const { useCase } = makeUseCase();

    const booking = await useCase.execute({
      customerId: 1, carId: 1, startDate: '2026-09-01', endDate: '2026-09-05',
    });

    expect(booking.status).toBe('pending');
  });

  it('rejects an end_date before start_date without touching the repositories', async () => {
    const { useCase } = makeUseCase();

    await expect(useCase.execute({
      customerId: 1, carId: 1, startDate: '2026-09-05', endDate: '2026-09-01',
    })).rejects.toThrow('end_date must not be before start_date');
  });

  it('throws NotFoundError when the car does not exist', async () => {
    const { useCase } = makeUseCase({ car: null });

    await expect(useCase.execute({
      customerId: 1, carId: 999, startDate: '2026-09-01', endDate: '2026-09-05',
    })).rejects.toThrow('Car 999 not found.');
  });

  it('throws ConflictError when the car is already booked for overlapping dates', async () => {
    const { useCase } = makeUseCase({ overlap: true });

    await expect(useCase.execute({
      customerId: 1, carId: 1, startDate: '2026-09-01', endDate: '2026-09-05',
    })).rejects.toThrow('Car is not available for the requested dates.');
  });

  it('publishes booking.created with the new booking id after a successful create', async () => {
    const { useCase, eventPublisher } = makeUseCase();

    const booking = await useCase.execute({
      customerId: 1, carId: 1, startDate: '2026-09-01', endDate: '2026-09-05',
    });

    expect(eventPublisher.publish).toHaveBeenCalledWith('booking.created', { bookingId: booking.id });
  });

  it('still returns the booking even if publishing the event fails', async () => {
    const { useCase } = makeUseCase({
      publishImpl: jest.fn().mockRejectedValue(new Error('RabbitMQ is down')),
    });

    const booking = await useCase.execute({
      customerId: 1, carId: 1, startDate: '2026-09-01', endDate: '2026-09-05',
    });

    expect(booking.status).toBe('pending');
  });
});
